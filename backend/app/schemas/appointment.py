"""Scheduled Service schemas.

No request schema accepts a price or a status. The amount payable is resolved
server-side from (service_type, vehicle_type); the status is decided by the
state machine.
"""

from datetime import date as Date, datetime, time as Time
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.appointment import AppointmentStatus, PaymentStatus, ServiceType
from app.models.vehicle import VehicleType


class ServicePackageResponse(BaseModel):
    id: UUID
    service_type: ServiceType
    vehicle_type: VehicleType
    name: str
    description: str
    included_items: List[str]
    best_for: str
    #: None for CUSTOM — the mechanic quotes it. Minor units.
    price_minor: Optional[int] = None
    duration_minutes: int

    model_config = ConfigDict(from_attributes=True)


class ServicePackageListResponse(BaseModel):
    packages: List[ServicePackageResponse]


class SlotListResponse(BaseModel):
    date: Date
    duration_minutes: int
    #: Start times only; the end is start + duration and is computed server-side.
    slots: List[Time]


class AppointmentCreate(BaseModel):
    mechanic_profile_id: str
    service_type: ServiceType
    vehicle_type: VehicleType
    appointment_date: Date
    start_time: Time
    #: Required for CUSTOM: there is nothing to quote without it.
    description: Optional[str] = Field(None, max_length=2000)
    service_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    service_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    service_address: Optional[str] = None


class QuotationCreate(BaseModel):
    """A mechanic's price for a CUSTOM request, in major units for readability."""

    amount: float = Field(..., gt=0, le=10_000_000)


class PaymentVerification(BaseModel):
    """What the browser hands back from checkout.

    Every field is untrusted: the signature is re-derived server-side with the
    secret key, and the amount is never taken from here.
    """

    order_id: str
    payment_id: str
    signature: str


class PaymentOrderResponse(BaseModel):
    order_id: str
    amount_minor: int
    currency: str
    provider: str
    #: Publishable key for opening checkout. Never the secret.
    public_key: str


class AppointmentParty(BaseModel):
    name: str
    phone_number: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: UUID
    service_type: ServiceType
    service_name: str
    vehicle_type: VehicleType
    appointment_date: Date
    start_time: Time
    end_time: Time
    duration_minutes: int
    description: Optional[str] = None
    service_address: Optional[str] = None
    service_latitude: Optional[float] = None
    service_longitude: Optional[float] = None
    status: AppointmentStatus
    payment_status: PaymentStatus
    #: None until a CUSTOM request has been quoted.
    price_minor: Optional[int] = None
    quoted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    customer: AppointmentParty
    mechanic: AppointmentParty


class AppointmentListResponse(BaseModel):
    appointments: List[AppointmentResponse]
