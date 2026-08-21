from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from app.models.vehicle import VehicleType, FuelType

class VehicleBase(BaseModel):
    vehicle_type: VehicleType
    brand: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    fuel_type: FuelType
    registration_number: Optional[str] = Field(None, max_length=20)
    nickname: Optional[str] = Field(None, max_length=50)

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    vehicle_type: Optional[VehicleType] = None
    brand: Optional[str] = Field(None, min_length=1)
    model: Optional[str] = Field(None, min_length=1)
    fuel_type: Optional[FuelType] = None
    registration_number: Optional[str] = Field(None, max_length=20)
    nickname: Optional[str] = Field(None, max_length=50)

class VehicleResponse(VehicleBase):
    id: UUID
    user_id: UUID
    is_default: bool
    
    model_config = ConfigDict(from_attributes=True)

class VehicleListResponse(BaseModel):
    vehicles: List[VehicleResponse]
