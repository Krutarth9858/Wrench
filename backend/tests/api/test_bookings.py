"""Phase 4 — booking lifecycle, ownership and RBAC (RAD FR-03 / FR-05)."""

import pytest

from app.core.security import create_access_token, get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.booking import BookingStatus
from app.models.profile import MechanicProfile
from app.models.user import User, UserRole
from app.models.vehicle import FuelType, Vehicle, VehicleType

URL = "/api/v1/bookings"


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def make_user(email, role, phone=None):
    async with AsyncSessionLocal() as s:
        u = User(email=email, phone_number=phone or f"+1666{abs(hash(email)) % 10**7:07d}",
                 hashed_password=get_password_hash("password"), role=role)
        s.add(u); await s.commit(); await s.refresh(u)
        return u


async def make_mechanic(email="mech@e.com", types=(VehicleType.CAR,), available=True):
    user = await make_user(email, UserRole.MECHANIC)
    async with AsyncSessionLocal() as s:
        p = MechanicProfile(
            user_id=user.id, garage_name="Garage", owner_name="O", experience_years=5,
            specialization="General", supported_vehicle_types=list(types), address="1 Rd",
            city="Ahmedabad", state="GJ", country="India", latitude=23.02, longitude=72.57,
            service_radius_km=25.0, working_start_time="09:00", working_end_time="18:00",
            is_available=available)
        s.add(p); await s.commit(); await s.refresh(p)
        return user, p


async def make_vehicle(owner, vtype=VehicleType.CAR):
    async with AsyncSessionLocal() as s:
        v = Vehicle(user_id=owner.id, vehicle_type=vtype, brand="Honda", model="City",
                    fuel_type=FuelType.PETROL)
        s.add(v); await s.commit(); await s.refresh(v)
        return v


def token_for(user):
    return create_access_token(subject=str(user.id))


async def book(client, customer_token, profile, vehicle=None, **over):
    payload = {
        "mechanic_profile_id": str(profile.id),
        "vehicle_type": (vehicle.vehicle_type.value if vehicle is not None else "CAR"),
        "problem_description": "Engine will not start",
        "service_latitude": 23.0225,
        "service_longitude": 72.5714,
        "service_address": "Ring Road",
        **over,
    }
    return await client.post(f"{URL}/", json=payload, headers=auth(customer_token))


@pytest.fixture
async def scenario(customer_user, customer_token):
    mech_user, profile = await make_mechanic()
    vehicle = await make_vehicle(customer_user)
    return {
        "customer": customer_user, "customer_token": customer_token,
        "mechanic": mech_user, "mechanic_token": token_for(mech_user),
        "profile": profile, "vehicle": vehicle,
    }


# ------------------------------------------------------------------ create

@pytest.mark.asyncio
async def test_customer_creates_a_pending_booking(client, scenario):
    res = await book(client, scenario["customer_token"], scenario["profile"], scenario["vehicle"])
    assert res.status_code == 201
    d = res.json()["data"]
    assert d["status"] == BookingStatus.PENDING.value
    assert d["vehicle_type"] == "CAR"
    assert d["mechanic"]["name"] == "Garage"
    assert d["problem_description"] == "Engine will not start"


