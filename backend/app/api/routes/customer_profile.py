from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.repositories.profile import CustomerProfileRepository
from app.services.profile import CustomerProfileService
from app.schemas.profile import CustomerProfileCreate, CustomerProfileUpdate, CustomerProfileResponse, LocationUpdate, ImageUpdate
from app.schemas.response import ResponseModel
from app.api.deps import get_current_customer
from app.models.user import User

router = APIRouter()

def get_profile_service(db: AsyncSession = Depends(get_db)) -> CustomerProfileService:
    repo = CustomerProfileRepository(db)
    return CustomerProfileService(repo)

@router.get("/", response_model=ResponseModel[CustomerProfileResponse])
async def get_my_profile(
    current_user: User = Depends(get_current_customer),
    service: CustomerProfileService = Depends(get_profile_service)
):
    profile = await service.get_profile(str(current_user.id))
    return ResponseModel(
        data=CustomerProfileResponse.model_validate(profile)
    )

@router.put("/", response_model=ResponseModel[CustomerProfileResponse], status_code=status.HTTP_200_OK)
async def upsert_my_profile(
    profile_in: CustomerProfileCreate,
    current_user: User = Depends(get_current_customer),
    service: CustomerProfileService = Depends(get_profile_service)
):
    profile = await service.upsert_profile(str(current_user.id), profile_in)
    return ResponseModel(
        message="Profile updated successfully",
        data=CustomerProfileResponse.model_validate(profile)
    )

@router.patch("/location", response_model=ResponseModel[CustomerProfileResponse])
async def update_my_location(
    location_in: LocationUpdate,
    current_user: User = Depends(get_current_customer),
    service: CustomerProfileService = Depends(get_profile_service)
):
    profile = await service.update_location(str(current_user.id), location_in.latitude, location_in.longitude)
    return ResponseModel(
        message="Location updated successfully",
        data=CustomerProfileResponse.model_validate(profile)
    )

@router.patch("/image", response_model=ResponseModel[CustomerProfileResponse])
async def update_my_image(
    image_in: ImageUpdate,
    current_user: User = Depends(get_current_customer),
    service: CustomerProfileService = Depends(get_profile_service)
):
    # Using str(image_in.profile_image) because HttpUrl is an object in Pydantic v2
    profile = await service.update_image(str(current_user.id), str(image_in.profile_image))
    return ResponseModel(
        message="Profile image updated successfully",
        data=CustomerProfileResponse.model_validate(profile)
    )
