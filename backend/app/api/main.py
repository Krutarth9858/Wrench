from fastapi import APIRouter
from app.api.routes import health, auth, admin, bookings, customer_profile, diagnostics, mechanic_profile, mechanics, vehicles, ws

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(customer_profile.router, prefix="/profile/customer", tags=["customer profile"])
api_router.include_router(mechanic_profile.router, prefix="/profile/mechanic", tags=["mechanic profile"])
api_router.include_router(mechanics.router, prefix="/mechanics", tags=["mechanic discovery"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(diagnostics.router, prefix="/diagnostics", tags=["ai diagnostics"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(ws.router, prefix="/ws", tags=["realtime"])
