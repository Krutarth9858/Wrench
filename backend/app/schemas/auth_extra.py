"""Schemas for Google Sign-In and email OTP.

No request here carries an identity claim: Google's identity comes from Google,
and an OTP names only the address it was sent to.
"""

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.otp import OTPPurpose


class GoogleAuthUrlResponse(BaseModel):
    """Where to send the browser, plus the signed CSRF state to echo back."""

    authorization_url: str


class GoogleCallbackRequest(BaseModel):
    """What Google hands back through the browser. Both values are opaque:
    the code is exchanged server-side and the state is a token we signed."""

    code: str
    state: str


class OTPRequest(BaseModel):
    email: EmailStr
    purpose: Literal["EMAIL_VERIFICATION", "PASSWORD_RESET"] = "EMAIL_VERIFICATION"


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=12)
    purpose: Literal["EMAIL_VERIFICATION", "PASSWORD_RESET"] = "EMAIL_VERIFICATION"


class OTPRequestResponse(BaseModel):
    """Deliberately says nothing about whether the account exists."""

    email: str
    expires_in_minutes: int
    resend_after_seconds: int
