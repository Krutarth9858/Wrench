from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.booking import BookingStatus
from app.models.vehicle import FuelType, VehicleType


class BookingCreate(BaseModel):
    """The mechanic is identified by their public profile id, which is what
    discovery (FR-02) returns. The customer is taken from the bearer token."""

    mechanic_profile_id: UUID
    # Chosen in the booking flow; no saved vehicle required.
    vehicle_type: VehicleType
    problem_description: str = Field(..., min_length=5, max_length=2000)
    service_latitude: float = Field(..., ge=-90.0, le=90.0)
    service_longitude: float = Field(..., ge=-180.0, le=180.0)
    service_address: Optional[str] = Field(None, max_length=500)


class BookingVehicle(BaseModel):
    id: UUID
    vehicle_type: VehicleType
    brand: str
    model: str
    fuel_type: FuelType
    registration_number: Optional[str] = None
    nickname: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BookingParty(BaseModel):
    """Minimal counterpart details. Contact data is intentionally limited."""

    name: str
    phone_number: Optional[str] = None


class BookingResponse(BaseModel):
    id: UUID
    status: BookingStatus
    problem_description: str
    service_latitude: float
    service_longitude: float
    service_address: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    vehicle_type: VehicleType
    # Present only when the booking was linked to a saved vehicle.
    vehicle: Optional[BookingVehicle] = None
    customer: BookingParty
    mechanic: BookingParty

    model_config = ConfigDict(from_attributes=True)


class BookingListResponse(BaseModel):
    bookings: List[BookingResponse]
