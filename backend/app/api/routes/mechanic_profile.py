from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.repositories.profile import MechanicProfileRepository
from app.services.profile import MechanicProfileService
from app.schemas.profile import (
    AvailabilityResponse,
    AvailabilityUpdate,
    LocationUpdate,
    MechanicProfileCreate,
    MechanicProfileResponse,
    MechanicProfileUpdate,
)
from app.schemas.response import ResponseModel
from app.api.deps import get_current_mechanic
from app.models.user import User

router = APIRouter()

def get_profile_service(db: AsyncSession = Depends(get_db)) -> MechanicProfileService:
    repo = MechanicProfileRepository(db)
    return MechanicProfileService(repo)

@router.get("/", response_model=ResponseModel[MechanicProfileResponse])
async def get_my_profile(
    current_user: User = Depends(get_current_mechanic),
    service: MechanicProfileService = Depends(get_profile_service)
):
    profile = await service.get_profile(str(current_user.id))
    return ResponseModel(
        data=MechanicProfileResponse.model_validate(profile)
    )

@router.put("/", response_model=ResponseModel[MechanicProfileResponse], status_code=status.HTTP_200_OK)
async def upsert_my_profile(
    profile_in: MechanicProfileCreate,
    current_user: User = Depends(get_current_mechanic),
    service: MechanicProfileService = Depends(get_profile_service)
):
    profile = await service.upsert_profile(str(current_user.id), profile_in)
    return ResponseModel(
        message="Profile updated successfully",
        data=MechanicProfileResponse.model_validate(profile)
    )

@router.patch("/location", response_model=ResponseModel[MechanicProfileResponse])
async def update_my_location(
    location_in: LocationUpdate,
    current_user: User = Depends(get_current_mechanic),
    service: MechanicProfileService = Depends(get_profile_service)
):
    profile = await service.update_location(str(current_user.id), location_in.latitude, location_in.longitude)
    return ResponseModel(
        message="Location updated successfully",
        data=MechanicProfileResponse.model_validate(profile)
    )


@router.get("/availability", response_model=ResponseModel[AvailabilityResponse])
async def get_my_availability(
    current_user: User = Depends(get_current_mechanic),
    service: MechanicProfileService = Depends(get_profile_service)
):
    is_available = await service.get_availability(str(current_user.id))
    return ResponseModel(data=AvailabilityResponse(is_available=is_available))


@router.patch("/availability", response_model=ResponseModel[AvailabilityResponse])
async def set_my_availability(
    availability_in: AvailabilityUpdate,
    current_user: User = Depends(get_current_mechanic),
    service: MechanicProfileService = Depends(get_profile_service)
):
    """Only the authenticated mechanic can change their own availability.

    The user id comes from the bearer token, never from the request body, so
    there is no path to toggling another mechanic's state.
    """
    profile = await service.set_availability(str(current_user.id), availability_in.is_available)
    return ResponseModel(
        message="Availability updated successfully",
        data=AvailabilityResponse(is_available=profile.is_available),
    )
