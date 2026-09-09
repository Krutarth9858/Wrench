from datetime import date as Date, time as Time
from typing import List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import (
    Appointment, AppointmentStatus, Payment, PaymentStatus, ServicePackage, ServiceType,
    WebhookEvent,
)
from app.models.vehicle import VehicleType
from app.services.appointment_state import BLOCKING_STATUSES


class ServicePackageRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_active(self, vehicle_type: Optional[VehicleType] = None
                          ) -> List[ServicePackage]:
        stmt = select(ServicePackage).where(ServicePackage.is_active.is_(True))
        if vehicle_type:
            stmt = stmt.where(ServicePackage.vehicle_type == vehicle_type)
        result = await self.session.execute(stmt.order_by(ServicePackage.name))
        return list(result.scalars().all())

    async def get(self, service_type: ServiceType, vehicle_type: VehicleType
                  ) -> Optional[ServicePackage]:
        result = await self.session.execute(
            select(ServicePackage).where(
                ServicePackage.service_type == service_type,
                ServicePackage.vehicle_type == vehicle_type,
                ServicePackage.is_active.is_(True),
            )
        )
        return result.scalars().first()


class AppointmentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, appointment_id: UUID) -> Optional[Appointment]:
        result = await self.session.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        return result.scalars().first()

    async def list_for_customer(self, customer_id: UUID) -> List[Appointment]:
        result = await self.session.execute(
            select(Appointment)
            .where(Appointment.customer_id == customer_id)
            .order_by(Appointment.scheduled_date.desc(), Appointment.start_time.desc())
        )
        return list(result.scalars().all())

    async def list_for_mechanic(self, mechanic_id: UUID) -> List[Appointment]:
        result = await self.session.execute(
            select(Appointment)
            .where(Appointment.mechanic_id == mechanic_id)
            .order_by(Appointment.scheduled_date.asc(), Appointment.start_time.asc())
        )
        return list(result.scalars().all())

    async def booked_ranges(self, mechanic_id: UUID, on_date: Date
                            ) -> Sequence[Tuple[Time, Time]]:
        """Time ranges that still hold the mechanic's calendar on `on_date`."""
        result = await self.session.execute(
            select(Appointment.start_time, Appointment.end_time).where(
                Appointment.mechanic_id == mechanic_id,
                Appointment.scheduled_date == on_date,
                Appointment.status.in_(tuple(BLOCKING_STATUSES)),
            )
        )
        return [(row[0], row[1]) for row in result.all()]

    async def create(self, appointment: Appointment) -> Appointment:
        self.session.add(appointment)
        await self.session.commit()
        await self.session.refresh(appointment)
        return appointment

    async def save(self, appointment: Appointment) -> Appointment:
        await self.session.commit()
        await self.session.refresh(appointment)
        return appointment


class PaymentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, payment: Payment) -> Payment:
        self.session.add(payment)
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def get_by_order(self, order_id: str) -> Optional[Payment]:
        result = await self.session.execute(
            select(Payment).where(Payment.provider_order_id == order_id)
        )
        return result.scalars().first()

    async def get_by_provider_payment_id(self, payment_id: str) -> Optional[Payment]:
        result = await self.session.execute(
            select(Payment).where(Payment.provider_payment_id == payment_id)
        )
        return result.scalars().first()

    async def pending_for_appointment(self, appointment_id: UUID) -> Optional[Payment]:
        result = await self.session.execute(
            select(Payment)
            .where(Payment.appointment_id == appointment_id,
                   Payment.status == PaymentStatus.PENDING)
            .order_by(Payment.created_at.desc())
        )
        return result.scalars().first()

    async def paid_for_appointment(self, appointment_id: UUID) -> Optional[Payment]:
        """The settled payment, if any — the only thing a refund can target."""
        result = await self.session.execute(
            select(Payment)
            .where(Payment.appointment_id == appointment_id,
                   Payment.status.in_((PaymentStatus.PAID, PaymentStatus.REFUND_PENDING,
                                       PaymentStatus.REFUND_INITIATED,
                                       PaymentStatus.REFUND_FAILED,
                                       PaymentStatus.REFUNDED)))
            .order_by(Payment.created_at.desc())
        )
        return result.scalars().first()

    async def save(self, payment: Payment) -> Payment:
        await self.session.commit()
        await self.session.refresh(payment)
        return payment


class WebhookEventRepository:
    """Records which gateway events have been processed.

    `record_once` returns False when the event has been seen before, which is
    how repeated delivery becomes a no-op.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def record_once(self, provider: str, event_id: str, event_type: str) -> bool:
        self.session.add(WebhookEvent(provider=provider, event_id=event_id,
                                      event_type=event_type))
        try:
            await self.session.commit()
            return True
        except IntegrityError:
            # The unique index refused a duplicate: already handled.
            await self.session.rollback()
            return False
