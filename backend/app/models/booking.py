import enum
import uuid

from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base
from app.models.vehicle import VehicleType


class BookingStatus(str, enum.Enum):
    """RAD FR-05 lifecycle. REJECTED is the mechanic's terminal refusal,
    CANCELLED the customer's."""

    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Both parties are referenced by user id, matching how RBAC identifies callers.
    customer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    mechanic_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    # The canonical vehicle type is what the booking actually needs. A customer does
    # not have to own a saved Vehicle to request roadside assistance.
    vehicle_type = Column(SQLEnum(VehicleType), nullable=False, index=True)
    # Optional link to a saved vehicle, kept for existing rows and future use.
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"),
                        nullable=True, index=True)

    problem_description = Column(Text, nullable=False)

    # Where the vehicle actually is, which need not be the customer's saved address.
    service_latitude = Column(Numeric(9, 6), nullable=False)
    service_longitude = Column(Numeric(9, 6), nullable=False)
    service_address = Column(String, nullable=True)

    status = Column(SQLEnum(BookingStatus), nullable=False, default=BookingStatus.PENDING,
                    index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
