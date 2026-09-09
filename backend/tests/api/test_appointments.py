"""Scheduled Service — catalogue, slots, lifecycle, ownership, payment.

Emergency booking has its own suite (`test_bookings.py`); nothing here touches it.
"""

from datetime import date, datetime, time, timedelta

import pytest

from app.core.security import create_access_token, get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.appointment import (
    Appointment, AppointmentStatus, PaymentStatus, ServicePackage, ServiceType,
)
from app.models.profile import MechanicProfile
from app.models.user import User, UserRole
from app.models.vehicle import VehicleType
from app.services.payment_gateway import StubGateway
from app.services.service_catalog import seed_rows

URL = "/api/v1/appointments"


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def token_for(user):
    return create_access_token(subject=str(user.id))


async def make_user(email, role):
    async with AsyncSessionLocal() as s:
        u = User(email=email, phone_number=f"+1777{abs(hash(email)) % 10**7:07d}",
                 hashed_password=get_password_hash("password"), role=role)
        s.add(u); await s.commit(); await s.refresh(u)
        return u


async def make_mechanic(email="sched-mech@e.com", types=(VehicleType.BIKE, VehicleType.CAR),
                        available=True, start="09:00", end="18:00"):
    user = await make_user(email, UserRole.MECHANIC)
    async with AsyncSessionLocal() as s:
        p = MechanicProfile(
            user_id=user.id, garage_name="Scheduled Garage", owner_name="O",
            experience_years=5, specialization="General", supported_vehicle_types=list(types),
            address="1 Rd", city="Ahmedabad", state="GJ", country="India",
            latitude=23.02, longitude=72.57, service_radius_km=25.0,
            working_start_time=start, working_end_time=end, is_available=available)
        s.add(p); await s.commit(); await s.refresh(p)
        return user, p


@pytest.fixture(autouse=True)
async def catalogue():
    """The catalogue is seeded by migration 0008; the test schema is built from
    the models, so seed it from the same single source the migration uses."""
    async with AsyncSessionLocal() as s:
        for row in seed_rows():
            s.add(ServicePackage(**row))
        await s.commit()


def next_weekday() -> date:
    """A date safely in the future, so 'today' never makes slots vanish mid-run."""
    return date.today() + timedelta(days=2)


async def create_appointment(client, customer_token, profile, *, service=ServiceType.CAR
                             if False else ServiceType.BASIC, vehicle=VehicleType.CAR,
                             start="10:00", on=None, description=None):
    body = {
        "mechanic_profile_id": str(profile.id),
        "service_type": service.value,
        "vehicle_type": vehicle.value,
        "appointment_date": (on or next_weekday()).isoformat(),
        "start_time": start,
    }
    if description:
        body["description"] = description
    return await client.post(f"{URL}/", json=body, headers=auth(customer_token))


# ----------------------------------------------------------------- timezone

