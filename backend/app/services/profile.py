from fastapi import HTTPException, status
from app.db.repositories.profile import CustomerProfileRepository, MechanicProfileRepository
from app.schemas.profile import CustomerProfileCreate, CustomerProfileUpdate, MechanicProfileCreate, MechanicProfileUpdate
from app.models.profile import CustomerProfile, MechanicProfile

class CustomerProfileService:
    def __init__(self, profile_repo: CustomerProfileRepository):
        self.profile_repo = profile_repo

    async def get_profile(self, user_id: str) -> CustomerProfile:
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found")
        return profile

    async def upsert_profile(self, user_id: str, profile_in: CustomerProfileCreate) -> CustomerProfile:
        profile = await self.profile_repo.get_by_user_id(user_id)
        if profile:
            update_data = CustomerProfileUpdate(**profile_in.model_dump())
            return await self.profile_repo.update(profile, update_data)
        return await self.profile_repo.create(user_id, profile_in)

    async def update_location(self, user_id: str, latitude: float, longitude: float) -> CustomerProfile:
        profile = await self.get_profile(user_id)
        return await self.profile_repo.update_location(profile, latitude, longitude)

    async def update_image(self, user_id: str, image_url: str) -> CustomerProfile:
        profile = await self.get_profile(user_id)
        return await self.profile_repo.update_image(profile, image_url)


class MechanicProfileService:
    def __init__(self, profile_repo: MechanicProfileRepository):
        self.profile_repo = profile_repo

    async def get_profile(self, user_id: str) -> MechanicProfile:
        profile = await self.profile_repo.get_by_user_id(user_id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mechanic profile not found")
        return profile

    async def upsert_profile(self, user_id: str, profile_in: MechanicProfileCreate) -> MechanicProfile:
        profile = await self.profile_repo.get_by_user_id(user_id)
        if profile:
            update_data = MechanicProfileUpdate(**profile_in.model_dump())
            return await self.profile_repo.update(profile, update_data)
        return await self.profile_repo.create(user_id, profile_in)

    async def update_location(self, user_id: str, latitude: float, longitude: float) -> MechanicProfile:
        profile = await self.get_profile(user_id)
        return await self.profile_repo.update_location(profile, latitude, longitude)
