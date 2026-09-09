"""Scheduled Service: service packages, appointments and payments.

This is a second, separate booking mode. Emergency roadside assistance keeps its
own table (`bookings`), its own status enum and its own state machine; nothing
here touches them. The two flows share infrastructure — users, mechanic profiles,
the realtime channel — but never share state.

Money is stored in minor units (paise) as an integer. Floats are not a currency.
"""

import enum
import uuid

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum as SQLEnum, ForeignKey, Index, Integer,
    Numeric, String, Text, Time, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from app.db.session import Base
from app.models.vehicle import VehicleType


class ServiceType(str, enum.Enum):
    """The four Scheduled Service categories. CUSTOM alone has no fixed price."""

    BASIC = "BASIC"
    FULL = "FULL"
    ENGINE_CHECKUP = "ENGINE_CHECKUP"
    CUSTOM = "CUSTOM"


class AppointmentStatus(str, enum.Enum):
    """Scheduled Service lifecycle — deliberately disjoint from BookingStatus.

    Fixed price:  PAYMENT_PENDING -> PAYMENT_CONFIRMED -> CONFIRMED -> IN_SERVICE -> COMPLETED
    Custom:       REQUESTED -> QUOTED -> PAYMENT_PENDING -> ... (as above)
    Terminal:     COMPLETED | DECLINED (mechanic) | CANCELLED (customer)
    """

    REQUESTED = "REQUESTED"
    QUOTED = "QUOTED"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    CONFIRMED = "CONFIRMED"
    IN_SERVICE = "IN_SERVICE"
    COMPLETED = "COMPLETED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    """Payment state of an appointment, distinct from its scheduling state."""

    NOT_REQUIRED = "NOT_REQUIRED"   # custom request before a quotation exists
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    # Refund lifecycle. REFUND_PENDING means "we owe one"; REFUND_INITIATED
    # means the gateway has accepted it; only REFUNDED means the money is back.
    # Nothing marks REFUNDED without the provider saying so.
    REFUND_PENDING = "REFUND_PENDING"
    REFUND_INITIATED = "REFUND_INITIATED"
    REFUNDED = "REFUNDED"
    REFUND_FAILED = "REFUND_FAILED"


class ServicePackage(Base):
    """A priced, vehicle-specific service offering.

    The price authority. The frontend renders what this table says and the
    backend charges what this table says; a price is never accepted from a
    client. Rows are seeded by migration so the amounts can be changed centrally
    without touching application logic (see `app/services/service_catalog.py`).
    """

    __tablename__ = "service_packages"
    __table_args__ = (
        # One active price per (service, vehicle type).
        UniqueConstraint("service_type", "vehicle_type", name="uq_service_package_type_vehicle"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_type = Column(SQLEnum(ServiceType), nullable=False, index=True)
    vehicle_type = Column(SQLEnum(VehicleType), nullable=False, index=True)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    included_items = Column(ARRAY(String), nullable=False)
    best_for = Column(Text, nullable=False)

    # NULL for CUSTOM: the mechanic quotes it. Minor units (paise).
    price_minor = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, nullable=False)

    is_active = Column(Boolean, nullable=False, default=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Appointment(Base):
    """A booked service slot.

    `scheduled_date` + `start_time`/`end_time` are real appointment columns
    rather than a reading of created_at, so slots can be computed and conflicts
    detected. A partial unique index (see migration 0008) makes double-booking
    the same mechanic and slot impossible at the database level.
    """

    __tablename__ = "appointments"
    __table_args__ = (
        # Declared here as well as in migration 0008 so the schema the test suite
        # builds from the models carries the same guarantee the real database has.
        Index(
            "uq_appointment_active_slot",
            "mechanic_id", "scheduled_date", "start_time",
            unique=True,
            postgresql_where=text(
                "status IN ('REQUESTED', 'QUOTED', 'PAYMENT_PENDING', "
                "'PAYMENT_CONFIRMED', 'CONFIRMED', 'IN_SERVICE')"
            ),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    customer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    mechanic_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)

    # Denormalised from the package so historical rows keep their meaning even if
    # the catalogue is re-priced or retired later.
    service_package_id = Column(UUID(as_uuid=True),
                                ForeignKey("service_packages.id", ondelete="SET NULL"),
                                nullable=True, index=True)
    service_type = Column(SQLEnum(ServiceType), nullable=False, index=True)
    vehicle_type = Column(SQLEnum(VehicleType), nullable=False, index=True)

    scheduled_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    # Required for CUSTOM (what the customer needs), optional otherwise.
    description = Column(Text, nullable=True)

    service_latitude = Column(Numeric(9, 6), nullable=True)
    service_longitude = Column(Numeric(9, 6), nullable=True)
    service_address = Column(String, nullable=True)

    status = Column(SQLEnum(AppointmentStatus), nullable=False,
                    default=AppointmentStatus.REQUESTED, index=True)
    payment_status = Column(SQLEnum(PaymentStatus), nullable=False,
                            default=PaymentStatus.NOT_REQUIRED, index=True)

    # The amount actually payable, fixed at creation from the catalogue, or set
    # by the mechanic's quotation for CUSTOM. Never supplied by a client.
    price_minor = Column(Integer, nullable=True)
    quoted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WebhookEvent(Base):
    """One row per gateway webhook actually processed.

    Razorpay retries delivery until it gets a 2xx, so the same event arrives
    more than once as a matter of course. The unique `event_id` is what makes
    reprocessing a no-op rather than a second credit or a second refund.
    """

    __tablename__ = "webhook_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String, nullable=False)
    #: The gateway's own event id (Razorpay sends `x-razorpay-event-id`).
    event_id = Column(String, nullable=False, unique=True)
    event_type = Column(String, nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now())


class Payment(Base):
    """One payment attempt against an appointment.

    `provider_payment_id` is uniquely indexed: that is what makes a repeated
    verification call or a redelivered webhook idempotent rather than a second
    credit against the same appointment.
    """

    __tablename__ = "appointment_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"),
                            nullable=False, index=True)

    provider = Column(String, nullable=False)
    provider_order_id = Column(String, nullable=False, index=True)
    # NULL until the gateway reports a payment for the order.
    provider_payment_id = Column(String, nullable=True, unique=True)

    amount_minor = Column(Integer, nullable=False)
    currency = Column(String, nullable=False, default="INR")

    status = Column(SQLEnum(PaymentStatus), nullable=False,
                    default=PaymentStatus.PENDING, index=True)
    failure_reason = Column(String, nullable=True)

    # Set once the gateway accepts a refund. Uniquely indexed for the same
    # reason as provider_payment_id: a retried refund must not create a second.
    provider_refund_id = Column(String, nullable=True, unique=True)
    refunded_amount_minor = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
