from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking, BookingStatus


class BookingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, booking_id: UUID) -> Optional[Booking]:
        result = await self.session.execute(select(Booking).where(Booking.id == booking_id))
        return result.scalars().first()

    async def list_for_customer(self, customer_id: UUID) -> List[Booking]:
        result = await self.session.execute(
            select(Booking)
            .where(Booking.customer_id == customer_id)
            .order_by(Booking.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_for_mechanic(
        self, mechanic_id: UUID, statuses: Optional[List[BookingStatus]] = None
    ) -> List[Booking]:
        stmt = select(Booking).where(Booking.mechanic_id == mechanic_id)
        if statuses:
            stmt = stmt.where(Booking.status.in_(statuses))
        result = await self.session.execute(stmt.order_by(Booking.created_at.desc()))
        return list(result.scalars().all())

    async def create(self, booking: Booking) -> Booking:
        self.session.add(booking)
        await self.session.commit()
        await self.session.refresh(booking)
        return booking

    async def set_status(self, booking: Booking, status: BookingStatus) -> Booking:
        booking.status = status
        await self.session.commit()
        await self.session.refresh(booking)
        return booking