async def test_slots_endpoint_uses_the_local_clock_not_utc(client, customer_token, monkeypatch):
    """Regression: the service compared local wall-clock slots against UTC.

    Pinned at the service boundary because that is where the wrong clock was
    read. At 14:00 IST the same instant is 08:30 UTC, so a UTC clock re-offered
    every slot from 09:00 onwards — all of them already past locally.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo
    import app.services.appointment as appointment_service

    _, profile = await make_mechanic(start="09:00", end="18:00")
    today = date.today()
    two_pm_ist = datetime(today.year, today.month, today.day, 14, 0,
                          tzinfo=ZoneInfo("Asia/Kolkata"))
    monkeypatch.setattr(appointment_service, "local_now", lambda: two_pm_ist)

    r = await client.get(
        f"{URL}/slots?mechanic_profile_id={profile.id}&service_type=BASIC"
        f"&vehicle_type=CAR&appointment_date={today.isoformat()}",
        headers=auth(customer_token))

    slots = r.json()["data"]["slots"]
    assert "09:00:00" not in slots and "13:00:00" not in slots
    assert slots and slots[0] >= "14:00:00"


async def test_creating_a_slot_already_past_locally_is_refused(client, customer_token,
                                                               monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    import app.services.appointment as appointment_service

    _, profile = await make_mechanic(start="09:00", end="18:00")
    today = date.today()
    monkeypatch.setattr(appointment_service, "local_now",
                        lambda: datetime(today.year, today.month, today.day, 14, 0,
                                         tzinfo=ZoneInfo("Asia/Kolkata")))

    r = await client.post(f"{URL}/", json={
        "mechanic_profile_id": str(profile.id), "service_type": "BASIC",
        "vehicle_type": "CAR", "appointment_date": today.isoformat(),
        "start_time": "09:00",
    }, headers=auth(customer_token))
    assert r.status_code == 422
    assert "past" in r.json()["detail"]


# ------------------------------------------------------------------ catalogue

async def test_catalogue_exposes_the_four_service_types(client, customer_token):
    r = await client.get(f"{URL}/service-packages", headers=auth(customer_token))
    assert r.status_code == 200
    packages = r.json()["data"]["packages"]
    assert {p["service_type"] for p in packages} == {
        "BASIC", "FULL", "ENGINE_CHECKUP", "CUSTOM"}


async def test_pricing_is_vehicle_specific(client, customer_token):
    r = await client.get(f"{URL}/service-packages", headers=auth(customer_token))
    by_key = {(p["service_type"], p["vehicle_type"]): p for p in r.json()["data"]["packages"]}
    bike = by_key[("FULL", "BIKE")]["price_minor"]
    car = by_key[("FULL", "CAR")]["price_minor"]
    assert bike and car and bike != car


async def test_custom_service_has_no_fabricated_price(client, customer_token):
    r = await client.get(f"{URL}/service-packages", headers=auth(customer_token))
    custom = [p for p in r.json()["data"]["packages"] if p["service_type"] == "CUSTOM"]
    assert custom and all(p["price_minor"] is None for p in custom)


async def test_catalogue_can_be_filtered_by_vehicle_type(client, customer_token):
    r = await client.get(f"{URL}/service-packages?vehicle_type=BIKE", headers=auth(customer_token))
    assert {p["vehicle_type"] for p in r.json()["data"]["packages"]} == {"BIKE"}


# ---------------------------------------------------------------------- slots

async def test_slots_respect_working_hours(client, customer_token):
    _, profile = await make_mechanic(start="09:00", end="12:00")
    r = await client.get(
        f"{URL}/slots?mechanic_profile_id={profile.id}&service_type=BASIC"
        f"&vehicle_type=CAR&appointment_date={next_weekday().isoformat()}",
        headers=auth(customer_token))
    assert r.status_code == 200
    data = r.json()["data"]
    # A 90-minute CAR basic service in a 09:00-12:00 window: 09:00, 09:30, 10:00, 10:30.
    assert data["slots"] == ["09:00:00", "09:30:00", "10:00:00", "10:30:00"]
    assert data["duration_minutes"] == 90


async def test_booked_slot_disappears_from_availability(client, customer_token):
    _, profile = await make_mechanic()
    await create_appointment(client, customer_token, profile, start="10:00")
    r = await client.get(
        f"{URL}/slots?mechanic_profile_id={profile.id}&service_type=BASIC"
        f"&vehicle_type=CAR&appointment_date={next_weekday().isoformat()}",
        headers=auth(customer_token))
    slots = r.json()["data"]["slots"]
    # The booking runs 10:00-11:30, so every overlapping start is gone.
    assert "10:00:00" not in slots and "10:30:00" not in slots and "11:00:00" not in slots
    assert "11:30:00" in slots


async def test_past_date_offers_no_slots(client, customer_token):
    _, profile = await make_mechanic()
    past = (date.today() - timedelta(days=1)).isoformat()
    r = await client.get(
        f"{URL}/slots?mechanic_profile_id={profile.id}&service_type=BASIC"
        f"&vehicle_type=CAR&appointment_date={past}", headers=auth(customer_token))
    assert r.json()["data"]["slots"] == []


async def test_slots_refused_for_unsupported_vehicle_type(client, customer_token):
    _, profile = await make_mechanic(types=(VehicleType.CAR,))
    r = await client.get(
        f"{URL}/slots?mechanic_profile_id={profile.id}&service_type=BASIC"
        f"&vehicle_type=BIKE&appointment_date={next_weekday().isoformat()}",
        headers=auth(customer_token))
    assert r.status_code == 409


# --------------------------------------------------------------------- create

async def test_fixed_price_appointment_is_priced_by_the_server(client, customer_token):
    _, profile = await make_mechanic()
    r = await create_appointment(client, customer_token, profile)
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["status"] == "PAYMENT_PENDING"
    assert data["payment_status"] == "PENDING"
    assert data["price_minor"] == 149900          # catalogue CAR basic
    assert data["end_time"] == "11:30:00"          # 90 minutes after 10:00


async def test_price_cannot_be_supplied_by_the_client(client, customer_token):
    _, profile = await make_mechanic()
    r = await client.post(f"{URL}/", json={
        "mechanic_profile_id": str(profile.id), "service_type": "BASIC",
        "vehicle_type": "CAR", "appointment_date": next_weekday().isoformat(),
        "start_time": "10:00", "price_minor": 1,
    }, headers=auth(customer_token))
    assert r.status_code == 201
    # The injected amount is ignored entirely.
    assert r.json()["data"]["price_minor"] == 149900


async def test_custom_service_starts_unpriced_and_requires_a_description(client, customer_token):
    _, profile = await make_mechanic()
    missing = await create_appointment(client, customer_token, profile,
                                       service=ServiceType.CUSTOM)
    assert missing.status_code == 422

    ok = await create_appointment(client, customer_token, profile, service=ServiceType.CUSTOM,
                                  description="Rattling noise over bumps")
    assert ok.status_code == 201
    assert ok.json()["data"]["status"] == "REQUESTED"
    assert ok.json()["data"]["price_minor"] is None
    assert ok.json()["data"]["payment_status"] == "NOT_REQUIRED"


async def test_appointment_outside_working_hours_is_refused(client, customer_token):
    _, profile = await make_mechanic(start="09:00", end="12:00")
    r = await create_appointment(client, customer_token, profile, start="11:30")
    assert r.status_code == 409
    assert "working hours" in r.json()["detail"]


async def test_appointment_in_the_past_is_refused(client, customer_token):
    _, profile = await make_mechanic()
    r = await create_appointment(client, customer_token, profile,
                                 on=date.today() - timedelta(days=1))
    assert r.status_code == 422


async def test_unavailable_mechanic_takes_no_appointments(client, customer_token):
    _, profile = await make_mechanic(available=False)
    r = await create_appointment(client, customer_token, profile)
    assert r.status_code == 409


async def test_double_booking_the_same_slot_is_refused(client, customer_token):
    _, profile = await make_mechanic()
    other = await make_user("other-customer@e.com", UserRole.CUSTOMER)
    first = await create_appointment(client, customer_token, profile, start="10:00")
    assert first.status_code == 201

    second = await create_appointment(client, token_for(other), profile, start="10:00")
    assert second.status_code == 409
    assert "just been taken" in second.json()["detail"]


async def test_overlapping_slot_is_refused(client, customer_token):
    _, profile = await make_mechanic()
    other = await make_user("overlap-customer@e.com", UserRole.CUSTOMER)
    await create_appointment(client, customer_token, profile, start="10:00")  # 10:00-11:30
    r = await create_appointment(client, token_for(other), profile, start="11:00")
    assert r.status_code == 409


async def test_two_simultaneous_requests_cannot_both_take_one_slot(client, customer_token):
    """The real race, not a sequential stand-in.

    Both requests read the slot as free before either writes, so the service
    layer's pre-check cannot separate them — only the partial unique index can.
    Exactly one must win; the other must get a clean 409 rather than a 500 or a
    second active appointment.
    """
    import asyncio

    _, profile = await make_mechanic()
    rival = await make_user("race-customer@e.com", UserRole.CUSTOMER)
    body = {
        "mechanic_profile_id": str(profile.id), "service_type": "BASIC",
        "vehicle_type": "CAR", "appointment_date": next_weekday().isoformat(),
        "start_time": "10:00",
    }

    first, second = await asyncio.gather(
        client.post(f"{URL}/", json=body, headers=auth(customer_token)),
        client.post(f"{URL}/", json=body, headers=auth(token_for(rival))),
        return_exceptions=True,
    )
    codes = sorted(r.status_code for r in (first, second))
    assert codes == [201, 409], codes

    # And the database holds exactly one appointment for that slot.
    async with AsyncSessionLocal() as s:
        from sqlalchemy import func, select
        count = await s.execute(
            select(func.count()).select_from(Appointment).where(
                Appointment.mechanic_id == profile.user_id,
                Appointment.start_time == time(10, 0),
            ))
        assert count.scalar() == 1


async def test_cancelled_appointment_frees_its_slot(client, customer_token):
    _, profile = await make_mechanic()
    created = await create_appointment(client, customer_token, profile, start="10:00")
    appointment_id = created.json()["data"]["id"]
    await client.post(f"{URL}/{appointment_id}/cancel", headers=auth(customer_token))

    other = await make_user("second-chance@e.com", UserRole.CUSTOMER)
    again = await create_appointment(client, token_for(other), profile, start="10:00")
    assert again.status_code == 201


# ------------------------------------------------------------------ ownership

async def test_customer_cannot_see_another_customers_appointment(client, customer_token):
    _, profile = await make_mechanic()
    created = await create_appointment(client, customer_token, profile)
    intruder = await make_user("intruder@e.com", UserRole.CUSTOMER)

    r = await client.get(f"{URL}/{created.json()['data']['id']}",
                         headers=auth(token_for(intruder)))
    assert r.status_code == 404


async def test_mechanic_cannot_touch_another_mechanics_appointment(client, customer_token):
    _, profile = await make_mechanic()
    created = await create_appointment(client, customer_token, profile)
    stranger, _ = await make_mechanic(email="stranger-mech@e.com")

    r = await client.post(f"{URL}/{created.json()['data']['id']}/decline",
                          headers=auth(token_for(stranger)))
    assert r.status_code == 404


async def test_listing_is_scoped_to_the_caller(client, customer_token):
    _, profile = await make_mechanic()
    await create_appointment(client, customer_token, profile)
    stranger = await make_user("nobody@e.com", UserRole.CUSTOMER)

    r = await client.get(f"{URL}/", headers=auth(token_for(stranger)))
    assert r.json()["data"]["appointments"] == []


async def test_customer_cannot_invoke_mechanic_transitions(client, customer_token):
    _, profile = await make_mechanic()
    created = await create_appointment(client, customer_token, profile)
    r = await client.post(f"{URL}/{created.json()['data']['id']}/accept",
                          headers=auth(customer_token))
    assert r.status_code == 403


# ------------------------------------------------------------------- payment

async def checkout_payload(client, customer_token, appointment_id):
    """The payload a completed checkout hands back, signed as the gateway would."""
    order = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    assert order.status_code == 200
    order_id = order.json()["data"]["order_id"]
    payment_id = f"pay_test_{appointment_id[:8]}"
    return {"order_id": order_id, "payment_id": payment_id,
            "signature": StubGateway().sign(order_id, payment_id)}


async def pay(client, customer_token, appointment_id):
    """Drive a full, signature-verified payment through the stub gateway."""
    payload = await checkout_payload(client, customer_token, appointment_id)
    return await client.post(f"{URL}/{appointment_id}/payment-confirm", json=payload,
                             headers=auth(customer_token))


async def test_payment_order_amount_comes_from_the_server(client, customer_token):
    _, profile = await make_mechanic()
    created = await create_appointment(client, customer_token, profile)
    r = await client.post(f"{URL}/{created.json()['data']['id']}/payment-order",
                          headers=auth(customer_token))
    assert r.json()["data"]["amount_minor"] == 149900


async def test_repeated_payment_order_reuses_the_outstanding_one(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    first = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    second = await client.post(f"{URL}/{appointment_id}/payment-order",
                               headers=auth(customer_token))
    assert first.json()["data"]["order_id"] == second.json()["data"]["order_id"]


async def test_verified_payment_confirms_the_appointment(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    r = await pay(client, customer_token, appointment_id)
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "PAYMENT_CONFIRMED"
    assert r.json()["data"]["payment_status"] == "PAID"


async def test_forged_signature_is_rejected(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    order = await client.post(f"{URL}/{appointment_id}/payment-order",
                              headers=auth(customer_token))
    r = await client.post(f"{URL}/{appointment_id}/payment-confirm", json={
        "order_id": order.json()["data"]["order_id"],
        "payment_id": "pay_forged", "signature": "not-a-real-signature",
    }, headers=auth(customer_token))
    assert r.status_code == 402

    after = await client.get(f"{URL}/{appointment_id}", headers=auth(customer_token))
    assert after.json()["data"]["payment_status"] == "FAILED"
    assert after.json()["data"]["status"] == "PAYMENT_PENDING"


async def test_confirming_the_same_payment_twice_is_idempotent(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    payload = await checkout_payload(client, customer_token, appointment_id)
    first = await client.post(f"{URL}/{appointment_id}/payment-confirm", json=payload,
                              headers=auth(customer_token))
    assert first.json()["data"]["payment_status"] == "PAID"

    # Replaying the identical confirmation — a retried request or a redelivered
    # webhook — must succeed without crediting the appointment a second time.
    again = await client.post(f"{URL}/{appointment_id}/payment-confirm", json=payload,
                              headers=auth(customer_token))
    assert again.status_code == 200
    assert again.json()["data"]["status"] == "PAYMENT_CONFIRMED"

    async with AsyncSessionLocal() as s:
        from sqlalchemy import func, select
        from app.models.appointment import Payment
        paid = await s.execute(select(func.count()).select_from(Payment).where(
            Payment.status == PaymentStatus.PAID))
        assert paid.scalar() == 1


async def test_payment_is_refused_for_an_unpayable_appointment(client, customer_token):
    _, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile,
                                               service=ServiceType.CUSTOM,
                                               description="Needs a look")
                      ).json()["data"]["id"]
    # A custom request has no price until it is quoted.
    r = await client.post(f"{URL}/{appointment_id}/payment-order", headers=auth(customer_token))
    assert r.status_code == 409


# ------------------------------------------------------------------ lifecycle

async def test_fixed_price_lifecycle(client, customer_token):
    mechanic, profile = await make_mechanic()
    m = auth(token_for(mechanic))
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    await pay(client, customer_token, appointment_id)

    assert (await client.post(f"{URL}/{appointment_id}/accept", headers=m)
            ).json()["data"]["status"] == "CONFIRMED"
    assert (await client.post(f"{URL}/{appointment_id}/start", headers=m)
            ).json()["data"]["status"] == "IN_SERVICE"
    done = await client.post(f"{URL}/{appointment_id}/complete", headers=m)
    assert done.json()["data"]["status"] == "COMPLETED"
    assert done.json()["data"]["payment_status"] == "PAID"


async def test_custom_quotation_lifecycle(client, customer_token):
    mechanic, profile = await make_mechanic()
    m = auth(token_for(mechanic))
    appointment_id = (await create_appointment(
        client, customer_token, profile, service=ServiceType.CUSTOM,
        description="Clutch slipping")).json()["data"]["id"]

    quoted = await client.post(f"{URL}/{appointment_id}/quote", json={"amount": 2500.0},
                               headers=m)
    assert quoted.json()["data"]["status"] == "QUOTED"
    assert quoted.json()["data"]["price_minor"] == 250000

    accepted = await client.post(f"{URL}/{appointment_id}/accept-quotation",
                                 headers=auth(customer_token))
    assert accepted.json()["data"]["status"] == "PAYMENT_PENDING"

    paid = await pay(client, customer_token, appointment_id)
    assert paid.json()["data"]["status"] == "PAYMENT_CONFIRMED"
    assert (await client.post(f"{URL}/{appointment_id}/accept", headers=m)
            ).json()["data"]["status"] == "CONFIRMED"


async def test_fixed_price_service_cannot_be_quoted(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    r = await client.post(f"{URL}/{appointment_id}/quote", json={"amount": 1.0},
                          headers=auth(token_for(mechanic)))
    assert r.status_code == 409


async def test_declining_paid_work_owes_a_refund(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    await pay(client, customer_token, appointment_id)

    declined = await client.post(f"{URL}/{appointment_id}/decline",
                                 headers=auth(token_for(mechanic)))
    assert declined.json()["data"]["status"] == "DECLINED"
    assert declined.json()["data"]["payment_status"] == "REFUND_PENDING"


async def test_terminal_appointment_cannot_be_moved(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    await client.post(f"{URL}/{appointment_id}/cancel", headers=auth(customer_token))
    r = await client.post(f"{URL}/{appointment_id}/accept", headers=auth(token_for(mechanic)))
    assert r.status_code == 409
    assert "already CANCELLED" in r.json()["detail"]


async def test_service_cannot_start_before_it_is_confirmed(client, customer_token):
    mechanic, profile = await make_mechanic()
    appointment_id = (await create_appointment(client, customer_token, profile)
                      ).json()["data"]["id"]
    r = await client.post(f"{URL}/{appointment_id}/start", headers=auth(token_for(mechanic)))
    assert r.status_code == 409


async def test_scheduled_service_does_not_appear_in_emergency_bookings(client, customer_token):
    """The two flows share infrastructure but never share state."""
    _, profile = await make_mechanic()
    await create_appointment(client, customer_token, profile)
    r = await client.get("/api/v1/bookings/", headers=auth(customer_token))
    assert r.json()["data"]["bookings"] == []
