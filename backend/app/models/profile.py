import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, func, Text, Boolean, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.db.session import Base

class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    full_name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    profile_image = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    
    emergency_contact_name = Column(String, nullable=False)
    emergency_contact_number = Column(String, nullable=False)
    
    address = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    country = Column(String, nullable=False)
    
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class MechanicProfile(Base):
    __tablename__ = "mechanic_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    garage_name = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    experience_years = Column(Integer, nullable=False)
    bio = Column(Text, nullable=True)
    specialization = Column(String, nullable=False)
    supported_vehicle_types = Column(ARRAY(String), nullable=False)
    
    address = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    country = Column(String, nullable=False)
    
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    
    service_radius_km = Column(Float, nullable=False)
    working_start_time = Column(String, nullable=False)
    working_end_time = Column(String, nullable=False)
    
    is_available = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    average_rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    completed_jobs = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
