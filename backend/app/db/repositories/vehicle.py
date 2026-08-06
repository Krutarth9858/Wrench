from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List, Optional
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate

class VehicleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: str, vehicle_in: VehicleCreate, is_default: bool = False) -> Vehicle:
        vehicle = Vehicle(
            user_id=user_id,
            **vehicle_in.model_dump(),
            is_default=is_default
        )
        self.session.add(vehicle)
        await self.session.commit()
        await self.session.refresh(vehicle)
        return vehicle

    async def get_by_id(self, vehicle_id: str) -> Optional[Vehicle]:
        result = await self.session.execute(
            select(Vehicle).where(Vehicle.id == vehicle_id)
        )
        return result.scalars().first()

    async def get_all_by_user(self, user_id: str) -> List[Vehicle]:
        result = await self.session.execute(
            select(Vehicle).where(Vehicle.user_id == user_id).order_by(Vehicle.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_registration_number(self, user_id: str, registration_number: str) -> Optional[Vehicle]:
        result = await self.session.execute(
            select(Vehicle).where(
                Vehicle.user_id == user_id,
                Vehicle.registration_number == registration_number
            )
        )
        return result.scalars().first()

    async def update(self, db_vehicle: Vehicle, vehicle_in: VehicleUpdate) -> Vehicle:
        update_data = vehicle_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_vehicle, field, value)
        await self.session.commit()
        await self.session.refresh(db_vehicle)
        return db_vehicle

    async def delete(self, db_vehicle: Vehicle) -> None:
        await self.session.delete(db_vehicle)
        await self.session.commit()

    async def unset_default_for_user(self, user_id: str) -> None:
        await self.session.execute(
            update(Vehicle)
            .where(Vehicle.user_id == user_id, Vehicle.is_default == True)
            .values(is_default=False)
        )
        await self.session.commit()

    async def set_default(self, db_vehicle: Vehicle) -> Vehicle:
        db_vehicle.is_default = True
        await self.session.commit()
        await self.session.refresh(db_vehicle)
        return db_vehicle
