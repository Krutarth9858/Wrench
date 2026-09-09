"""Payment hardening: webhooks, idempotency, refunds and payment-state rules.

Everything here runs against the stub gateway, which implements the *same*
HMAC-SHA256 schemes Razorpay uses (payment signature over "order|payment",
webhook signature over the raw body). The verification code under test is
therefore the production path; only the credentials differ.

These are provider-independent. They do not prove anything about a live
Razorpay account — see the report.
"""

import json
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.core.security import create_access_token, get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.appointment import (
    Appointment, Payment, PaymentStatus, ServicePackage, ServiceType, WebhookEvent,
)
from app.models.profile import MechanicProfile
from app.models.user import User, UserRole
from app.models.vehicle import VehicleType
from app.services.payment_gateway import StubGateway
from app.services.service_catalog import seed_rows

URL = "/api/v1/appointments"
HOOK = "/api/v1/webhooks/razorpay"


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def token_for(user):
    return create_access_token(subject=str(user.id))


async def make_user(email, role):
    async with AsyncSessionLocal() as s:
        u = User(email=email, phone_number=f"+1888{abs(hash(email)) % 10**7:07d}",
                 hashed_password=get_password_hash("password"), role=role)
        s.add(u); await s.commit(); await s.refresh(u)
        return u


async def make_mechanic(email="pay-mech@e.com"):
    user = await make_user(email, UserRole.MECHANIC)
    async with AsyncSessionLocal() as s:
        p = MechanicProfile(
            user_id=user.id, garage_name="Pay Garage", owner_name="O", experience_years=5,
            specialization="General", supported_vehicle_types=[VehicleType.BIKE, VehicleType.CAR],
            address="1 Rd", city="Ahmedabad", state="GJ", country="India",
            latitude=23.02, longitude=72.57, service_radius_km=25.0,
            working_start_time="09:00", working_end_time="18:00", is_available=True)
        s.add(p); await s.commit(); await s.refresh(p)
        return user, p


@pytest.fixture(autouse=True)
async def catalogue():
    async with AsyncSessionLocal() as s:
        for row in seed_rows():
            s.add(ServicePackage(**row))
        await s.commit()


def soon() -> str:
    return (date.today() + timedelta(days=2)).isoformat()


async def book(client, customer_token, profile, start="10:00"):
    r = await client.post(f"{URL}/", json={
        "mechanic_profile_id": str(profile.id), "service_type": "BASIC",
        "vehicle_type": "CAR", "appointment_date": soon(), "start_time": start,
    }, headers=auth(customer_token))
    assert r.status_code == 201, r.text
    return r.json()["data"]["id"]


async def checkout(client, customer_token, appointment_id):
    order = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    order_id = order.json()["data"]["order_id"]
    payment_id = f"pay_{appointment_id[:8]}"
    return {"order_id": order_id, "payment_id": payment_id,
            "signature": StubGateway().sign(order_id, payment_id)}


async def pay(client, customer_token, appointment_id):
    payload = await checkout(client, customer_token, appointment_id)
    r = await client.post(f"{URL}/{appointment_id}/payment-confirm", json=payload,
                          headers=auth(customer_token))
    assert r.status_code == 200, r.text
    return payload


def signed(body: dict):
    """A webhook delivery signed exactly as the gateway would sign it."""
    raw = json.dumps(body).encode()
    return raw, {"x-razorpay-signature": StubGateway().sign_webhook(raw),
                 "x-razorpay-event-id": body.get("_event_id", "evt_test_1"),
                 "content-type": "application/json"}


def payment_event(event: str, order_id: str, payment_id: str, event_id="evt_1"):
    return {"event": event, "_event_id": event_id,
            "payload": {"payment": {"entity": {"id": payment_id, "order_id": order_id,
                                               "error_description": "card declined"}}}}


# ------------------------------------------------------------------- security

