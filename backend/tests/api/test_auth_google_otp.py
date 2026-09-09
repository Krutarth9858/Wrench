"""Google Sign-In and email OTP.

Google is exercised with an injected identity and a stubbed token endpoint: no
Google client is configured in the suite, so these prove the linking rules,
the CSRF state and the claim validation — not that a real Google login works.
Email uses the console provider, whose in-memory outbox stands in for delivery.
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.db.repositories.otp import OTPRepository
from app.db.repositories.token import TokenRepository
from app.db.repositories.user import UserRepository
from app.db.session import AsyncSessionLocal
from app.models.otp import EmailOTP, OTPPurpose
from app.models.user import User, UserRole
from app.services import google_oauth, rate_limit
from app.services.auth import AuthService
from app.services.email import ConsoleMailer
from app.services.google_oauth import GoogleIdentity
from app.services.otp import OTPService

URL = "/api/v1/auth"


@pytest.fixture(autouse=True)
def clean_limiter():
    """Limits are process-global; a leaked bucket would fail the next test."""
    rate_limit.limiter.clear()
    ConsoleMailer.clear()
    yield
    rate_limit.limiter.clear()
    ConsoleMailer.clear()


def sent_code() -> str:
    """Read the code out of the console provider's outbox.

    The code exists nowhere else — not in the database, not in a log, not in an
    API response — which is the point.
    """
    body = ConsoleMailer.outbox[-1].text
    return next(line.strip() for line in body.splitlines()
                if line.strip().isdigit() and len(line.strip()) == settings.OTP_LENGTH)


async def make_user(email="otp-user@example.com", role=UserRole.CUSTOMER,
                    phone="+19998887777", password="password123"):
    async with AsyncSessionLocal() as s:
        u = User(email=email, phone_number=phone,
                 hashed_password=get_password_hash(password) if password else None,
                 role=role)
        s.add(u); await s.commit(); await s.refresh(u)
        return u


def services(session):
    return AuthService(UserRepository(session), TokenRepository(session))


# =============================================================== Google Sign-In

async def test_google_creates_an_account_when_the_email_is_new():
    async with AsyncSessionLocal() as s:
        auth = services(s)
        user = await auth.sign_in_with_google(
            GoogleIdentity(subject="g-1", email="newby@example.com", email_verified=True))
    assert user.email == "newby@example.com"
    assert user.google_sub == "g-1"
    assert user.role == UserRole.CUSTOMER
    # Google supplies neither; the columns are nullable for exactly this case.
    assert user.hashed_password is None
    assert user.phone_number is None
    assert user.is_email_verified is True


async def test_google_signup_honours_the_role_chosen_at_registration():
    async with AsyncSessionLocal() as s:
        user = await services(s).sign_in_with_google(
            GoogleIdentity(subject="g-mech", email="mech@example.com", email_verified=True),
            default_role="MECHANIC")
    assert user.role == UserRole.MECHANIC


async def test_google_cannot_grant_itself_admin():
    async with AsyncSessionLocal() as s:
        user = await services(s).sign_in_with_google(
            GoogleIdentity(subject="g-x", email="sneaky@example.com", email_verified=True),
            default_role="ADMIN")
    # An unrecognised role falls back to the default; RBAC is never bypassed.
    assert user.role == UserRole.CUSTOMER


async def test_returning_google_user_reuses_the_same_account():
    identity = GoogleIdentity(subject="g-2", email="repeat@example.com", email_verified=True)
    async with AsyncSessionLocal() as s:
        first = await services(s).sign_in_with_google(identity)
    async with AsyncSessionLocal() as s:
        second = await services(s).sign_in_with_google(identity)
    assert first.id == second.id

    async with AsyncSessionLocal() as s:
        rows = (await s.execute(select(User).where(User.email == "repeat@example.com"))
                ).scalars().all()
    assert len(rows) == 1


async def test_google_links_to_an_existing_password_account():
    existing = await make_user(email="both@example.com", role=UserRole.MECHANIC)
    async with AsyncSessionLocal() as s:
        linked = await services(s).sign_in_with_google(
            GoogleIdentity(subject="g-3", email="both@example.com", email_verified=True))
    assert linked.id == existing.id
    assert linked.google_sub == "g-3"
    # The existing role survives; Google cannot change it.
    assert linked.role == UserRole.MECHANIC
    # And the password still works.
    assert verify_password("password123", linked.hashed_password)


async def test_google_refuses_to_link_an_unverified_email():
    """Otherwise anyone able to make a Google account with someone else's
    address could take over their Wrench account."""
    await make_user(email="victim@example.com")
    async with AsyncSessionLocal() as s:
        with pytest.raises(HTTPException) as exc:
            await services(s).sign_in_with_google(
                GoogleIdentity(subject="g-evil", email="victim@example.com",
                               email_verified=False))
    assert exc.value.status_code == 409


async def test_google_refuses_an_inactive_account():
    user = await make_user(email="off@example.com")
    async with AsyncSessionLocal() as s:
        u = await UserRepository(s).get_by_id(str(user.id))
        u.is_active = False
        await s.commit()
    async with AsyncSessionLocal() as s:
        with pytest.raises(HTTPException) as exc:
            await services(s).sign_in_with_google(
                GoogleIdentity(subject="g-off", email="off@example.com", email_verified=True))
    assert exc.value.status_code == 403


async def test_google_signed_state_round_trips_and_rejects_tampering():
    state = google_oauth.issue_state("MECHANIC")
    assert google_oauth.verify_state(state) == "MECHANIC"
    with pytest.raises(google_oauth.GoogleAuthError):
        google_oauth.verify_state(state + "x")
    with pytest.raises(google_oauth.GoogleAuthError):
        google_oauth.verify_state("not-a-token")


async def test_google_callback_rejects_a_forged_state(client):
    r = await client.post(f"{URL}/google/callback",
                          json={"code": "anything", "state": "forged"})
    assert r.status_code == 401


async def test_google_url_is_unavailable_until_configured(client):
    r = await client.get(f"{URL}/google/url")
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


# ---- id_token signature verification (RS256 against Google's JWKS) ---------
#
# These sign real RS256 tokens with a throwaway keypair and point the JWKS
# client at its public key, so the production verification path runs for real:
# a forged signature, a foreign audience, a wrong issuer and an expired token
# each have to be rejected by the same code that runs against Google.

def _keypair():
    from cryptography.hazmat.primitives.asymmetric import rsa
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _sign(private_key, claims: dict) -> str:
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})


@pytest.fixture
def google_signing(monkeypatch):
    """Wire google_oauth to a local keypair instead of Google's real JWKS."""
    import app.services.google_oauth as g

    key = _keypair()
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "wrench-client")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")

    class FakeJWKS:
        @staticmethod
        def get_signing_key_from_jwt(_token):
            return type("K", (), {"key": key.public_key()})()

    monkeypatch.setattr(g, "_jwks", lambda: FakeJWKS())
    return key


