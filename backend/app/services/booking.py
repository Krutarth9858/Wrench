"""Booking business rules (RAD FR-03 / FR-05).

Ownership and eligibility are re-derived from the database on every call; nothing
is trusted from the client except the ids it names, and those are re-checked.
"""

from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status as http_status

from app.db.repositories.booking import BookingRepository
from app.db.repositories.profile import MechanicProfileRepository
from app.db.repositories.user import UserRepository
from app.db.repositories.vehicle import VehicleRepository
from app.models.booking import Booking, BookingStatus
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate
from app.services.booking_state import assert_transition


class BookingService:
    def __init__(
        self,
        booking_repo: BookingRepository,
        vehicle_repo: VehicleRepository,
        mechanic_repo: MechanicProfileRepository,
        user_repo: UserRepository,
    ):
        self.booking_repo = booking_repo
        self.vehicle_repo = vehicle_repo
        self.mechanic_repo = mechanic_repo
        self.user_repo = user_repo

    # ------------------------------------------------------------------ create

    async def create(self, customer: User, booking_in: BookingCreate) -> Booking:
        profile = await self.mechanic_repo.get_by_id(booking_in.mechanic_profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Mechanic not found")
        if not profile.is_available:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="This mechanic is not accepting requests right now.",
            )

        # Eligibility is the mechanic's capability, never the customer's saved
        # vehicles. Booking no longer touches the Vehicle table at all.
        if booking_in.vehicle_type not in profile.supported_vehicle_types:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"This mechanic does not service {booking_in.vehicle_type.value} vehicles.",
            )

        booking = Booking(
            customer_id=customer.id,
            mechanic_id=profile.user_id,
            vehicle_type=booking_in.vehicle_type,
            problem_description=booking_in.problem_description,
            service_latitude=booking_in.service_latitude,
            service_longitude=booking_in.service_longitude,
            service_address=booking_in.service_address,
            status=BookingStatus.PENDING,
        )
        return await self.booking_repo.create(booking)

    # ------------------------------------------------------------------ reads

    async def _get_for_party(self, booking_id: UUID, user: User) -> Booking:
        booking = await self.booking_repo.get_by_id(booking_id)
        # A booking is visible only to its two parties. Anything else is a 404 so
        # that ids belonging to other users are not confirmed to exist.
        if not booking or user.id not in (booking.customer_id, booking.mechanic_id):
            raise HTTPException(status_code=404, detail="Booking not found")
        return booking

    async def get(self, booking_id: UUID, user: User) -> Booking:
        return await self._get_for_party(booking_id, user)

    async def list_for(self, user: User, statuses: Optional[List[BookingStatus]] = None):
        if user.role == UserRole.MECHANIC:
            return await self.booking_repo.list_for_mechanic(user.id, statuses)
        return await self.booking_repo.list_for_customer(user.id)

    # ------------------------------------------------------------------ transitions

    async def transition(self, booking_id: UUID, user: User, target: BookingStatus) -> Booking:
        booking = await self._get_for_party(booking_id, user)
        # The role is read from the authenticated user, never from the request, so a
        # customer can never invoke a mechanic-only transition and vice versa.
        assert_transition(user.role, booking.status, target)
        return await self.booking_repo.set_status(booking, target)

    # ------------------------------------------------------------------ presentation

    async def party_details(self, booking: Booking) -> Tuple[dict, dict]:
        """Resolve display details for both parties of a booking."""
        customer = await self.user_repo.get_by_id(str(booking.customer_id))
        mechanic_profile = await self.mechanic_repo.get_by_user_id(booking.mechanic_id)
        mechanic_user = await self.user_repo.get_by_id(str(booking.mechanic_id))
        return (
            {"name": customer.email if customer else "Unknown",
             "phone_number": customer.phone_number if customer else None},
            {"name": mechanic_profile.garage_name if mechanic_profile
             else (mechanic_user.email if mechanic_user else "Unknown"),
             "phone_number": mechanic_user.phone_number if mechanic_user else None},
        )
