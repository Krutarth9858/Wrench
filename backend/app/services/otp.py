"""Email one-time codes: issue, verify, and the rules around both.

Security properties, all enforced here rather than at call sites:

* the code is never stored, logged or returned — only an Argon2 hash of it,
  reusing the password hashing Wrench already relies on;
* single-use: redeeming stamps `used_at`, and a used code never verifies again;
* short-lived: `OTP_EXPIRY_MINUTES`;
* one live code per (user, purpose): issuing supersedes every earlier one, so an
  old code stops working the moment a new one is sent;
* bounded guessing: `OTP_MAX_ATTEMPTS` per code, counted on the row;
* resend cooldown and per-email/per-caller request limits.

Every value comes from configuration.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status as http_status

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.db.repositories.otp import OTPRepository
from app.models.otp import EmailOTP, OTPPurpose
from app.models.user import User
from app.services import rate_limit
from app.services.email import EmailError, get_mailer
from app.services.email_templates import verification_email

logger = logging.getLogger(__name__)

HOUR = 3600


def _now() -> datetime:
    return datetime.now(timezone.utc)


def generate_code() -> str:
    """A cryptographically random fixed-length numeric code."""
    upper = 10 ** settings.OTP_LENGTH
    return str(secrets.randbelow(upper)).zfill(settings.OTP_LENGTH)


class OTPService:
    def __init__(self, otp_repo: OTPRepository):
        self.otps = otp_repo

    async def issue(self, user: User, purpose: OTPPurpose, *,
                    caller_key: str = "") -> EmailOTP:
        """Create and email a fresh code, superseding any earlier live one."""
        rate_limit.enforce(
            f"otp:request:{user.email}:{purpose.value}",
            settings.OTP_MAX_REQUESTS_PER_HOUR, HOUR,
            "Too many codes requested. Please try again later.",
        )
        if caller_key:
            rate_limit.enforce(
                f"otp:request:ip:{caller_key}",
                settings.OTP_MAX_REQUESTS_PER_HOUR * 3, HOUR,
                "Too many codes requested. Please try again later.",
            )

        latest = await self.otps.latest_live(user.id, purpose)
        if latest:
            age = (_now() - _as_utc(latest.created_at)).total_seconds()
            if age < settings.OTP_RESEND_COOLDOWN_SECONDS:
                wait = int(settings.OTP_RESEND_COOLDOWN_SECONDS - age)
                raise HTTPException(
                    status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {wait}s before requesting another code.",
                )

        # A new code invalidates every earlier one for this user and purpose.
        await self.otps.supersede_live(user.id, purpose, _now())

        code = generate_code()
        otp = EmailOTP(
            user_id=user.id,
            email=user.email,
            code_hash=get_password_hash(code),
            purpose=purpose,
            expires_at=_now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
        )
        otp = await self.otps.create(otp)

        subject, html, text = verification_email(code, settings.OTP_EXPIRY_MINUTES)
        try:
            await get_mailer().send(user.email, subject, html, text)
        except EmailError:
            # The row is already written; the customer can resend. The code is
            # never surfaced to the caller as a consolation.
            logger.warning("verification email could not be delivered")
            raise HTTPException(
                status_code=http_status.HTTP_502_BAD_GATEWAY,
                detail="We could not send the email just now. Please try again.",
            )
        return otp

    async def verify(self, user: User, purpose: OTPPurpose, code: str, *,
                     caller_key: str = "") -> EmailOTP:
        """Redeem a code. Raises with a safe message on every failure path."""
        rate_limit.enforce(
            f"otp:verify:{user.email}:{purpose.value}",
            settings.OTP_MAX_VERIFY_PER_HOUR, HOUR,
            "Too many attempts. Please request a new code later.",
        )
        if caller_key:
            rate_limit.enforce(
                f"otp:verify:ip:{caller_key}",
                settings.OTP_MAX_VERIFY_PER_HOUR * 3, HOUR,
                "Too many attempts. Please try again later.",
            )

        otp = await self.otps.latest_live(user.id, purpose)
        if not otp:
            raise _invalid("That code is no longer valid. Request a new one.")
        if _as_utc(otp.expires_at) < _now():
            raise _invalid("That code has expired. Request a new one.")
        if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
            raise _invalid("Too many incorrect attempts. Request a new code.")

        if not verify_password(code, otp.code_hash):
            otp.attempts += 1
            await self.otps.save(otp)
            remaining = max(settings.OTP_MAX_ATTEMPTS - otp.attempts, 0)
            if remaining == 0:
                raise _invalid("Too many incorrect attempts. Request a new code.")
            raise _invalid(f"That code is incorrect. {remaining} attempts remaining.")

        # Single use: consumed the moment it succeeds.
        otp.used_at = _now()
        return await self.otps.save(otp)


def _as_utc(value: datetime) -> datetime:
    """Rows read back from PostgreSQL may be naive depending on the driver."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _invalid(detail: str) -> HTTPException:
    return HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=detail)
