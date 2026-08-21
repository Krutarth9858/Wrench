"""Booking endpoints (RAD FR-03 / FR-05).

Status is never accepted from the client. Each transition is a distinct intent
endpoint whose allowed source states are enforced by services/booking_state.py.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer, get_current_mechanic, get_current_user
from app.db.repositories.booking import BookingRepository
from app.db.repositories.profile import MechanicProfileRepository
from app.db.repositories.user import UserRepository
from app.db.repositories.vehicle import VehicleRepository
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingListResponse,
    BookingResponse,
    BookingVehicle,
)
from app.schemas.response import ResponseModel
from app.services.booking import BookingService
from app.services.booking_events import emit_booking_event

router = APIRouter()


def get_booking_service(db: AsyncSession = Depends(get_db)) -> BookingService:
    return BookingService(
        BookingRepository(db), VehicleRepository(db), MechanicProfileRepository(db),
        UserRepository(db),
    )


async def _present(booking: Booking, service: BookingService, db: AsyncSession) -> BookingResponse:
    # A booking need not reference a saved vehicle; vehicle_type is the authority.
    vehicle = (
        await VehicleRepository(db).get_by_id(str(booking.vehicle_id))
        if booking.vehicle_id
        else None
    )
    customer, mechanic = await service.party_details(booking)
    return BookingResponse(
        id=booking.id,
        status=booking.status,
        problem_description=booking.problem_description,
        service_latitude=float(booking.service_latitude),
        service_longitude=float(booking.service_longitude),
        service_address=booking.service_address,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
        vehicle_type=booking.vehicle_type,
        vehicle=BookingVehicle.model_validate(vehicle) if vehicle else None,
        customer=customer,
        mechanic=mechanic,
    )


async def _present_all(bookings, service, db) -> List[BookingResponse]:
    return [await _present(b, service, db) for b in bookings]


# ---------------------------------------------------------------- customer

@router.post("/", response_model=ResponseModel[BookingResponse],
             status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_in: BookingCreate,
    current_user: User = Depends(get_current_customer),
    service: BookingService = Depends(get_booking_service),
    db: AsyncSession = Depends(get_db),
):
    booking = await service.create(current_user, booking_in)
    # Committed by now; a delivery failure must not affect the response.
    await emit_booking_event(booking, "BOOKING_CREATED")
    return ResponseModel(message="Booking requested", data=await _present(booking, service, db))


@router.get("/", response_model=ResponseModel[BookingListResponse])
async def list_my_bookings(
    booking_status: Optional[List[BookingStatus]] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    service: BookingService = Depends(get_booking_service),
    db: AsyncSession = Depends(get_db),
):
    """Customers see the bookings they raised; mechanics see the ones assigned to them."""
    bookings = await service.list_for(current_user, booking_status)
    return ResponseModel(
        data=BookingListResponse(bookings=await _present_all(bookings, service, db))
    )


@router.get("/{booking_id}", response_model=ResponseModel[BookingResponse])
async def get_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    service: BookingService = Depends(get_booking_service),
    db: AsyncSession = Depends(get_db),
):
    booking = await service.get(booking_id, current_user)
    return ResponseModel(data=await _present(booking, service, db))


@router.post("/{booking_id}/cancel", response_model=ResponseModel[BookingResponse])
async def cancel_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_customer),
    service: BookingService = Depends(get_booking_service),
    db: AsyncSession = Depends(get_db),
):
    booking = await service.transition(booking_id, current_user, BookingStatus.CANCELLED)
    await emit_booking_event(booking)
    return ResponseModel(message="Booking cancelled", data=await _present(booking, service, db))


# ---------------------------------------------------------------- mechanic

def _mechanic_action(target: BookingStatus, message: str):
    async def action(
        booking_id: UUID,
        current_user: User = Depends(get_current_mechanic),
        service: BookingService = Depends(get_booking_service),
        db: AsyncSession = Depends(get_db),
    ):
        # A rejected transition raises before this point, so no event is emitted.
        booking = await service.transition(booking_id, current_user, target)
        await emit_booking_event(booking)
        return ResponseModel(message=message, data=await _present(booking, service, db))

    return action


router.add_api_route("/{booking_id}/accept", _mechanic_action(BookingStatus.ACCEPTED, "Booking accepted"),
                     methods=["POST"], response_model=ResponseModel[BookingResponse])
router.add_api_route("/{booking_id}/reject", _mechanic_action(BookingStatus.REJECTED, "Booking rejected"),
                     methods=["POST"], response_model=ResponseModel[BookingResponse])
router.add_api_route("/{booking_id}/start", _mechanic_action(BookingStatus.IN_PROGRESS, "Service started"),
                     methods=["POST"], response_model=ResponseModel[BookingResponse])
router.add_api_route("/{booking_id}/complete", _mechanic_action(BookingStatus.COMPLETED, "Service completed"),
                     methods=["POST"], response_model=ResponseModel[BookingResponse])
