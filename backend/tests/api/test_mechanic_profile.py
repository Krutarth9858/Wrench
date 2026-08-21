"""Phase 2 — mechanic profile, vehicle types, service radius, availability (RAD FR-09)."""

import pytest

from app.core.security import create_access_token
from app.models.vehicle import VehicleType

PREFIX = "/api/v1/profile/mechanic"

VALID_PROFILE = {
    "garage_name": "Speedy Auto",
    "owner_name": "Mike Smith",
    "experience_years": 10,
    "specialization": "Engine Repair",
    "supported_vehicle_types": ["BIKE", "CAR"],
    "address": "456 Auto Blvd",
    "city": "Springfield",
    "state": "IL",
    "country": "USA",
    "latitude": 39.79,
    "longitude": -89.64,
    "service_radius_km": 25.5,
    "working_start_time": "08:00",
    "working_end_time": "18:00",
}


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def create_profile(client, token, **overrides):
    return await client.put(f"{PREFIX}/", json={**VALID_PROFILE, **overrides}, headers=auth(token))


# ----------------------------------------------------------------- profile CRUD

@pytest.mark.asyncio
async def test_profile_is_404_before_it_exists(client, mechanic_token):
    res = await client.get(f"{PREFIX}/", headers=auth(mechanic_token))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_mechanic_can_create_and_retrieve_their_profile(client, mechanic_token):
    created = await create_profile(client, mechanic_token)
    assert created.status_code == 200
    data = created.json()["data"]
    assert data["garage_name"] == VALID_PROFILE["garage_name"]
    assert data["supported_vehicle_types"] == ["BIKE", "CAR"]

    fetched = await client.get(f"{PREFIX}/", headers=auth(mechanic_token))
    assert fetched.status_code == 200
    assert fetched.json()["data"]["garage_name"] == VALID_PROFILE["garage_name"]


@pytest.mark.asyncio
async def test_mechanic_can_update_their_profile(client, mechanic_token):
    await create_profile(client, mechanic_token)
    res = await create_profile(client, mechanic_token, garage_name="Renamed Garage",
                               experience_years=15)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["garage_name"] == "Renamed Garage"
    assert data["experience_years"] == 15


@pytest.mark.asyncio
async def test_a_new_profile_defaults_to_available(client, mechanic_token):
    res = await create_profile(client, mechanic_token)
    assert res.json()["data"]["is_available"] is True


# ----------------------------------------------------------------- vehicle types

@pytest.mark.asyncio
@pytest.mark.parametrize("types", [["BIKE"], ["CAR"], ["BIKE", "CAR"]])
async def test_in_scope_vehicle_types_are_accepted(client, mechanic_token, types):
    res = await create_profile(client, mechanic_token, supported_vehicle_types=types)
    assert res.status_code == 200
    assert res.json()["data"]["supported_vehicle_types"] == types


@pytest.mark.asyncio
@pytest.mark.parametrize("types", [["Truck"], ["EV"], ["Scooter"], ["bike"], ["BIKE", "Truck"]])
async def test_out_of_scope_vehicle_types_are_rejected(client, mechanic_token, types):
    """RAD scope is two- and four-wheelers only; Truck/EV/Scooter must not be accepted."""
    res = await create_profile(client, mechanic_token, supported_vehicle_types=types)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_at_least_one_vehicle_type_is_required(client, mechanic_token):
    res = await create_profile(client, mechanic_token, supported_vehicle_types=[])
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_vehicle_types_are_collapsed(client, mechanic_token):
    res = await create_profile(client, mechanic_token,
                               supported_vehicle_types=["CAR", "CAR", "BIKE"])
    assert res.status_code == 200
    assert res.json()["data"]["supported_vehicle_types"] == ["CAR", "BIKE"]


@pytest.mark.asyncio
async def test_vehicle_types_use_the_canonical_enum(client, mechanic_token):
    await create_profile(client, mechanic_token, supported_vehicle_types=["BIKE"])
    res = await client.get(f"{PREFIX}/", headers=auth(mechanic_token))
    stored = res.json()["data"]["supported_vehicle_types"]
    assert all(v in {t.value for t in VehicleType} for v in stored)


# ----------------------------------------------------------------- service radius

