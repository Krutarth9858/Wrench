"""Email one-time codes.

A dedicated table rather than columns on `users`: a code is a short-lived
credential with its own lifecycle (issued, attempted, consumed, expired), and
several may exist for one account over time. Nothing here stores the code
itself — only an Argon2 hash of it, using the same hashing the password path
already uses.
"""

import enum
import uuid

from sqlalchemy import (
    Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, func,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class OTPPurpose(str, enum.Enum):
    """What a code authorises. A code issued for one purpose can never be
    redeemed for another — the purpose is part of the lookup."""

    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
    PASSWORD_RESET = "PASSWORD_RESET"


class EmailOTP(Base):
    __tablename__ = "email_otps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    #: Denormalised so a code stays bound to the address it was sent to even if
    #: the account's email later changes.
    email = Column(String, nullable=False, index=True)

    #: Argon2 hash. The code itself is never stored, logged or returned.
    code_hash = Column(String, nullable=False)
    purpose = Column(SQLEnum(OTPPurpose), nullable=False, index=True)

    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    #: Set the moment a code is redeemed, which is what makes it single-use.
    used_at = Column(DateTime(timezone=True), nullable=True)
    #: Set when a newer code supersedes this one, so only one is ever live.
    superseded_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