def _claims(**over):
    from datetime import datetime, timedelta, timezone as tz
    base = {
        "iss": "https://accounts.google.com", "aud": "wrench-client",
        "sub": "g-9", "email": "x@example.com", "email_verified": True,
        "exp": datetime.now(tz.utc) + timedelta(minutes=5),
    }
    base.update(over)
    return base


async def test_a_properly_signed_google_identity_is_accepted(google_signing):
    import app.services.google_oauth as g
    identity = g.verify_id_token(_sign(google_signing, _claims()))
    assert identity["sub"] == "g-9" and identity["email"] == "x@example.com"


async def test_a_forged_signature_is_refused(google_signing):
    """Signed with a *different* key — exactly what an attacker would have."""
    import app.services.google_oauth as g
    forged = _sign(_keypair(), _claims())
    with pytest.raises(g.GoogleAuthError, match="could not verify"):
        g.verify_id_token(forged)


async def test_an_identity_for_another_application_is_refused(google_signing):
    import app.services.google_oauth as g
    with pytest.raises(g.GoogleAuthError, match="different application"):
        g.verify_id_token(_sign(google_signing, _claims(aud="someone-else")))


async def test_an_identity_from_another_issuer_is_refused(google_signing):
    import app.services.google_oauth as g
    with pytest.raises(g.GoogleAuthError, match="could not trust"):
        g.verify_id_token(_sign(google_signing, _claims(iss="https://evil.example")))