@pytest.mark.asyncio
async def test_service_radius_is_persisted(client, mechanic_token):
    await create_profile(client, mechanic_token, service_radius_km=12.5)
    res = await client.get(f"{PREFIX}/", headers=auth(mechanic_token))
    assert res.json()["data"]["service_radius_km"] == 12.5


@pytest.mark.asyncio
@pytest.mark.parametrize("radius", [0, -1, -0.5])
async def test_non_positive_service_radius_is_rejected(client, mechanic_token, radius):
    res = await create_profile(client, mechanic_token, service_radius_km=radius)
    assert res.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("field,value", [
    ("latitude", 91.0), ("longitude", 181.0),
    ("working_start_time", "25:00"), ("working_end_time", "8am"),
    ("experience_years", -1),
])
async def test_invalid_profile_fields_are_rejected(client, mechanic_token, field, value):
    res = await create_profile(client, mechanic_token, **{field: value})
    assert res.status_code == 422


# ----------------------------------------------------------------- availability

@pytest.mark.asyncio
async def test_availability_is_404_without_a_profile(client, mechanic_token):
    res = await client.get(f"{PREFIX}/availability", headers=auth(mechanic_token))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_mechanic_can_read_availability(client, mechanic_token):
    await create_profile(client, mechanic_token)
    res = await client.get(f"{PREFIX}/availability", headers=auth(mechanic_token))
    assert res.status_code == 200
    assert res.json()["data"]["is_available"] is True


@pytest.mark.asyncio
async def test_mechanic_can_go_offline_and_back_online(client, mechanic_token):
    await create_profile(client, mechanic_token)

    off = await client.patch(f"{PREFIX}/availability", json={"is_available": False},
                             headers=auth(mechanic_token))
    assert off.status_code == 200
    assert off.json()["data"]["is_available"] is False

    on = await client.patch(f"{PREFIX}/availability", json={"is_available": True},
                            headers=auth(mechanic_token))
    assert on.json()["data"]["is_available"] is True


@pytest.mark.asyncio
async def test_availability_persists_across_requests(client, mechanic_token):
    """Guards the FR-09 defect where availability could never actually change."""
    await create_profile(client, mechanic_token)
    await client.patch(f"{PREFIX}/availability", json={"is_available": False},
                       headers=auth(mechanic_token))

    assert (await client.get(f"{PREFIX}/availability",
                             headers=auth(mechanic_token))).json()["data"]["is_available"] is False
    assert (await client.get(f"{PREFIX}/",
                             headers=auth(mechanic_token))).json()["data"]["is_available"] is False


@pytest.mark.asyncio
async def test_updating_the_profile_does_not_reset_availability(client, mechanic_token):
    await create_profile(client, mechanic_token)
    await client.patch(f"{PREFIX}/availability", json={"is_available": False},
                       headers=auth(mechanic_token))
    await create_profile(client, mechanic_token, garage_name="Still Offline")
    res = await client.get(f"{PREFIX}/availability", headers=auth(mechanic_token))
    assert res.json()["data"]["is_available"] is False


@pytest.mark.asyncio
async def test_availability_requires_a_boolean(client, mechanic_token):
    await create_profile(client, mechanic_token)
    res = await client.patch(f"{PREFIX}/availability", json={"is_available": "maybe"},
                             headers=auth(mechanic_token))
    assert res.status_code == 422


# ----------------------------------------------------------------- RBAC / isolation

@pytest.mark.asyncio
async def test_customer_cannot_read_or_write_mechanic_profile(client, customer_token):
    assert (await client.get(f"{PREFIX}/", headers=auth(customer_token))).status_code == 403
    assert (await create_profile(client, customer_token)).status_code == 403


@pytest.mark.asyncio
async def test_customer_cannot_read_or_change_availability(client, customer_token):
    assert (await client.get(f"{PREFIX}/availability",
                             headers=auth(customer_token))).status_code == 403
    res = await client.patch(f"{PREFIX}/availability", json={"is_available": False},
                             headers=auth(customer_token))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_does_not_get_mechanic_self_service_routes(client, admin_user):
    """RBAC convention: these are mechanic self-service, scoped by the bearer token."""
    token = create_access_token(subject=str(admin_user.id))
    assert (await client.get(f"{PREFIX}/availability", headers=auth(token))).status_code == 403