@pytest.mark.asyncio
async def test_a_customer_with_no_saved_vehicles_can_book(client, customer_user, customer_token):
    """Regression: booking used to require a saved Vehicle owned by the customer.

    Ownership of a Vehicle row is no longer a prerequisite; the customer picks a
    vehicle type in the booking flow instead.
    """
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import delete

    _, profile = await make_mechanic("novehicle@e.com", types=(VehicleType.CAR,))
    async with AsyncSessionLocal() as s:
        await s.execute(delete(Vehicle).where(Vehicle.user_id == customer_user.id))
        await s.commit()

    res = await book(client, customer_token, profile)
    assert res.status_code == 201
    assert res.json()["data"]["vehicle_type"] == "CAR"
    assert res.json()["data"]["vehicle"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("vehicle_type", ["BIKE", "CAR"])
async def test_both_vehicle_types_can_be_booked(client, customer_token, vehicle_type):
    _, profile = await make_mechanic(f"both-{vehicle_type}@e.com",
                                     types=(VehicleType.BIKE, VehicleType.CAR))
    res = await book(client, customer_token, profile, vehicle_type=vehicle_type)
    assert res.status_code == 201
    assert res.json()["data"]["vehicle_type"] == vehicle_type


@pytest.mark.asyncio
async def test_no_saved_vehicle_error_can_occur(client, customer_user, customer_token):
    """The old blocking message must be unreachable from the booking flow."""
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import delete

    _, profile = await make_mechanic("nomsg@e.com", types=(VehicleType.BIKE,))
    async with AsyncSessionLocal() as s:
        await s.execute(delete(Vehicle).where(Vehicle.user_id == customer_user.id))
        await s.commit()

    ok = await book(client, customer_token, profile, vehicle_type="BIKE")
    assert ok.status_code == 201
    # An unsupported type is refused for the mechanic's capability, not the
    # customer's inventory.
    bad = await book(client, customer_token, profile, vehicle_type="CAR")
    assert bad.status_code == 409
    assert "does not service" in bad.json()["detail"]
    assert "your vehicles" not in bad.json()["detail"].lower()


@pytest.mark.asyncio
async def test_booking_an_unknown_mechanic_is_refused(client, scenario):
    class Fake:
        id = "00000000-0000-0000-0000-000000000000"
    res = await book(client, scenario["customer_token"], Fake, scenario["vehicle"])
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_booking_an_unavailable_mechanic_is_refused(client, customer_user, customer_token):
    _, profile = await make_mechanic("off@e.com", available=False)
    vehicle = await make_vehicle(customer_user)
    res = await book(client, customer_token, profile, vehicle)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_booking_an_unsupported_vehicle_type_is_refused(client, customer_token):
    _, profile = await make_mechanic("caronly@e.com", types=(VehicleType.CAR,))
    res = await book(client, customer_token, profile, vehicle_type="BIKE")
    assert res.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("over", [
    {"problem_description": "hi"},
    {"vehicle_type": "Truck"},
    {"service_latitude": 91.0},
    {"service_longitude": -181.0},
])
async def test_invalid_booking_input_is_rejected(client, scenario, over):
    res = await book(client, scenario["customer_token"], scenario["profile"],
                     scenario["vehicle"], **over)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_a_mechanic_cannot_create_a_booking(client, scenario):
    res = await book(client, scenario["mechanic_token"], scenario["profile"], scenario["vehicle"])
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_status_cannot_be_injected_at_creation(client, scenario):
    res = await book(client, scenario["customer_token"], scenario["profile"],
                     scenario["vehicle"], status="COMPLETED")
    assert res.status_code == 201
    assert res.json()["data"]["status"] == BookingStatus.PENDING.value


# ------------------------------------------------------------------ visibility

@pytest.mark.asyncio
async def test_both_parties_see_the_booking_and_nobody_else(client, scenario):
    bid = (await book(client, scenario["customer_token"], scenario["profile"],
                      scenario["vehicle"])).json()["data"]["id"]

    assert (await client.get(f"{URL}/{bid}", headers=auth(scenario["customer_token"]))).status_code == 200
    assert (await client.get(f"{URL}/{bid}", headers=auth(scenario["mechanic_token"]))).status_code == 200

    intruder = await make_user("nosy@e.com", UserRole.CUSTOMER)
    res = await client.get(f"{URL}/{bid}", headers=auth(token_for(intruder)))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_lists_are_scoped_to_the_caller(client, scenario):
    await book(client, scenario["customer_token"], scenario["profile"], scenario["vehicle"])

    mine = await client.get(f"{URL}/", headers=auth(scenario["customer_token"]))
    assert len(mine.json()["data"]["bookings"]) == 1

    theirs = await client.get(f"{URL}/", headers=auth(scenario["mechanic_token"]))
    assert len(theirs.json()["data"]["bookings"]) == 1

    other_customer = await make_user("other@e.com", UserRole.CUSTOMER)
    empty = await client.get(f"{URL}/", headers=auth(token_for(other_customer)))
    assert empty.json()["data"]["bookings"] == []


@pytest.mark.asyncio
async def test_anonymous_access_is_rejected(client):
    assert (await client.get(f"{URL}/")).status_code == 401
    assert (await client.post(f"{URL}/", json={})).status_code == 401


# ------------------------------------------------------------------ happy path

@pytest.mark.asyncio
async def test_full_lifecycle_pending_to_completed(client, scenario):
    ct, mt = scenario["customer_token"], scenario["mechanic_token"]
    bid = (await book(client, ct, scenario["profile"], scenario["vehicle"])).json()["data"]["id"]

    for action, expected in (("accept", "ACCEPTED"), ("start", "IN_PROGRESS"),
                             ("complete", "COMPLETED")):
        res = await client.post(f"{URL}/{bid}/{action}", headers=auth(mt))
        assert res.status_code == 200, (action, res.text)
        assert res.json()["data"]["status"] == expected

    # the customer observes the same authoritative state
    seen = await client.get(f"{URL}/{bid}", headers=auth(ct))
    assert seen.json()["data"]["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_mechanic_can_reject_a_pending_booking(client, scenario):
    bid = (await book(client, scenario["customer_token"], scenario["profile"],
                      scenario["vehicle"])).json()["data"]["id"]
    res = await client.post(f"{URL}/{bid}/reject", headers=auth(scenario["mechanic_token"]))
    assert res.json()["data"]["status"] == "REJECTED"


@pytest.mark.asyncio
@pytest.mark.parametrize("before_action", [None, "accept"])
async def test_customer_can_cancel_before_work_starts(client, scenario, before_action):
    ct, mt = scenario["customer_token"], scenario["mechanic_token"]
    bid = (await book(client, ct, scenario["profile"], scenario["vehicle"])).json()["data"]["id"]
    if before_action:
        await client.post(f"{URL}/{bid}/{before_action}", headers=auth(mt))
    res = await client.post(f"{URL}/{bid}/cancel", headers=auth(ct))
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "CANCELLED"


# ------------------------------------------------------------------ invalid transitions

@pytest.mark.asyncio
async def test_cannot_start_a_booking_that_was_never_accepted(client, scenario):
    bid = (await book(client, scenario["customer_token"], scenario["profile"],
                      scenario["vehicle"])).json()["data"]["id"]
    res = await client.post(f"{URL}/{bid}/start", headers=auth(scenario["mechanic_token"]))
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_cannot_complete_before_starting(client, scenario):
    bid = (await book(client, scenario["customer_token"], scenario["profile"],
                      scenario["vehicle"])).json()["data"]["id"]
    await client.post(f"{URL}/{bid}/accept", headers=auth(scenario["mechanic_token"]))
    res = await client.post(f"{URL}/{bid}/complete", headers=auth(scenario["mechanic_token"]))
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_terminal_bookings_are_immutable(client, scenario):
    ct, mt = scenario["customer_token"], scenario["mechanic_token"]
    bid = (await book(client, ct, scenario["profile"], scenario["vehicle"])).json()["data"]["id"]
    await client.post(f"{URL}/{bid}/reject", headers=auth(mt))

    for action, token in (("accept", mt), ("start", mt), ("complete", mt), ("cancel", ct)):
        res = await client.post(f"{URL}/{bid}/{action}", headers=auth(token))
        assert res.status_code == 409, action


@pytest.mark.asyncio
async def test_customer_cannot_cancel_once_work_is_in_progress(client, scenario):
    ct, mt = scenario["customer_token"], scenario["mechanic_token"]
    bid = (await book(client, ct, scenario["profile"], scenario["vehicle"])).json()["data"]["id"]
    await client.post(f"{URL}/{bid}/accept", headers=auth(mt))
    await client.post(f"{URL}/{bid}/start", headers=auth(mt))
    assert (await client.post(f"{URL}/{bid}/cancel", headers=auth(ct))).status_code == 409


@pytest.mark.asyncio
async def test_customer_cannot_perform_mechanic_transitions(client, scenario):
    ct = scenario["customer_token"]
    bid = (await book(client, ct, scenario["profile"], scenario["vehicle"])).json()["data"]["id"]
    for action in ("accept", "reject", "start", "complete"):
        assert (await client.post(f"{URL}/{bid}/{action}", headers=auth(ct))).status_code == 403


@pytest.mark.asyncio
async def test_mechanic_cannot_cancel_on_the_customers_behalf(client, scenario):
    bid = (await book(client, scenario["customer_token"], scenario["profile"],
                      scenario["vehicle"])).json()["data"]["id"]
    res = await client.post(f"{URL}/{bid}/cancel", headers=auth(scenario["mechanic_token"]))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_a_mechanic_cannot_touch_another_mechanics_booking(client, scenario):
    bid = (await book(client, scenario["customer_token"], scenario["profile"],
                      scenario["vehicle"])).json()["data"]["id"]
    other_user, _ = await make_mechanic("rival@e.com")
    other_token = token_for(other_user)

    assert (await client.get(f"{URL}/{bid}", headers=auth(other_token))).status_code == 404
    assert (await client.post(f"{URL}/{bid}/accept", headers=auth(other_token))).status_code == 404


@pytest.mark.asyncio
async def test_status_filter_narrows_the_mechanic_queue(client, scenario):
    ct, mt = scenario["customer_token"], scenario["mechanic_token"]
    first = (await book(client, ct, scenario["profile"], scenario["vehicle"])).json()["data"]["id"]
    second_vehicle = await make_vehicle(scenario["customer"])
    await book(client, ct, scenario["profile"], second_vehicle)
    await client.post(f"{URL}/{first}/accept", headers=auth(mt))

    pending = await client.get(f"{URL}/?status=PENDING", headers=auth(mt))
    assert [b["status"] for b in pending.json()["data"]["bookings"]] == ["PENDING"]