async def test_an_expired_identity_is_refused(google_signing):
    from datetime import datetime, timedelta, timezone as tz
    import app.services.google_oauth as g
    stale = _claims(exp=datetime.now(tz.utc) - timedelta(minutes=1))
    with pytest.raises(g.GoogleAuthError, match="expired"):
        g.verify_id_token(_sign(google_signing, stale))


async def test_the_code_exchange_verifies_the_returned_identity(google_signing, monkeypatch):
    """End to end through exchange_code, with Google's token endpoint stubbed."""
    import app.services.google_oauth as g

    class FakeResponse:
        status_code = 200
        def __init__(self, token): self._token = token
        def json(self): return {"id_token": self._token}

    class FakeClient:
        def __init__(self, token): self._token = token
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **k): return FakeResponse(self._token)

    good = _sign(google_signing, _claims())
    monkeypatch.setattr(g.httpx, "AsyncClient", lambda **k: FakeClient(good))
    identity = await g.exchange_code("code")
    assert identity.subject == "g-9" and identity.email_verified is True

    forged = _sign(_keypair(), _claims())
    monkeypatch.setattr(g.httpx, "AsyncClient", lambda **k: FakeClient(forged))
    with pytest.raises(g.GoogleAuthError):
        await g.exchange_code("code")


# ====================================================================== OTP

async def test_requesting_a_code_emails_it_and_stores_only_a_hash(client):
    user = await make_user(email="hash@example.com")
    r = await client.post(f"{URL}/otp/request", json={"email": "hash@example.com"})
    assert r.status_code == 200

    code = sent_code()
    assert len(code) == settings.OTP_LENGTH and code.isdigit()

    async with AsyncSessionLocal() as s:
        otp = (await s.execute(select(EmailOTP).where(EmailOTP.user_id == user.id))
               ).scalars().first()
    # The code never appears in the row; only a verifiable hash of it.
    assert code not in otp.code_hash
    assert verify_password(code, otp.code_hash)
    # Nor in the API response.
    assert code not in r.text


