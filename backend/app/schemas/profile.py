from pydantic import BaseModel, HttpUrl, Field, ConfigDict, field_validator
from typing import Optional, List
import re

class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

class ImageUpdate(BaseModel):
    profile_image: HttpUrl

class CustomerProfileBase(BaseModel):
    full_name: str
    phone_number: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    emergency_contact_name: str
    emergency_contact_number: str
    address: str
    city: str
    state: str
    country: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

    @field_validator("phone_number", "emergency_contact_number")
    @classmethod
    def validate_phone_number(cls, v: str) -> str:
        if not re.match(r"^\+?[1-9]\d{1,14}$", v):
            raise ValueError("Invalid phone number format")
        return v

class CustomerProfileCreate(CustomerProfileBase):
    pass

class CustomerProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

    @field_validator("phone_number", "emergency_contact_number")
    @classmethod
    def validate_phone_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^\+?[1-9]\d{1,14}$", v):
            raise ValueError("Invalid phone number format")
        return v

class CustomerProfileResponse(CustomerProfileBase):
    id: str
    user_id: str
    profile_image: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class MechanicProfileBase(BaseModel):
    garage_name: str
    owner_name: str
    experience_years: int = Field(..., ge=0)
    bio: Optional[str] = None
    specialization: str
    supported_vehicle_types: List[str]
    address: str
    city: str
    state: str
    country: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    service_radius_km: float = Field(..., gt=0.0)
    working_start_time: str
    working_end_time: str

    @field_validator("supported_vehicle_types")
    @classmethod
    def validate_vehicle_types(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("Must support at least one vehicle type")
        valid_types = {"Bike", "Car", "EV", "Truck", "Scooter"}
        for vt in v:
            if vt not in valid_types:
                raise ValueError(f"Invalid vehicle type: {vt}. Must be one of {valid_types}")
        return v
        
    @field_validator("working_start_time", "working_end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError("Invalid time format. Use HH:MM (24-hour)")
        return v

class MechanicProfileCreate(MechanicProfileBase):
    pass

class MechanicProfileUpdate(BaseModel):
    garage_name: Optional[str] = None
    owner_name: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0)
    bio: Optional[str] = None
    specialization: Optional[str] = None
    supported_vehicle_types: Optional[List[str]] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    service_radius_km: Optional[float] = Field(None, gt=0.0)
    working_start_time: Optional[str] = None
    working_end_time: Optional[str] = None
    is_available: Optional[bool] = None

    @field_validator("supported_vehicle_types")
    @classmethod
    def validate_vehicle_types(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            if not v:
                raise ValueError("Must support at least one vehicle type")
            valid_types = {"Bike", "Car", "EV", "Truck", "Scooter"}
            for vt in v:
                if vt not in valid_types:
                    raise ValueError(f"Invalid vehicle type: {vt}. Must be one of {valid_types}")
        return v

    @field_validator("working_start_time", "working_end_time")
    @classmethod
    def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError("Invalid time format. Use HH:MM (24-hour)")
        return v

class MechanicProfileResponse(MechanicProfileBase):
    id: str
    user_id: str
    is_available: bool
    is_verified: bool
    average_rating: float
    total_reviews: int
    completed_jobs: int

    model_config = ConfigDict(from_attributes=True)
