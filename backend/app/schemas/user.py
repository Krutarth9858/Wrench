from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
import re

class UserBase(BaseModel):
    email: EmailStr
    phone_number: str

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, v: str) -> str:
        # Basic validation for digits and optional + at the beginning
        if not re.match(r"^\+?[1-9]\d{1,14}$", v):
            raise ValueError("Invalid phone number format")
        return v

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: str
    role: str
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)
