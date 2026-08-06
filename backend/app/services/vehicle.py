from fastapi import HTTPException, status
from typing import List
from app.db.repositories.vehicle import VehicleRepository
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.models.vehicle import Vehicle

class VehicleService:
    def __init__(self, vehicle_repo: VehicleRepository):
        self.vehicle_repo = vehicle_repo

    async def _check_duplicate_registration(self, user_id: str, registration_number: str, exclude_vehicle_id: str = None):
        if not registration_number:
            return
        vehicle = await self.vehicle_repo.get_by_registration_number(user_id, registration_number)
        if vehicle and str(vehicle.id) != exclude_vehicle_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vehicle with this registration number already exists."
            )

    async def get_vehicle(self, vehicle_id: str, user_id: str) -> Vehicle:
        vehicle = await self.vehicle_repo.get_by_id(vehicle_id)
        if not vehicle or str(vehicle.user_id) != user_id:
            # We return 404 for not found, and 403 for unauthorized access.
            if not vehicle:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return vehicle

    async def create_vehicle(self, user_id: str, vehicle_in: VehicleCreate) -> Vehicle:
        await self._check_duplicate_registration(user_id, vehicle_in.registration_number)
        
        # If this is the first vehicle, we should probably make it default
        # But wait, the requirements didn't specify auto-default. I will leave it as false unless set explicitly.
        # Actually, let's just create it.
        return await self.vehicle_repo.create(user_id, vehicle_in)

    async def get_user_vehicles(self, user_id: str) -> List[Vehicle]:
        return await self.vehicle_repo.get_all_by_user(user_id)

    async def update_vehicle(self, vehicle_id: str, user_id: str, vehicle_in: VehicleUpdate) -> Vehicle:
        vehicle = await self.get_vehicle(vehicle_id, user_id)
        
        if vehicle_in.registration_number is not None:
            await self._check_duplicate_registration(user_id, vehicle_in.registration_number, exclude_vehicle_id=vehicle_id)
            
        return await self.vehicle_repo.update(vehicle, vehicle_in)

    async def delete_vehicle(self, vehicle_id: str, user_id: str) -> None:
        vehicle = await self.get_vehicle(vehicle_id, user_id)
        await self.vehicle_repo.delete(vehicle)

    async def set_default_vehicle(self, vehicle_id: str, user_id: str) -> Vehicle:
        vehicle = await self.get_vehicle(vehicle_id, user_id)
        if not vehicle.is_default:
            await self.vehicle_repo.unset_default_for_user(user_id)
            vehicle = await self.vehicle_repo.set_default(vehicle)
        return vehicle