async def test_a_correct_code_verifies_and_issues_the_normal_session(client):
    await make_user(email="ok@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "ok@example.com"})

    r = await client.post(f"{URL}/otp/verify",
                          json={"email": "ok@example.com", "code": sent_code()})
    assert r.status_code == 200
    data = r.json()["data"]
    # The same token pair /login returns — not a second session mechanism.
    assert data["access_token"] and data["refresh_token"]

    me = await client.get(f"{URL}/me",
                          headers={"Authorization": f"Bearer {data['access_token']}"})
    assert me.status_code == 200
    assert me.json()["data"]["is_email_verified"] is True


async def test_a_wrong_code_is_rejected_and_counted(client):
    await make_user(email="wrong@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "wrong@example.com"})

    r = await client.post(f"{URL}/otp/verify",
                          json={"email": "wrong@example.com", "code": "000000"})
    assert r.status_code == 400
    assert "incorrect" in r.json()["detail"].lower()

    # The real code still works afterwards.
    ok = await client.post(f"{URL}/otp/verify",
                           json={"email": "wrong@example.com", "code": sent_code()})
    assert ok.status_code == 200


async def test_a_code_cannot_be_used_twice(client):
    await make_user(email="once@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "once@example.com"})
    code = sent_code()

    assert (await client.post(f"{URL}/otp/verify",
                              json={"email": "once@example.com", "code": code})).status_code == 200
    again = await client.post(f"{URL}/otp/verify",
                              json={"email": "once@example.com", "code": code})
    assert again.status_code == 400


async def test_an_expired_code_is_rejected(client):
    user = await make_user(email="stale@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "stale@example.com"})
    code = sent_code()

    async with AsyncSessionLocal() as s:
        otp = (await s.execute(select(EmailOTP).where(EmailOTP.user_id == user.id))
               ).scalars().first()
        otp.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await s.commit()

    r = await client.post(f"{URL}/otp/verify",
                          json={"email": "stale@example.com", "code": code})
    assert r.status_code == 400 and "expired" in r.json()["detail"].lower()


async def test_attempts_are_capped(client):
    await make_user(email="brute@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "brute@example.com"})
    code = sent_code()

    for _ in range(settings.OTP_MAX_ATTEMPTS):
        await client.post(f"{URL}/otp/verify",
                          json={"email": "brute@example.com", "code": "111111"})

    # Even the correct code is refused once the allowance is spent.
    r = await client.post(f"{URL}/otp/verify",
                          json={"email": "brute@example.com", "code": code})
    assert r.status_code == 400
    assert "too many" in r.json()["detail"].lower()


async def test_a_new_code_invalidates_the_previous_one(client, monkeypatch):
    monkeypatch.setattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 0)
    await make_user(email="resend@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "resend@example.com"})
    first = sent_code()
    await client.post(f"{URL}/otp/request", json={"email": "resend@example.com"})
    second = sent_code()
    assert first != second

    stale = await client.post(f"{URL}/otp/verify",
                              json={"email": "resend@example.com", "code": first})
    assert stale.status_code == 400

    fresh = await client.post(f"{URL}/otp/verify",
                              json={"email": "resend@example.com", "code": second})
    assert fresh.status_code == 200


async def test_resend_is_rate_limited_by_a_cooldown(client):
    await make_user(email="cooldown@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "cooldown@example.com"})
    again = await client.post(f"{URL}/otp/request", json={"email": "cooldown@example.com"})
    assert again.status_code == 429
    assert "wait" in again.json()["detail"].lower()


async def test_code_requests_are_rate_limited(client, monkeypatch):
    monkeypatch.setattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 0)
    await make_user(email="spam@example.com")
    statuses = []
    for _ in range(settings.OTP_MAX_REQUESTS_PER_HOUR + 2):
        r = await client.post(f"{URL}/otp/request", json={"email": "spam@example.com"})
        statuses.append(r.status_code)
    assert 429 in statuses
    # No more emails were sent than the limit allows.
    assert len(ConsoleMailer.outbox) <= settings.OTP_MAX_REQUESTS_PER_HOUR


async def test_requesting_a_code_does_not_reveal_whether_an_account_exists(client):
    known = await client.post(f"{URL}/otp/request", json={"email": "otp-user@example.com"})
    unknown = await client.post(f"{URL}/otp/request", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json()["message"] == unknown.json()["message"]
    # And nothing was actually sent to the unknown address.
    assert all(m.to != "nobody@example.com" for m in ConsoleMailer.outbox)


async def test_a_delivery_failure_is_surfaced_not_swallowed(client, monkeypatch):
    from app.services import otp as otp_module
    from app.services.email import EmailError

    class BrokenMailer:
        name = "broken"
        async def send(self, *a, **k):
            raise EmailError("provider down")

    await make_user(email="broken@example.com")
    monkeypatch.setattr(otp_module, "get_mailer", lambda: BrokenMailer())
    r = await client.post(f"{URL}/otp/request", json={"email": "broken@example.com"})
    assert r.status_code == 502


async def test_the_otp_email_carries_the_code_and_nothing_sensitive(client):
    await make_user(email="content@example.com")
    await client.post(f"{URL}/otp/request", json={"email": "content@example.com"})
    message = ConsoleMailer.outbox[-1]
    assert message.subject == "Your Wrench verification code"
    assert sent_code() in message.text
    assert str(settings.OTP_EXPIRY_MINUTES) in message.text
    # No password, token or account id in the body.
    assert "password" not in message.text.lower()


# =============================================== existing auth must still work

async def test_password_login_is_unaffected(client, api_prefix):
    await make_user(email="classic@example.com", phone="+15551239999")
    r = await client.post(f"{URL}/login",
                          json={"email": "classic@example.com", "password": "password123"})
    assert r.status_code == 200 and r.json()["data"]["access_token"]


async def test_a_google_only_account_cannot_be_logged_into_with_a_password(client):
    """The account has no hash; the attempt must fail cleanly, not crash."""
    async with AsyncSessionLocal() as s:
        await services(s).sign_in_with_google(
            GoogleIdentity(subject="g-nopw", email="nopw@example.com", email_verified=True))
    r = await client.post(f"{URL}/login",
                          json={"email": "nopw@example.com", "password": "anything"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Incorrect email or password"


async def test_registration_still_requires_a_phone_number(client):
    r = await client.post(f"{URL}/register", json={
        "email": "nophone@example.com", "password": "password123", "role": "CUSTOMER"})
    assert r.status_code == 422
