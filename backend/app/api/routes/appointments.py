"""Scheduled Service endpoints.

Status is never accepted from a client, and neither is a price. Each transition
is a distinct intent endpoint whose legal source states are enforced by
`services/appointment_state.py`; the amount payable is resolved from the
service catalogue server-side.
"""

from datetime import date as Date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer, get_current_mechanic, get_current_user
from app.db.repositories.appointment import (
    AppointmentRepository, PaymentRepository, ServicePackageRepository,
)
from app.db.repositories.profile import MechanicProfileRepository
from app.db.repositories.user import UserRepository
from app.db.session import get_db
from app.models.appointment import Appointment, AppointmentStatus, ServiceType
from app.models.user import User
from app.models.vehicle import VehicleType
from app.schemas.appointment import (
    AppointmentCreate, AppointmentListResponse, AppointmentParty, AppointmentResponse,
    PaymentOrderResponse, PaymentVerification, QuotationCreate, ServicePackageListResponse,
    ServicePackageResponse, SlotListResponse,
)
from app.schemas.response import ResponseModel
from app.services.appointment import AppointmentService
from app.services.appointment_events import emit_appointment_event
from app.services.payment_gateway import StubGateway, get_gateway

router = APIRouter()


def get_appointment_service(db: AsyncSession = Depends(get_db)) -> AppointmentService:
    return AppointmentService(
        AppointmentRepository(db), ServicePackageRepository(db), PaymentRepository(db),
        MechanicProfileRepository(db), UserRepository(db),
    )


async def _present(appointment: Appointment, service: AppointmentService,
                   db: AsyncSession) -> AppointmentResponse:
    package = await ServicePackageRepository(db).get(
        appointment.service_type, appointment.vehicle_type
    )
    customer, mechanic = await service.party_details(appointment)
    start, end = appointment.start_time, appointment.end_time
    duration = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)
    return AppointmentResponse(
        id=appointment.id,
        service_type=appointment.service_type,
        service_name=package.name if package else appointment.service_type.value.title(),
        vehicle_type=appointment.vehicle_type,
        appointment_date=appointment.scheduled_date,
        start_time=start,
        end_time=end,
        duration_minutes=duration,
        description=appointment.description,
        service_address=appointment.service_address,
        service_latitude=float(appointment.service_latitude)
        if appointment.service_latitude is not None else None,
        service_longitude=float(appointment.service_longitude)
        if appointment.service_longitude is not None else None,
        status=appointment.status,
        payment_status=appointment.payment_status,
        price_minor=appointment.price_minor,
        quoted_at=appointment.quoted_at,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
        customer=AppointmentParty(**customer),
        mechanic=AppointmentParty(**mechanic),
    )


# ------------------------------------------------------------------ catalogue

