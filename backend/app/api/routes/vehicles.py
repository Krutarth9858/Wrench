from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.db.repositories.vehicle import VehicleRepository
from app.services.vehicle import VehicleService
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse, VehicleListResponse
from app.schemas.response import ResponseModel
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

def get_vehicle_service(db: AsyncSession = Depends(get_db)) -> VehicleService:
    repo = VehicleRepository(db)
    return VehicleService(repo)

@router.post("/", response_model=ResponseModel[VehicleResponse], status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle_in: VehicleCreate,
    current_user: User = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service)
):
    vehicle = await service.create_vehicle(str(current_user.id), vehicle_in)
    return ResponseModel(
        message="Vehicle created successfully",
        data=VehicleResponse.model_validate(vehicle)
    )

@router.get("/", response_model=ResponseModel[VehicleListResponse])
async def list_vehicles(
    current_user: User = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service)
):
    vehicles = await service.get_user_vehicles(str(current_user.id))
    return ResponseModel(
        data=VehicleListResponse(
            vehicles=[VehicleResponse.model_validate(v) for v in vehicles]
        )
    )

@router.get("/{vehicle_id}", response_model=ResponseModel[VehicleResponse])
async def get_vehicle(
    vehicle_id: str,
    current_user: User = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service)
):
    vehicle = await service.get_vehicle(vehicle_id, str(current_user.id))
    return ResponseModel(
        data=VehicleResponse.model_validate(vehicle)
    )

@router.put("/{vehicle_id}", response_model=ResponseModel[VehicleResponse])
async def update_vehicle(
    vehicle_id: str,
    vehicle_in: VehicleUpdate,
    current_user: User = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service)
):
    vehicle = await service.update_vehicle(vehicle_id, str(current_user.id), vehicle_in)
    return ResponseModel(
        message="Vehicle updated successfully",
        data=VehicleResponse.model_validate(vehicle)
    )

@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: str,
    current_user: User = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service)
):
    await service.delete_vehicle(vehicle_id, str(current_user.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.patch("/{vehicle_id}/default", response_model=ResponseModel[VehicleResponse])
async def set_default_vehicle(
    vehicle_id: str,
    current_user: User = Depends(get_current_user),
    service: VehicleService = Depends(get_vehicle_service)
):
    vehicle = await service.set_default_vehicle(vehicle_id, str(current_user.id))
    return ResponseModel(
        message="Vehicle marked as default successfully",
        data=VehicleResponse.model_validate(vehicle)
    )
