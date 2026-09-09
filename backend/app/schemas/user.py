from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
import re

class UserBase(BaseModel):
    email: EmailStr
    # Optional since Google Sign-In: an account created that way has no phone
    # number until the customer adds one. Password registration still requires
    # it — see UserCreate.
    phone_number: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, v: Optional[str]) -> Optional[str]:
        # Basic validation for digits and optional + at the beginning
        if v is None:
            return v
        if not re.match(r"^\+?[1-9]\d{1,14}$", v):
            raise ValueError("Invalid phone number format")
        return v

class UserCreate(UserBase):
    # Still mandatory on the password signup path.
    phone_number: str
    password: str = Field(..., min_length=8)
    # Public self-registration is limited to the two roles the RAD says may sign up.
    # ADMIN is deliberately NOT accepted here; it is provisioned out-of-band by
    # scripts/create_admin.py. Sending role="ADMIN" fails validation with 422.
    role: Literal["CUSTOMER", "MECHANIC"] = "CUSTOMER"
    
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: UUID
    role: str
    is_active: bool
    is_email_verified: bool = False
    
    model_config = ConfigDict(from_attributes=True)