@router.get("/service-packages", response_model=ResponseModel[ServicePackageListResponse])
async def list_service_packages(
    vehicle_type: Optional[VehicleType] = Query(None),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The priced catalogue. This is the only price the UI may display."""
    packages = await ServicePackageRepository(db).list_active(vehicle_type)
    return ResponseModel(data=ServicePackageListResponse(
        packages=[ServicePackageResponse.model_validate(p) for p in packages]
    ))


@router.get("/slots", response_model=ResponseModel[SlotListResponse])
async def list_slots(
    mechanic_profile_id: str = Query(...),
    service_type: ServiceType = Query(...),
    vehicle_type: VehicleType = Query(...),
    appointment_date: Date = Query(...),
    _: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
):
    """Only times that fit the mechanic's working hours and are actually free."""
    slots, duration = await service.slots_for(
        mechanic_profile_id, service_type, vehicle_type, appointment_date
    )
    return ResponseModel(data=SlotListResponse(
        date=appointment_date, duration_minutes=duration, slots=slots,
    ))


# ------------------------------------------------------------------- customer

@router.post("/", response_model=ResponseModel[AppointmentResponse],
             status_code=status.HTTP_201_CREATED)
async def create_appointment(
    data: AppointmentCreate,
    current_user: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    appointment = await service.create(current_user, data)
    await emit_appointment_event(appointment, "APPOINTMENT_REQUESTED")
    return ResponseModel(message="Appointment requested",
                         data=await _present(appointment, service, db))


@router.get("/", response_model=ResponseModel[AppointmentListResponse])
async def list_my_appointments(
    current_user: User = Depends(get_current_user),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    """Customers see their own appointments; mechanics see the ones assigned to them."""
    appointments = await service.list_for(current_user)
    return ResponseModel(data=AppointmentListResponse(
        appointments=[await _present(a, service, db) for a in appointments]
    ))


@router.get("/{appointment_id}", response_model=ResponseModel[AppointmentResponse])
async def get_appointment(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    appointment = await service.get(appointment_id, current_user)
    return ResponseModel(data=await _present(appointment, service, db))


@router.post("/{appointment_id}/cancel", response_model=ResponseModel[AppointmentResponse])
async def cancel_appointment(
    appointment_id: UUID,
    current_user: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    appointment = await service.transition(appointment_id, current_user,
                                           AppointmentStatus.CANCELLED)
    await emit_appointment_event(appointment)
    return ResponseModel(message="Appointment cancelled",
                         data=await _present(appointment, service, db))


@router.post("/{appointment_id}/accept-quotation",
             response_model=ResponseModel[AppointmentResponse])
async def accept_quotation(
    appointment_id: UUID,
    current_user: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    appointment = await service.accept_quotation(appointment_id, current_user)
    await emit_appointment_event(appointment)
    return ResponseModel(message="Quotation accepted",
                         data=await _present(appointment, service, db))


# -------------------------------------------------------------------- payment

@router.post("/{appointment_id}/payment-order",
             response_model=ResponseModel[PaymentOrderResponse])
async def create_payment_order(
    appointment_id: UUID,
    current_user: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
):
    """The amount comes from the server's record, never from the browser."""
    payment = await service.start_payment(appointment_id, current_user)
    return ResponseModel(message="Payment order created", data=PaymentOrderResponse(
        order_id=payment.provider_order_id,
        amount_minor=payment.amount_minor,
        currency=payment.currency,
        provider=payment.provider,
        public_key=get_gateway().public_key,
    ))


@router.post("/{appointment_id}/payment-confirm",
             response_model=ResponseModel[AppointmentResponse])
async def confirm_payment(
    appointment_id: UUID,
    body: PaymentVerification,
    current_user: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    """Verified server-side. Repeat calls for the same payment are idempotent."""
    appointment = await service.confirm_payment(
        appointment_id, current_user, body.order_id, body.payment_id, body.signature,
    )
    await emit_appointment_event(appointment)
    return ResponseModel(message="Payment confirmed",
                         data=await _present(appointment, service, db))


@router.post("/{appointment_id}/payment-failed",
             response_model=ResponseModel[AppointmentResponse])
async def mark_payment_failed(
    appointment_id: UUID,
    current_user: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    """Checkout was dismissed or failed. The slot is kept so it can be retried."""
    appointment = await service.fail_payment(appointment_id, current_user)
    return ResponseModel(message="Payment not completed",
                         data=await _present(appointment, service, db))


@router.post("/{appointment_id}/payment-simulate",
             response_model=ResponseModel[PaymentVerification])
async def simulate_checkout(
    appointment_id: UUID,
    current_user: User = Depends(get_current_customer),
    service: AppointmentService = Depends(get_appointment_service),
):
    """Development-only stand-in for the gateway's checkout UI.

    The stub gateway signs with a server-side secret, so a browser cannot produce
    a valid payload and the flow would be untestable without a payment account.
    This returns what checkout *would* hand back, and then goes through the same
    `/payment-confirm` verification as a real payment — the verification path is
    never bypassed.

    It 404s unless the stub gateway is active, so configuring real Razorpay keys
    removes it entirely. It can never be used to fake a live payment.
    """
    gateway = get_gateway()
    if not isinstance(gateway, StubGateway):
        raise HTTPException(status_code=404, detail="Not found")

    payment = await service.start_payment(appointment_id, current_user)
    payment_id = f"pay_stub_{payment.id.hex[:16]}"
    return ResponseModel(message="Simulated checkout", data=PaymentVerification(
        order_id=payment.provider_order_id,
        payment_id=payment_id,
        signature=gateway.sign(payment.provider_order_id, payment_id),
    ))


# ------------------------------------------------------------------- mechanic

@router.post("/{appointment_id}/quote", response_model=ResponseModel[AppointmentResponse])
async def quote_appointment(
    appointment_id: UUID,
    body: QuotationCreate,
    current_user: User = Depends(get_current_mechanic),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    """A Custom Service quotation. Major units in, minor units stored."""
    appointment = await service.quote(appointment_id, current_user,
                                      amount_minor=int(round(body.amount * 100)))
    await emit_appointment_event(appointment)
    return ResponseModel(message="Quotation sent",
                         data=await _present(appointment, service, db))


@router.post("/{appointment_id}/refund", response_model=ResponseModel[AppointmentResponse])
async def refund_appointment(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    service: AppointmentService = Depends(get_appointment_service),
    db: AsyncSession = Depends(get_db),
):
    """Send an owed refund to the gateway.

    Open to either party of the appointment — both a declining mechanic and a
    cancelling customer can be the one who triggers it — but `service.refund`
    re-derives ownership, and the amount comes from this server's payment
    record, so nobody can refund a payment that is not theirs or name a figure.
    """
    appointment = await service.refund(appointment_id, current_user)
    await emit_appointment_event(appointment)
    return ResponseModel(message="Refund initiated",
                         data=await _present(appointment, service, db))


def _mechanic_action(target: AppointmentStatus, message: str):
    async def action(
        appointment_id: UUID,
        current_user: User = Depends(get_current_mechanic),
        service: AppointmentService = Depends(get_appointment_service),
        db: AsyncSession = Depends(get_db),
    ):
        appointment = await service.transition(appointment_id, current_user, target)
        await emit_appointment_event(appointment)
        return ResponseModel(message=message,
                             data=await _present(appointment, service, db))

    return action


for _path, _target, _message in (
    ("accept", AppointmentStatus.CONFIRMED, "Appointment confirmed"),
    ("decline", AppointmentStatus.DECLINED, "Appointment declined"),
    ("start", AppointmentStatus.IN_SERVICE, "Service started"),
    ("complete", AppointmentStatus.COMPLETED, "Service completed"),
):
    router.add_api_route(
        f"/{{appointment_id}}/{_path}", _mechanic_action(_target, _message),
        methods=["POST"], response_model=ResponseModel[AppointmentResponse],
    )
