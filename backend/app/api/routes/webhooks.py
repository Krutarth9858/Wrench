"""Payment gateway webhooks.

A webhook is an unauthenticated public endpoint: anyone can POST to it. The only
thing that makes a delivery trustworthy is its signature, so nothing here reads
the body until that signature has been verified over the **raw bytes** exactly
as received. Re-serialising the parsed JSON would change whitespace and key
order and could never match.

Deliveries repeat. Razorpay retries until it gets a 2xx, so the same event
arrives more than once as a matter of course; `WebhookEventRepository` records
each event id once and later copies become no-ops.

Failures are answered with 2xx once the event has been recorded, because asking
the gateway to redeliver an event we have already stored achieves nothing.
Anything we could not authenticate gets 400 and no state change.
"""

import logging

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.appointment import (
    AppointmentRepository, PaymentRepository, ServicePackageRepository,
    WebhookEventRepository,
)
from app.db.repositories.profile import MechanicProfileRepository
from app.db.repositories.user import UserRepository
from app.db.session import get_db
from app.services.appointment import AppointmentService
from app.services.appointment_events import emit_appointment_event
from app.services.payment_gateway import get_gateway

logger = logging.getLogger(__name__)
router = APIRouter()

#: Razorpay event names this endpoint acts on. Anything else is acknowledged
#: and ignored rather than treated as an error.
PAID_EVENTS = {"payment.captured", "payment.authorized", "order.paid"}
FAILED_EVENTS = {"payment.failed"}
REFUND_SUCCESS_EVENTS = {"refund.processed"}
REFUND_FAILED_EVENTS = {"refund.failed"}


def _service(db: AsyncSession) -> AppointmentService:
    return AppointmentService(
        AppointmentRepository(db), ServicePackageRepository(db), PaymentRepository(db),
        MechanicProfileRepository(db), UserRepository(db),
    )


def _entity(payload: dict, kind: str) -> dict:
    """Razorpay nests entities as payload.<kind>.entity."""
    return (payload.get("payload", {}) or {}).get(kind, {}).get("entity", {}) or {}


@router.post("/razorpay", status_code=status.HTTP_200_OK)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
    x_razorpay_event_id: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    raw_body = await request.body()

    if not get_gateway().verify_webhook(raw_body, x_razorpay_signature):
        # Never log the body or the signature of an unverified delivery.
        logger.warning("rejected a webhook delivery with an invalid signature")
        return _bad_request("invalid signature")

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001 - malformed body from an unauthenticated caller
        return _bad_request("malformed payload")
    if not isinstance(payload, dict):
        return _bad_request("malformed payload")

    event_type = str(payload.get("event") or "")
    if not event_type:
        return _bad_request("missing event type")

    # Razorpay always sends an event id; fall back to the payment id so a
    # delivery without one is still deduplicated rather than reprocessed.
    event_id = x_razorpay_event_id or f"{event_type}:{_entity(payload, 'payment').get('id', '')}"
    events = WebhookEventRepository(db)
    if not await events.record_once("razorpay", event_id, event_type):
        return {"status": "ignored", "reason": "already processed"}

    payments = PaymentRepository(db)
    service = _service(db)

    if event_type in PAID_EVENTS or event_type in FAILED_EVENTS:
        entity = _entity(payload, "payment")
        order_id, payment_id = entity.get("order_id"), entity.get("id")
        payment = await payments.get_by_order(order_id) if order_id else None
        if not payment:
            # An event for an order this server never created. Acknowledged so
            # the gateway stops retrying; nothing is changed.
            logger.info("webhook for unknown order, ignoring")
            return {"status": "ignored", "reason": "unknown order"}

        if event_type in PAID_EVENTS:
            if payment_id and not payment.provider_payment_id:
                payment.provider_payment_id = payment_id
                await payments.save(payment)
            appointment = await service.apply_gateway_payment(payment)
        else:
            appointment = await service.fail_gateway_payment(
                payment, str(entity.get("error_description") or "payment failed"))

        if appointment:
            await emit_appointment_event(appointment)
        return {"status": "ok"}

    if event_type in REFUND_SUCCESS_EVENTS or event_type in REFUND_FAILED_EVENTS:
        entity = _entity(payload, "refund")
        payment = await payments.get_by_order(entity.get("order_id") or "") \
            if entity.get("order_id") else None
        if not payment and entity.get("payment_id"):
            payment = await payments.get_by_provider_payment_id(entity["payment_id"])
        if not payment:
            return {"status": "ignored", "reason": "unknown refund"}

        appointment = await service.settle_refund(
            payment, succeeded=event_type in REFUND_SUCCESS_EVENTS)
        if appointment:
            await emit_appointment_event(appointment)
        return {"status": "ok"}

    return {"status": "ignored", "reason": "unhandled event"}


def _bad_request(reason: str):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST,
                        content={"status": "rejected", "reason": reason})
