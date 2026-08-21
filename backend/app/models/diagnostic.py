import enum
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SQLEnum, Float, ForeignKey, String, Text, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from app.db.session import Base
from app.models.vehicle import VehicleType


class DiagnosticStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class MessageRole(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class DiagnosticSession(Base):
    """An AI troubleshooting conversation (RAD FR-06).

    No saved Vehicle is required — the customer picks a vehicle type, matching the
    booking flow. Everything the model produces is advisory: the booking, mechanic
    matching and authorization paths never read these fields.
    """

    __tablename__ = "diagnostic_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)

    vehicle_type = Column(SQLEnum(VehicleType), nullable=False)
    problem_description = Column(Text, nullable=False)
    status = Column(SQLEnum(DiagnosticStatus), nullable=False,
                    default=DiagnosticStatus.ACTIVE, index=True)

    # Latest structured result. Null until the model has produced one.
    severity = Column(SQLEnum(Severity), nullable=True)
    confidence = Column(Float, nullable=True)
    needs_mechanic = Column(Boolean, nullable=True)
    possible_causes = Column(ARRAY(String), nullable=False, server_default="{}")
    follow_up_questions = Column(ARRAY(String), nullable=False, server_default="{}")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DiagnosticMessage(Base):
    __tablename__ = "diagnostic_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True),
                        ForeignKey("diagnostic_sessions.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
