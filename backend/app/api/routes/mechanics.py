"""GPS-based mechanic discovery (RAD FR-02).

Read-only. Selecting a mechanic is a client-side concern; nothing here creates a
booking, which is Phase 4.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer
from app.db.repositories.profile import MechanicProfileRepository
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import VehicleType
from app.schemas.profile import NearbyMechanic, NearbyMechanicList
from app.schemas.response import ResponseModel
from app.services.profile import MechanicProfileService

router = APIRouter()


def get_profile_service(db: AsyncSession = Depends(get_db)) -> MechanicProfileService:
    return MechanicProfileService(MechanicProfileRepository(db))


@router.get("/nearby", response_model=ResponseModel[NearbyMechanicList])
async def find_nearby_mechanics(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Customer latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Customer longitude"),
    vehicle_type: VehicleType = Query(..., description="BIKE or CAR"),
    _customer: User = Depends(get_current_customer),
    service: MechanicProfileService = Depends(get_profile_service),
):
    """Available mechanics whose service radius covers the given point.

    Filters applied in SQL: availability, supported vehicle type, present
    coordinates, and Haversine distance within each mechanic's own
    `service_radius_km`. Results are ordered nearest first.
    """
    matches = await service.find_nearby(latitude, longitude, vehicle_type)
    mechanics = [
        NearbyMechanic(
            **{
                field: getattr(profile, field)
                for field in (
                    "id", "garage_name", "specialization", "city",
                    "supported_vehicle_types", "is_available", "service_radius_km",
                    "experience_years", "average_rating", "total_reviews",
                )
            },
            latitude=float(profile.latitude),
            longitude=float(profile.longitude),
            distance_km=round(distance, 2),
        )
        for profile, distance in matches
    ]
    return ResponseModel(data=NearbyMechanicList(mechanics=mechanics))
