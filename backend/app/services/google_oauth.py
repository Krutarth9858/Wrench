"""Google Sign-In, authorization-code flow.

The browser never tells Wrench who the user is. It returns an opaque
authorization code; this module exchanges that code with Google over TLS using
the client secret, and only the identity in Google's own response is trusted.
An attacker who POSTs an email, a name or a picture gets nowhere.

CSRF: the `state` parameter is a short-lived token this server signs with
`SECRET_KEY` and later verifies, so a callback we did not initiate is rejected.
It reuses the existing JWT helpers rather than adding a second token system or
a server-side session table.

Redirect URI: taken from configuration and sent to Google verbatim. It is never
read from the request, so an open-redirect cannot be induced by a crafted URL.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
#: Google's published signing keys. PyJWKClient caches and refreshes them, so a
#: normal sign-in does not fetch this on every request.
JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
STATE_TTL_SECONDS = 600


class GoogleAuthError(RuntimeError):
    """Google refused the exchange, or the identity did not check out."""


@dataclass
class GoogleIdentity:
    """What Google actually asserted. Nothing here comes from the browser."""

    subject: str          # stable, unique per Google account
    email: str
    email_verified: bool


def is_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def _require_configured() -> None:
    if not is_configured():
        raise GoogleAuthError(
            "Google Sign-In is not configured on this server "
            "(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)."
        )


def issue_state(role: str = "CUSTOMER") -> str:
    """A signed, expiring CSRF token that also carries the chosen signup role."""
    from datetime import datetime, timezone
    payload = {
        "typ": "oauth_state",
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=STATE_TTL_SECONDS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def verify_state(state: str) -> str:
    """Return the role carried by a valid state token, or raise."""
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise GoogleAuthError("This sign-in link is invalid or has expired.") from exc
    if payload.get("typ") != "oauth_state":
        raise GoogleAuthError("This sign-in link is invalid or has expired.")
    role = payload.get("role", "CUSTOMER")
    return role if role in ("CUSTOMER", "MECHANIC") else "CUSTOMER"


def authorization_url(state: str) -> str:
    """Where the browser should be sent to authenticate with Google."""
    _require_configured()
    query = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    })
    return f"{AUTH_ENDPOINT}?{query}"


#: Built lazily and reused: it caches Google's keys between sign-ins.
_jwk_client: "jwt.PyJWKClient | None" = None


def _jwks() -> "jwt.PyJWKClient":
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = jwt.PyJWKClient(JWKS_URI, cache_keys=True)
    return _jwk_client


def verify_id_token(id_token: str) -> dict:
    """Verify an id_token's signature against Google's published keys.

    The token already arrives over TLS from Google's own token endpoint, which
    is why the code flow is considered safe without this step. Verifying anyway
    means the identity is proved by Google's signature rather than by trust in
    the transport, so a compromised or misconfigured HTTP path cannot forge one.

    `aud`, `iss` and `exp` are checked as part of the same decode.
    """
    try:
        signing_key = _jwks().get_signing_key_from_jwt(id_token)
    except Exception as exc:  # noqa: BLE001 - network or malformed token
        raise GoogleAuthError("Could not verify Google's identity signature.") from exc

    try:
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.InvalidAudienceError as exc:
        raise GoogleAuthError("Google returned an identity for a different application.") from exc
    except jwt.InvalidIssuerError as exc:
        raise GoogleAuthError("Google returned an identity we could not trust.") from exc
    except jwt.ExpiredSignatureError as exc:
        raise GoogleAuthError("That Google sign-in has expired. Please try again.") from exc
    except jwt.PyJWTError as exc:
        raise GoogleAuthError("Google returned an identity we could not verify.") from exc

    # Checked here rather than via decode(issuer=...): PyJWT compares that
    # argument by equality, so it cannot express Google's two valid issuers.
    if claims.get("iss") not in ISSUERS:
        raise GoogleAuthError("Google returned an identity we could not trust.")
    return claims


async def exchange_code(code: str) -> GoogleIdentity:
    """Trade an authorization code for a verified Google identity."""
    _require_configured()
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(TOKEN_ENDPOINT, data=data)
    except httpx.HTTPError as exc:
        raise GoogleAuthError("Could not reach Google to complete sign-in.") from exc

    if response.status_code >= 400:
        # Never log the body: it echoes the code and may carry tokens.
        logger.warning("google token exchange failed (%s)", response.status_code)
        raise GoogleAuthError("Google could not complete this sign-in.")

    id_token = response.json().get("id_token")
    if not id_token:
        raise GoogleAuthError("Google returned no identity for this sign-in.")

    # Signature, audience, issuer and expiry are all checked here.
    claims = verify_id_token(id_token)

    subject, email = claims.get("sub"), (claims.get("email") or "").lower()
    if not subject or not email:
        raise GoogleAuthError("Google did not return an email for this account.")

    return GoogleIdentity(
        subject=subject,
        email=email,
        email_verified=bool(claims.get("email_verified")),
    )
