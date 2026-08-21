from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Float, cast, func, select, update
from typing import List, Optional, Tuple
from app.models.profile import CustomerProfile, MechanicProfile
from app.models.vehicle import VehicleType

# Mean Earth radius used for the Haversine calculation.
EARTH_RADIUS_KM = 6371.0
from app.schemas.profile import CustomerProfileCreate, CustomerProfileUpdate, MechanicProfileCreate, MechanicProfileUpdate

class CustomerProfileRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_user_id(self, user_id: str) -> Optional[CustomerProfile]:
        result = await self.session.execute(
            select(CustomerProfile).where(CustomerProfile.user_id == user_id)
        )
        return result.scalars().first()

    async def create(self, user_id: str, profile_in: CustomerProfileCreate) -> CustomerProfile:
        profile = CustomerProfile(user_id=user_id, **profile_in.model_dump())
        self.session.add(profile)
        await self.session.commit()
        await self.session.refresh(profile)
        return profile

    async def update(self, db_profile: CustomerProfile, profile_in: CustomerProfileUpdate) -> CustomerProfile:
        update_data = profile_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_profile, field, value)
        await self.session.commit()
        await self.session.refresh(db_profile)
        return db_profile

    async def update_location(self, db_profile: CustomerProfile, latitude: float, longitude: float) -> CustomerProfile:
        db_profile.latitude = latitude
        db_profile.longitude = longitude
        await self.session.commit()
        await self.session.refresh(db_profile)
        return db_profile

    async def update_image(self, db_profile: CustomerProfile, profile_image: str) -> CustomerProfile:
        db_profile.profile_image = profile_image
        await self.session.commit()
        await self.session.refresh(db_profile)
        return db_profile

class MechanicProfileRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, profile_id) -> Optional[MechanicProfile]:
        result = await self.session.execute(
            select(MechanicProfile).where(MechanicProfile.id == profile_id)
        )
        return result.scalars().first()

    async def get_by_user_id(self, user_id: str) -> Optional[MechanicProfile]:
        result = await self.session.execute(
            select(MechanicProfile).where(MechanicProfile.user_id == user_id)
        )
        return result.scalars().first()

    async def create(self, user_id: str, profile_in: MechanicProfileCreate) -> MechanicProfile:
        profile = MechanicProfile(user_id=user_id, **profile_in.model_dump())
        self.session.add(profile)
        await self.session.commit()
        await self.session.refresh(profile)
        return profile

    async def update(self, db_profile: MechanicProfile, profile_in: MechanicProfileUpdate) -> MechanicProfile:
        update_data = profile_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_profile, field, value)
        await self.session.commit()
        await self.session.refresh(db_profile)
        return db_profile

    async def update_location(self, db_profile: MechanicProfile, latitude: float, longitude: float) -> MechanicProfile:
        db_profile.latitude = latitude
        db_profile.longitude = longitude
        await self.session.commit()
        await self.session.refresh(db_profile)
        return db_profile

    async def update_availability(self, db_profile: MechanicProfile, is_available: bool) -> MechanicProfile:
        db_profile.is_available = is_available
        await self.session.commit()
        await self.session.refresh(db_profile)
        return db_profile


    async def find_nearby(
        self,
        latitude: float,
        longitude: float,
        vehicle_type: VehicleType,
        limit: int = 50,
    ) -> List[Tuple[MechanicProfile, float]]:
        """Available mechanics covering (latitude, longitude) for `vehicle_type`.

        Distance is great-circle (Haversine) computed in SQL, not Euclidean on raw
        lat/lon degrees. PostGIS is not available on this deployment, so the formula
        is expressed with standard trigonometric functions; `least(1.0, ...)` clamps
        the acos domain against floating-point overshoot at distance ~0.
        """
        lat_rad = func.radians(cast(MechanicProfile.latitude, Float))
        lon_rad = func.radians(cast(MechanicProfile.longitude, Float))
        origin_lat = func.radians(float(latitude))
        origin_lon = func.radians(float(longitude))

        cosine = (
            func.cos(origin_lat) * func.cos(lat_rad) * func.cos(lon_rad - origin_lon)
            + func.sin(origin_lat) * func.sin(lat_rad)
        )
        distance_km = (EARTH_RADIUS_KM * func.acos(func.least(1.0, cosine))).label("distance_km")

        stmt = (
            select(MechanicProfile, distance_km)
            .where(
                MechanicProfile.is_available.is_(True),
                MechanicProfile.latitude.isnot(None),
                MechanicProfile.longitude.isnot(None),
                MechanicProfile.supported_vehicle_types.contains([vehicle_type]),
                distance_km <= MechanicProfile.service_radius_km,
            )
            .order_by(distance_km)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [(row[0], float(row[1])) for row in result.all()]