async def test_customer_cannot_pay_someone_elses_appointment(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    intruder = await make_user("pay-intruder@e.com", UserRole.CUSTOMER)

    r = await client.post(f"{URL}/{appointment_id}/payment-order",
                          headers=auth(token_for(intruder)))
    assert r.status_code == 404


async def test_order_amount_ignores_anything_the_client_sends(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    r = await client.post(f"{URL}/{appointment_id}/payment-order",
                          json={"amount_minor": 1, "amount": 1, "currency": "USD"},
                          headers=auth(customer_token))
    assert r.json()["data"]["amount_minor"] == 149900
    assert r.json()["data"]["currency"] == "INR"


async def test_a_signature_for_a_different_order_is_rejected(client, customer_token):
    _, profile = await make_mechanic()
    first = await book(client, customer_token, profile, start="10:00")
    second = await book(client, customer_token, profile, start="12:00")
    stolen = await checkout(client, customer_token, first)

    # A validly-signed payload, replayed against a different appointment.
    r = await client.post(f"{URL}/{second}/payment-confirm", json=stolen,
                          headers=auth(customer_token))
    assert r.status_code == 404


async def test_mechanic_cannot_pay_or_price_an_appointment(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    r = await client.post(f"{URL}/{appointment_id}/payment-order",
                          headers=auth(token_for(mechanic)))
    assert r.status_code == 403


async def test_the_api_never_returns_a_secret(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    r = await client.post(f"{URL}/{appointment_id}/payment-order",
                          headers=auth(customer_token))
    body = r.text
    assert "public_key" in body
    assert StubGateway.secret not in body and StubGateway.webhook_secret not in body
    assert "key_secret" not in body and "webhook_secret" not in body


# -------------------------------------------------------------------- webhook

async def test_webhook_with_a_valid_signature_settles_the_payment(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    order = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    order_id = order.json()["data"]["order_id"]

    raw, headers = signed(payment_event("payment.captured", order_id, "pay_hook_1"))
    r = await client.post(HOOK, content=raw, headers=headers)
    assert r.status_code == 200 and r.json()["status"] == "ok"

    after = await client.get(f"{URL}/{appointment_id}", headers=auth(customer_token))
    assert after.json()["data"]["payment_status"] == "PAID"
    assert after.json()["data"]["status"] == "PAYMENT_CONFIRMED"


async def test_webhook_with_a_forged_signature_changes_nothing(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    order = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    order_id = order.json()["data"]["order_id"]

    raw = json.dumps(payment_event("payment.captured", order_id, "pay_forged")).encode()
    r = await client.post(HOOK, content=raw, headers={
        "x-razorpay-signature": "0" * 64, "content-type": "application/json"})
    assert r.status_code == 400

    after = await client.get(f"{URL}/{appointment_id}", headers=auth(customer_token))
    assert after.json()["data"]["payment_status"] == "PENDING"


async def test_signature_is_verified_over_the_raw_body(client):
    """A body signed then re-serialised differently must not verify."""
    body = payment_event("payment.captured", "order_x", "pay_x")
    raw = json.dumps(body).encode()
    signature = StubGateway().sign_webhook(raw)
    # Same object, different bytes — what verifying a reparsed dict would produce.
    reserialised = json.dumps(body, indent=2, sort_keys=True).encode()

    assert StubGateway().verify_webhook(raw, signature) is True
    assert StubGateway().verify_webhook(reserialised, signature) is False


async def test_repeated_webhook_delivery_is_a_no_op(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    order = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    order_id = order.json()["data"]["order_id"]

    raw, headers = signed(payment_event("payment.captured", order_id, "pay_dup",
                                        event_id="evt_repeat"))
    first = await client.post(HOOK, content=raw, headers=headers)
    second = await client.post(HOOK, content=raw, headers=headers)
    third = await client.post(HOOK, content=raw, headers=headers)

    assert first.json()["status"] == "ok"
    assert second.json()["reason"] == "already processed"
    assert third.json()["reason"] == "already processed"

    async with AsyncSessionLocal() as s:
        paid = (await s.execute(select(Payment).where(
            Payment.status == PaymentStatus.PAID))).scalars().all()
        events = (await s.execute(select(WebhookEvent))).scalars().all()
    assert len(paid) == 1
    assert len(events) == 1


async def test_webhook_for_an_unknown_order_is_acknowledged_not_applied(client):
    raw, headers = signed(payment_event("payment.captured", "order_nonexistent", "pay_x",
                                        event_id="evt_unknown"))
    r = await client.post(HOOK, content=raw, headers=headers)
    assert r.status_code == 200 and r.json()["reason"] == "unknown order"


async def test_malformed_webhook_body_is_rejected(client):
    raw = b"this is not json"
    r = await client.post(HOOK, content=raw, headers={
        "x-razorpay-signature": StubGateway().sign_webhook(raw),
        "content-type": "application/json"})
    assert r.status_code == 400
    assert r.json()["reason"] == "malformed payload"


async def test_failed_payment_webhook_records_the_failure(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    order = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    order_id = order.json()["data"]["order_id"]

    raw, headers = signed(payment_event("payment.failed", order_id, "pay_bad",
                                        event_id="evt_failed"))
    r = await client.post(HOOK, content=raw, headers=headers)
    assert r.status_code == 200

    after = await client.get(f"{URL}/{appointment_id}", headers=auth(customer_token))
    assert after.json()["data"]["payment_status"] == "FAILED"
    # The slot is kept so the customer can retry.
    assert after.json()["data"]["status"] == "PAYMENT_PENDING"


async def test_an_unhandled_event_type_is_acknowledged(client):
    raw, headers = signed({"event": "subscription.charged", "_event_id": "evt_other",
                           "payload": {}})
    r = await client.post(HOOK, content=raw, headers=headers)
    assert r.status_code == 200 and r.json()["reason"] == "unhandled event"


# --------------------------------------------------------------------- refund

async def test_declining_paid_work_owes_a_refund_but_does_not_pay_it(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    await pay(client, customer_token, appointment_id)

    r = await client.post(f"{URL}/{appointment_id}/decline", headers=auth(token_for(mechanic)))
    # Owed, not settled — nothing claims the money is back yet.
    assert r.json()["data"]["payment_status"] == "REFUND_PENDING"


async def test_refund_is_initiated_not_immediately_completed(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    await pay(client, customer_token, appointment_id)
    await client.post(f"{URL}/{appointment_id}/decline", headers=auth(token_for(mechanic)))

    r = await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(mechanic)))
    assert r.status_code == 200
    # The gateway has accepted it; only its confirmation may say REFUNDED.
    assert r.json()["data"]["payment_status"] == "REFUND_INITIATED"

    async with AsyncSessionLocal() as s:
        payment = (await s.execute(select(Payment))).scalars().first()
    assert payment.provider_refund_id
    # The amount comes from our record, not from any request.
    assert payment.refunded_amount_minor == 149900


async def test_refund_webhook_settles_it(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    payload = await pay(client, customer_token, appointment_id)
    await client.post(f"{URL}/{appointment_id}/decline", headers=auth(token_for(mechanic)))
    await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(mechanic)))

    raw, headers = signed({
        "event": "refund.processed", "_event_id": "evt_refund",
        "payload": {"refund": {"entity": {"id": "rfnd_1",
                                          "payment_id": payload["payment_id"]}}}})
    r = await client.post(HOOK, content=raw, headers=headers)
    assert r.status_code == 200

    after = await client.get(f"{URL}/{appointment_id}", headers=auth(customer_token))
    assert after.json()["data"]["payment_status"] == "REFUNDED"


async def test_a_failed_refund_webhook_is_recorded_as_failed(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    payload = await pay(client, customer_token, appointment_id)
    await client.post(f"{URL}/{appointment_id}/decline", headers=auth(token_for(mechanic)))
    await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(mechanic)))

    raw, headers = signed({
        "event": "refund.failed", "_event_id": "evt_refund_failed",
        "payload": {"refund": {"entity": {"id": "rfnd_2",
                                          "payment_id": payload["payment_id"]}}}})
    await client.post(HOOK, content=raw, headers=headers)

    after = await client.get(f"{URL}/{appointment_id}", headers=auth(customer_token))
    assert after.json()["data"]["payment_status"] == "REFUND_FAILED"


async def test_refunding_twice_does_not_create_a_second_refund(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    await pay(client, customer_token, appointment_id)
    await client.post(f"{URL}/{appointment_id}/decline", headers=auth(token_for(mechanic)))

    first = await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(mechanic)))
    second = await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(mechanic)))
    assert first.status_code == 200 and second.status_code == 200

    async with AsyncSessionLocal() as s:
        payments = (await s.execute(select(Payment))).scalars().all()
    assert len(payments) == 1
    assert payments[0].status == PaymentStatus.REFUND_INITIATED


async def test_an_unpaid_appointment_has_nothing_to_refund(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    await client.post(f"{URL}/{appointment_id}/cancel", headers=auth(customer_token))

    r = await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(mechanic)))
    assert r.status_code == 409
    assert "no settled payment" in r.json()["detail"]


async def test_a_stranger_cannot_refund_a_payment(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    await pay(client, customer_token, appointment_id)
    await client.post(f"{URL}/{appointment_id}/decline", headers=auth(token_for(mechanic)))

    stranger, _ = await make_mechanic(email="pay-stranger@e.com")
    r = await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(stranger)))
    assert r.status_code == 404


async def test_cancelling_an_already_refunded_appointment_owes_nothing_more(
        client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = await book(client, customer_token, profile)
    await pay(client, customer_token, appointment_id)
    await client.post(f"{URL}/{appointment_id}/decline", headers=auth(token_for(mechanic)))
    await client.post(f"{URL}/{appointment_id}/refund", headers=auth(token_for(mechanic)))

    # The appointment is terminal, so a further cancellation is refused outright
    # and cannot re-queue a refund.
    r = await client.post(f"{URL}/{appointment_id}/cancel", headers=auth(customer_token))
    assert r.status_code == 409

    async with AsyncSessionLocal() as s:
        payment = (await s.execute(select(Payment))).scalars().first()
    assert payment.status == PaymentStatus.REFUND_INITIATED


# ------------------------------------------------------- payment state machine

def test_payment_transitions_are_enforced():
    from fastapi import HTTPException
    from app.services import payment_state as ps

    assert ps.is_allowed(PaymentStatus.PENDING, PaymentStatus.PAID)
    assert ps.is_allowed(PaymentStatus.FAILED, PaymentStatus.PENDING)     # retry
    assert ps.is_allowed(PaymentStatus.PAID, PaymentStatus.REFUND_PENDING)
    # Money can never go straight from paid to refunded, or move once settled.
    assert not ps.is_allowed(PaymentStatus.PAID, PaymentStatus.REFUNDED)
    assert not ps.is_allowed(PaymentStatus.REFUNDED, PaymentStatus.REFUND_PENDING)
    assert not ps.is_allowed(PaymentStatus.PENDING, PaymentStatus.REFUNDED)

    with pytest.raises(HTTPException) as exc:
        ps.assert_transition(PaymentStatus.REFUNDED, PaymentStatus.PAID)
    assert exc.value.status_code == 409
