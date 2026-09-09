"""Scheduled Service business rules.

Ownership, pricing and scheduling are re-derived from the database on every call.
The client names ids and a slot; everything that matters — the price, the
duration, whether the slot is free, what transition is legal — is decided here.
"""

from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status as http_status
from sqlalchemy.exc import IntegrityError

from app.core.clock import local_now, system_now
from app.db.repositories.appointment import (
    AppointmentRepository, PaymentRepository, ServicePackageRepository,
)
from app.db.repositories.profile import MechanicProfileRepository
from app.db.repositories.user import UserRepository
from app.models.appointment import (
    Appointment, AppointmentStatus, Payment, PaymentStatus, ServicePackage, ServiceType,
)
from app.models.user import User, UserRole
from app.schemas.appointment import AppointmentCreate
from app.services import slots as slot_rules
from app.services.appointment_state import PAYABLE_STATUSES, assert_transition
from app.services import payment_state
from app.services.payment_gateway import PaymentError, get_gateway


class AppointmentService:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        package_repo: ServicePackageRepository,
        payment_repo: PaymentRepository,
        mechanic_repo: MechanicProfileRepository,
        user_repo: UserRepository,
    ):
        self.appointments = appointment_repo
        self.packages = package_repo
        self.payments = payment_repo
        self.mechanics = mechanic_repo
        self.users = user_repo

    # -------------------------------------------------------------- catalogue

    async def package_for(self, service_type: ServiceType, vehicle_type) -> ServicePackage:
        package = await self.packages.get(service_type, vehicle_type)
        if not package:
            raise HTTPException(
                status_code=404,
                detail=f"No {service_type.value} package is offered for this vehicle type.",
            )
        return package

    # ------------------------------------------------------------------ slots

    async def _mechanic_profile(self, mechanic_profile_id: str):
        profile = await self.mechanics.get_by_id(mechanic_profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Mechanic not found")
        return profile

    async def slots_for(self, mechanic_profile_id: str, service_type: ServiceType,
                        vehicle_type, on_date) -> Tuple[List, int]:
        profile = await self._mechanic_profile(mechanic_profile_id)
        if vehicle_type not in profile.supported_vehicle_types:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"This mechanic does not service {vehicle_type.value} vehicles.",
            )
        package = await self.package_for(service_type, vehicle_type)
        taken = await self.appointments.booked_ranges(profile.user_id, on_date)
        available = slot_rules.available_slots(
            working_start=profile.working_start_time,
            working_end=profile.working_end_time,
            duration_minutes=package.duration_minutes,
            taken=taken,
            on_date=on_date,
            now=local_now(),
        )
        return available, package.duration_minutes

    # ----------------------------------------------------------------- create

    async def create(self, customer: User, data: AppointmentCreate) -> Appointment:
        profile = await self._mechanic_profile(data.mechanic_profile_id)
        if not profile.is_available:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="This mechanic is not accepting appointments right now.",
            )
        if data.vehicle_type not in profile.supported_vehicle_types:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"This mechanic does not service {data.vehicle_type.value} vehicles.",
            )
        if data.service_type == ServiceType.CUSTOM and not (data.description or "").strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Describe what your vehicle needs so the mechanic can quote for it.",
            )

        package = await self.package_for(data.service_type, data.vehicle_type)
        end_time = slot_rules.end_time_for(data.start_time, package.duration_minutes)

        now = local_now()
        slot_rules.assert_not_in_past(data.appointment_date, data.start_time, now)
        slot_rules.assert_within_working_hours(
            data.start_time, end_time, profile.working_start_time, profile.working_end_time,
        )

        # Read-then-write is not enough on its own — two customers can both find a
        # slot free. This rejects the common case with a clear message; the unique
        # index below is what actually makes a double booking impossible.
        taken = await self.appointments.booked_ranges(profile.user_id, data.appointment_date)
        if any(slot_rules.overlaps(data.start_time, end_time, s, e) for s, e in taken):
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="That slot has just been taken. Please choose another time.",
            )

        is_custom = data.service_type == ServiceType.CUSTOM
        appointment = Appointment(
            customer_id=customer.id,
            mechanic_id=profile.user_id,
            service_package_id=package.id,
            service_type=data.service_type,
            vehicle_type=data.vehicle_type,
            scheduled_date=data.appointment_date,
            start_time=data.start_time,
            end_time=end_time,
            description=data.description,
            service_latitude=data.service_latitude,
            service_longitude=data.service_longitude,
            service_address=data.service_address,
            # Custom work is quoted before it can be paid for; fixed-price work
            # goes straight to payment at the catalogue price.
            status=AppointmentStatus.REQUESTED if is_custom else AppointmentStatus.PAYMENT_PENDING,
            payment_status=PaymentStatus.NOT_REQUIRED if is_custom else PaymentStatus.PENDING,
            price_minor=None if is_custom else package.price_minor,
        )
        try:
            return await self.appointments.create(appointment)
        except IntegrityError:
            # The partial unique index refused a concurrent identical slot.
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="That slot has just been taken. Please choose another time.",
            )

    # ------------------------------------------------------------------ reads

    async def _for_party(self, appointment_id: UUID, user: User) -> Appointment:
        appointment = await self.appointments.get_by_id(appointment_id)
        # Visible only to its two parties. Anything else is a 404 rather than a
        # 403, so ids belonging to other users are not confirmed to exist.
        if not appointment or user.id not in (appointment.customer_id, appointment.mechanic_id):
            raise HTTPException(status_code=404, detail="Appointment not found")
        return appointment

    async def get(self, appointment_id: UUID, user: User) -> Appointment:
        return await self._for_party(appointment_id, user)

    async def list_for(self, user: User) -> List[Appointment]:
        if user.role == UserRole.MECHANIC:
            return await self.appointments.list_for_mechanic(user.id)
        return await self.appointments.list_for_customer(user.id)

    # ------------------------------------------------------------ transitions

    async def transition(self, appointment_id: UUID, user: User,
                         target: AppointmentStatus) -> Appointment:
        appointment = await self._for_party(appointment_id, user)
        # The role comes from the authenticated user, never the request.
        assert_transition(user.role, appointment.status, target)

        # Declining or cancelling work that was already paid for owes a refund.
        # A refund already owed, in flight or completed is left alone, so a
        # repeated cancellation can never queue a second one.
        if (target in (AppointmentStatus.DECLINED, AppointmentStatus.CANCELLED)
                and appointment.payment_status == PaymentStatus.PAID):
            payment_state.assert_transition(appointment.payment_status,
                                            PaymentStatus.REFUND_PENDING)
            appointment.payment_status = PaymentStatus.REFUND_PENDING
            payment = await self.payments.paid_for_appointment(appointment.id)
            if payment:
                payment.status = PaymentStatus.REFUND_PENDING
                await self.payments.save(payment)

        appointment.status = target
        return await self.appointments.save(appointment)

    # ---------------------------------------------------------------- refunds

    async def refund(self, appointment_id: UUID, actor: User) -> Appointment:
        """Send an owed refund to the gateway.

        The amount comes from this server's payment record — never a request —
        and the refund is only marked REFUNDED when the gateway confirms it.
        Idempotent: a payment that already has a provider refund id is returned
        untouched rather than refunded twice.
        """
        appointment = await self._for_party(appointment_id, actor)
        payment = await self.payments.paid_for_appointment(appointment.id)
        if not payment:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="There is no settled payment to refund.",
            )
        if payment.provider_refund_id:
            return appointment  # already refunded; nothing more to do

        payment_state.assert_transition(payment.status, PaymentStatus.REFUND_INITIATED)

        gateway = get_gateway()
        try:
            # Keyed on the payment, so a retry reaches the same gateway refund.
            refund_id = await gateway.refund(
                payment_id=payment.provider_payment_id or "",
                amount_minor=payment.amount_minor,
                idempotency_key=f"refund-{payment.id}",
            )
        except PaymentError as exc:
            payment.status = PaymentStatus.REFUND_FAILED
            payment.failure_reason = str(exc)[:255]
            await self.payments.save(payment)
            appointment.payment_status = PaymentStatus.REFUND_FAILED
            await self.appointments.save(appointment)
            raise HTTPException(status_code=http_status.HTTP_502_BAD_GATEWAY,
                                detail="The refund could not be started.")

        payment.provider_refund_id = refund_id
        payment.refunded_amount_minor = payment.amount_minor
        # Accepted, not settled. Only the gateway's confirmation moves it on.
        payment.status = PaymentStatus.REFUND_INITIATED
        await self.payments.save(payment)
        appointment.payment_status = PaymentStatus.REFUND_INITIATED
        return await self.appointments.save(appointment)

    async def settle_refund(self, payment: Payment, succeeded: bool) -> Optional[Appointment]:
        """Apply the gateway's final word on a refund (from a webhook)."""
        target = PaymentStatus.REFUNDED if succeeded else PaymentStatus.REFUND_FAILED
        if payment.status == target:
            return None  # already applied
        payment_state.assert_transition(payment.status, target)
        payment.status = target
        await self.payments.save(payment)
        appointment = await self.appointments.get_by_id(payment.appointment_id)
        if appointment:
            appointment.payment_status = target
            return await self.appointments.save(appointment)
        return None

    async def apply_gateway_payment(self, payment: Payment) -> Optional[Appointment]:
        """Mark a payment settled from a gateway webhook.

        The signature on the delivery has already been verified by the caller,
        so this trusts the gateway — not a browser — and is safe to re-run.
        """
        if payment.status == PaymentStatus.PAID:
            return None
        payment_state.assert_transition(payment.status, PaymentStatus.PAID)
        payment.status = PaymentStatus.PAID
        await self.payments.save(payment)

        appointment = await self.appointments.get_by_id(payment.appointment_id)
        if not appointment:
            return None
        appointment.payment_status = PaymentStatus.PAID
        if appointment.status == AppointmentStatus.PAYMENT_PENDING:
            appointment.status = AppointmentStatus.PAYMENT_CONFIRMED
        return await self.appointments.save(appointment)

    async def fail_gateway_payment(self, payment: Payment, reason: str
                                   ) -> Optional[Appointment]:
        if payment.status in (PaymentStatus.PAID, PaymentStatus.FAILED):
            return None
        payment.status = PaymentStatus.FAILED
        payment.failure_reason = reason[:255]
        await self.payments.save(payment)
        appointment = await self.appointments.get_by_id(payment.appointment_id)
        if not appointment:
            return None
        appointment.payment_status = PaymentStatus.FAILED
        return await self.appointments.save(appointment)

    async def quote(self, appointment_id: UUID, mechanic: User, amount_minor: int
                    ) -> Appointment:
        """A mechanic prices a CUSTOM request."""
        appointment = await self._for_party(appointment_id, mechanic)
        if appointment.service_type != ServiceType.CUSTOM:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Only a Custom Service request is quoted; this service has a fixed price.",
            )
        assert_transition(mechanic.role, appointment.status, AppointmentStatus.QUOTED)
        appointment.price_minor = amount_minor
        appointment.quoted_at = system_now()
        appointment.status = AppointmentStatus.QUOTED
        return await self.appointments.save(appointment)

    async def accept_quotation(self, appointment_id: UUID, customer: User) -> Appointment:
        """The customer approves a quotation, which makes the appointment payable."""
        appointment = await self._for_party(appointment_id, customer)
        assert_transition(customer.role, appointment.status, AppointmentStatus.PAYMENT_PENDING)
        if not appointment.price_minor:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="This appointment has not been quoted yet.",
            )
        appointment.status = AppointmentStatus.PAYMENT_PENDING
        appointment.payment_status = PaymentStatus.PENDING
        return await self.appointments.save(appointment)

    # ---------------------------------------------------------------- payment

    async def start_payment(self, appointment_id: UUID, customer: User) -> Payment:
        """Create (or reuse) a gateway order for an appointment awaiting payment.

        Reusing the outstanding order rather than minting a new one on every
        checkout attempt is what keeps a retried checkout from creating a second
        chargeable order for the same appointment.
        """
        appointment = await self._for_party(appointment_id, customer)
        if customer.id != appointment.customer_id:
            raise HTTPException(status_code=403, detail="Only the customer can pay.")
        if appointment.status not in PAYABLE_STATUSES:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"A {appointment.status.value} appointment cannot be paid for.",
            )
        amount = appointment.price_minor
        if not amount:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="This appointment has no amount to pay yet.",
            )

        existing = await self.payments.pending_for_appointment(appointment.id)
        if existing and existing.amount_minor == amount:
            return existing

        gateway = get_gateway()
        try:
            order_id = await gateway.create_order(
                amount_minor=amount, currency="INR", receipt=str(appointment.id),
            )
        except PaymentError as exc:
            raise HTTPException(status_code=http_status.HTTP_502_BAD_GATEWAY, detail=str(exc))

        return await self.payments.create(Payment(
            appointment_id=appointment.id,
            provider=gateway.name,
            provider_order_id=order_id,
            amount_minor=amount,
            currency="INR",
            status=PaymentStatus.PENDING,
        ))

    async def confirm_payment(self, appointment_id: UUID, customer: User,
                              order_id: str, payment_id: str, signature: str
                              ) -> Appointment:
        """Verify a completed payment server-side and confirm it exactly once.

        Nothing here trusts the browser's claim of success: the signature is
        re-derived with the secret key, and the amount charged is the amount this
        server recorded on the order.
        """
        appointment = await self._for_party(appointment_id, customer)

        payment = await self.payments.get_by_order(order_id)
        if not payment or payment.appointment_id != appointment.id:
            raise HTTPException(status_code=404, detail="Unknown payment order.")

        # Idempotency: a retried confirmation or a redelivered webhook for a
        # payment already applied is a success, not a second credit.
        if payment.status == PaymentStatus.PAID:
            return appointment
        duplicate = await self.payments.get_by_provider_payment_id(payment_id)
        if duplicate and duplicate.id != payment.id:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="That payment has already been applied to another appointment.",
            )

        if not get_gateway().verify_signature(order_id, payment_id, signature):
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = "signature verification failed"
            await self.payments.save(payment)
            appointment.payment_status = PaymentStatus.FAILED
            await self.appointments.save(appointment)
            raise HTTPException(
                status_code=http_status.HTTP_402_PAYMENT_REQUIRED,
                detail="Payment could not be verified.",
            )

        payment.provider_payment_id = payment_id
        payment.status = PaymentStatus.PAID
        await self.payments.save(payment)

        appointment.payment_status = PaymentStatus.PAID
        # Paid work still waits for the mechanic to take it on.
        if appointment.status == AppointmentStatus.PAYMENT_PENDING:
            appointment.status = AppointmentStatus.PAYMENT_CONFIRMED
        return await self.appointments.save(appointment)

    async def fail_payment(self, appointment_id: UUID, customer: User,
                           reason: Optional[str] = None) -> Appointment:
        """Record an abandoned or failed checkout without losing the appointment."""
        appointment = await self._for_party(appointment_id, customer)
        payment = await self.payments.pending_for_appointment(appointment.id)
        if payment:
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = (reason or "cancelled at checkout")[:255]
            await self.payments.save(payment)
        appointment.payment_status = PaymentStatus.FAILED
        # The slot is kept: the customer may retry from PAYMENT_PENDING.
        return await self.appointments.save(appointment)

    # ---------------------------------------------------------- presentation

    async def party_details(self, appointment: Appointment) -> Tuple[dict, dict]:
        customer = await self.users.get_by_id(str(appointment.customer_id))
        profile = await self.mechanics.get_by_user_id(appointment.mechanic_id)
        mechanic_user = await self.users.get_by_id(str(appointment.mechanic_id))
        return (
            {"name": customer.email if customer else "Unknown",
             "phone_number": customer.phone_number if customer else None},
            {"name": profile.garage_name if profile
             else (mechanic_user.email if mechanic_user else "Unknown"),
             "phone_number": mechanic_user.phone_number if mechanic_user else None},
        )
