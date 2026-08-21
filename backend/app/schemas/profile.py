from pydantic import BaseModel, HttpUrl, Field, ConfigDict, field_validator, model_validator
from typing import Optional, List
from uuid import UUID

from app.models.vehicle import VehicleType
import re

NULL_ISLAND_ERROR = "Set a real garage location: 0, 0 is in the Atlantic Ocean."


def _reject_null_island(latitude: float, longitude: float) -> None:
    """(0, 0) passes the lat/lon bounds but sits in the Atlantic.

    A profile stored there is silently invisible to discovery forever, because no
    customer is ever inside its service radius. Treat the exact origin as "unset"
    on every write path rather than only at creation.
    """
    if latitude == 0 and longitude == 0:
        raise ValueError(NULL_ISLAND_ERROR)


class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

    @model_validator(mode="after")
    def reject_null_island(self):
        _reject_null_island(self.latitude, self.longitude)
        return self

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
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)

    @field_validator("phone_number", "emergency_contact_number")
    @classmethod
    def validate_phone_number(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^\+?[1-9]\d{1,14}$", v):
            raise ValueError("Invalid phone number format")
        return v

class CustomerProfileResponse(CustomerProfileBase):
    id: UUID
    user_id: UUID
    profile_image: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class MechanicProfileBase(BaseModel):
    garage_name: str
    owner_name: str
    experience_years: int = Field(..., ge=0)
    bio: Optional[str] = None
    specialization: str
    supported_vehicle_types: List[VehicleType] = Field(..., min_length=1)
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
    def deduplicate_vehicle_types(cls, v: List[VehicleType]) -> List[VehicleType]:
        # Order-preserving dedupe; the enum itself rejects out-of-scope categories.
        return list(dict.fromkeys(v))

    
    @field_validator("working_start_time", "working_end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError("Invalid time format. Use HH:MM (24-hour)")
        return v

class MechanicProfileCreate(MechanicProfileBase):
    @model_validator(mode="after")
    def reject_null_island(self):
        """(0, 0) passes the lat/lon bounds but sits in the Atlantic.

        A mechanic saved there is silently invisible to discovery forever, since
        no customer is ever inside their service radius. Rejected on write only:
        `MechanicProfileResponse` shares this base, and profiles already stored at
        0, 0 must remain readable so they can be corrected.
        """
        _reject_null_island(self.latitude, self.longitude)
        return self

class MechanicProfileUpdate(BaseModel):
    garage_name: Optional[str] = None
    owner_name: Optional[str] = None
    experience_years: Optional[int] = Field(None, ge=0)
    bio: Optional[str] = None
    specialization: Optional[str] = None
    supported_vehicle_types: Optional[List[VehicleType]] = Field(None, min_length=1)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    # Without these, upsert_profile() silently discards coordinate changes and
    # still returns 200, leaving a mechanic stranded wherever they first saved.
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    service_radius_km: Optional[float] = Field(None, gt=0.0)
    working_start_time: Optional[str] = None
    working_end_time: Optional[str] = None
    is_available: Optional[bool] = None

    @model_validator(mode="after")
    def reject_null_island(self):
        if self.latitude is not None and self.longitude is not None:
            _reject_null_island(self.latitude, self.longitude)
        return self

    @field_validator("supported_vehicle_types")
    @classmethod
    def deduplicate_vehicle_types(
        cls, v: Optional[List[VehicleType]]
    ) -> Optional[List[VehicleType]]:
        return list(dict.fromkeys(v)) if v is not None else None

    @field_validator("working_start_time", "working_end_time")
    @classmethod
    def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", v):
            raise ValueError("Invalid time format. Use HH:MM (24-hour)")
        return v

class MechanicProfileResponse(MechanicProfileBase):
    id: UUID
    user_id: UUID
    is_available: bool
    is_verified: bool
    average_rating: float
    total_reviews: int
    completed_jobs: int

    model_config = ConfigDict(from_attributes=True)


class AvailabilityUpdate(BaseModel):
    """FR-09: mechanics self-manage their real-time availability."""

    is_available: bool


class AvailabilityResponse(BaseModel):
    is_available: bool

    model_config = ConfigDict(from_attributes=True)


class MechanicSummary(BaseModel):
    """Public projection of a mechanic (FR-02).

    Deliberately omits the street address, owner name, phone and working hours:
    a customer choosing a mechanic needs identity, coverage and location only.
    """

    id: UUID
    garage_name: str
    specialization: str
    city: str
    latitude: float
    longitude: float
    supported_vehicle_types: List[VehicleType]
    is_available: bool
    service_radius_km: float
    experience_years: int
    average_rating: float
    total_reviews: int

    model_config = ConfigDict(from_attributes=True)


class NearbyMechanic(MechanicSummary):
    """A summary plus how far it is from the requesting customer."""

    distance_km: float


class NearbyMechanicList(BaseModel):
    mechanics: List[NearbyMechanic]
