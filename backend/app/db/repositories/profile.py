from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional
from app.models.profile import CustomerProfile, MechanicProfile
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
