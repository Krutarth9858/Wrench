import enum
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base

class VehicleType(str, enum.Enum):
    BIKE = "BIKE"
    CAR = "CAR"

class FuelType(str, enum.Enum):
    PETROL = "PETROL"
    DIESEL = "DIESEL"
    CNG = "CNG"
    ELECTRIC = "ELECTRIC"
    HYBRID = "HYBRID"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    vehicle_type = Column(Enum(VehicleType), nullable=False)
    brand = Column(String, nullable=False)
    model = Column(String, nullable=False)
    fuel_type = Column(Enum(FuelType), nullable=False)
    
    registration_number = Column(String(20), nullable=True)
    nickname = Column(String(50), nullable=True)
    
    is_default = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
