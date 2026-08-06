from fastapi import APIRouter
from app.api.routes import health, auth, customer_profile, mechanic_profile, vehicles

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(customer_profile.router, prefix="/profile/customer", tags=["customer profile"])
api_router.include_router(mechanic_profile.router, prefix="/profile/mechanic", tags=["mechanic profile"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