@pytest.mark.asyncio
async def test_anonymous_requests_are_rejected(client):
    assert (await client.get(f"{PREFIX}/")).status_code == 401
    assert (await client.get(f"{PREFIX}/availability")).status_code == 401
    assert (await client.patch(f"{PREFIX}/availability",
                               json={"is_available": True})).status_code == 401


@pytest.mark.asyncio
async def test_a_mechanic_only_ever_touches_their_own_profile(client, mechanic_user, mechanic_token):
    """The user id comes from the token, so there is no cross-mechanic write path."""
    from app.core.security import get_password_hash
    from app.db.session import AsyncSessionLocal
    from app.models.user import User, UserRole

    async with AsyncSessionLocal() as session:
        other = User(email="other-mech@example.com", phone_number="+15559990000",
                     hashed_password=get_password_hash("password"), role=UserRole.MECHANIC)
        session.add(other)
        await session.commit()
        await session.refresh(other)

    await create_profile(client, mechanic_token, garage_name="Mine")
    other_token = create_access_token(subject=str(other.id))
    await create_profile(client, other_token, garage_name="Theirs")

    await client.patch(f"{PREFIX}/availability", json={"is_available": False},
                       headers=auth(other_token))

    mine = await client.get(f"{PREFIX}/", headers=auth(mechanic_token))
    assert mine.json()["data"]["garage_name"] == "Mine"
    assert mine.json()["data"]["is_available"] is True  # unaffected by the other mechanic


# ----------------------------------------------------------------- location sanity

@pytest.mark.asyncio
async def test_a_profile_cannot_be_saved_at_null_island(client, mechanic_token):
    """Regression: 0,0 passes the lat/lon bounds but is 8000 km from anywhere real.

    A mechanic saved there is permanently invisible to discovery, which is how a
    real account ended up unreachable while showing "Available".
    """
    res = await create_profile(client, mechanic_token, latitude=0, longitude=0)
    assert res.status_code == 422
    assert "0, 0" in res.text


@pytest.mark.asyncio
@pytest.mark.parametrize("coords", [(0.0, 72.5714), (23.0225, 0.0)])
async def test_a_single_zero_coordinate_is_still_valid(client, mechanic_token, coords):
    """Only the exact 0,0 pair is rejected — the equator and prime meridian are real."""
    latitude, longitude = coords
    res = await create_profile(client, mechanic_token, latitude=latitude, longitude=longitude)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_an_existing_null_island_profile_can_still_be_read_and_corrected(
    client, mechanic_user, mechanic_token
):
    """The guard is write-only on purpose.

    Profiles already stored at 0, 0 must stay readable, otherwise the mechanic
    cannot open the profile page to fix the coordinates that made them invisible.
    """
    from sqlalchemy import update
    from app.db.session import AsyncSessionLocal
    from app.models.profile import MechanicProfile

    await create_profile(client, mechanic_token)
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(MechanicProfile)
            .where(MechanicProfile.user_id == mechanic_user.id)
            .values(latitude=0, longitude=0)
        )
        await session.commit()

    read = await client.get(f"{PREFIX}/", headers=auth(mechanic_token))
    assert read.status_code == 200
    assert read.json()["data"]["latitude"] == 0

    fixed = await create_profile(client, mechanic_token, latitude=23.0225, longitude=72.5714)
    assert fixed.status_code == 200
    assert fixed.json()["data"]["latitude"] == 23.0225


@pytest.mark.asyncio
async def test_updating_the_profile_actually_moves_the_garage(client, mechanic_token):
    """Regression: PUT returned 200 while silently discarding coordinate changes.

    MechanicProfileUpdate omitted latitude/longitude, so upsert_profile() dropped
    them — a mechanic could never correct a wrong location through the profile
    form, which is what left a real account invisible to discovery.
    """
    await create_profile(client, mechanic_token, latitude=23.0225, longitude=72.5714)

    moved = await create_profile(client, mechanic_token, latitude=19.0760, longitude=72.8777)
    assert moved.status_code == 200
    assert moved.json()["data"]["latitude"] == 19.0760
    assert moved.json()["data"]["longitude"] == 72.8777

    # and it persisted, not just echoed back
    fetched = await client.get(f"{PREFIX}/", headers=auth(mechanic_token))
    assert fetched.json()["data"]["latitude"] == 19.0760
