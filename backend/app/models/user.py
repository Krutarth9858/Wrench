import enum
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base

class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    MECHANIC = "MECHANIC"
    ADMIN = "ADMIN"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    # Nullable since Google Sign-In: Google returns no phone number, so an
    # account created that way has none until the customer supplies one.
    # Still unique when present.
    phone_number = Column(String, unique=True, index=True, nullable=True)
    # Nullable for the same reason: a Google-only account has no password.
    # `verify_password` is never reached for such a user (see AuthService).
    hashed_password = Column(String, nullable=True)
    # Google's stable subject id. The identity we link on — never the email
    # alone, which a provider could in principle re-issue.
    google_sub = Column(String, unique=True, index=True, nullable=True)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
