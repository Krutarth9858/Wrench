"""Phase 3 — GPS-based mechanic discovery (RAD FR-02)."""

import pytest

from app.core.security import create_access_token, get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.profile import MechanicProfile
from app.models.user import User, UserRole
from app.models.vehicle import VehicleType

URL = "/api/v1/mechanics/nearby"

# Ahmedabad city centre — the customer's position in every test.
ORIGIN = (23.0225, 72.5714)
# ~5.6 km north of ORIGIN.
NEAR = (23.0725, 72.5714)
# ~111 km north of ORIGIN (1 degree of latitude).
FAR = (24.0225, 72.5714)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def make_mechanic(
    email: str,
    coords=NEAR,
    *,
    is_available=True,
    types=(VehicleType.CAR,),
    radius_km=25.0,
) -> MechanicProfile:
    async with AsyncSessionLocal() as session:
        user = User(
            email=email,
            phone_number=f"+1555{abs(hash(email)) % 10_000_000:07d}",
            hashed_password=get_password_hash("password"),
            role=UserRole.MECHANIC,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        profile = MechanicProfile(
            user_id=user.id,
            garage_name=f"Garage {email.split('@')[0]}",
            owner_name="Owner",
            experience_years=5,
            specialization="General",
            supported_vehicle_types=list(types),
            address="1 Road",
            city="Ahmedabad",
            state="GJ",
            country="India",
            latitude=coords[0],
            longitude=coords[1],
            service_radius_km=radius_km,
            working_start_time="09:00",
            working_end_time="18:00",
            is_available=is_available,
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        return profile


async def search(client, token, lat=ORIGIN[0], lon=ORIGIN[1], vehicle_type="CAR"):
    return await client.get(
        URL,
        params={"latitude": lat, "longitude": lon, "vehicle_type": vehicle_type},
        headers=auth(token),
    )


def names(res) -> set:
    return {m["garage_name"] for m in res.json()["data"]["mechanics"]}


# ------------------------------------------------------------------ eligibility

@pytest.mark.asyncio
async def test_mechanic_inside_radius_is_returned(client, customer_token):
    await make_mechanic("near@e.com", NEAR, radius_km=25.0)
    res = await search(client, customer_token)
    assert res.status_code == 200
    assert "Garage near" in names(res)


@pytest.mark.asyncio
async def test_mechanic_outside_radius_is_excluded(client, customer_token):
    # 111 km away but only covers 25 km.
    await make_mechanic("far@e.com", FAR, radius_km=25.0)
    assert names(await search(client, customer_token)) == set()


@pytest.mark.asyncio
async def test_distant_mechanic_with_a_wide_radius_is_returned(client, customer_token):
    """Coverage is per-mechanic: a 150 km radius reaches a 111 km customer."""
    await make_mechanic("wide@e.com", FAR, radius_km=150.0)
    assert "Garage wide" in names(await search(client, customer_token))


@pytest.mark.asyncio
async def test_unavailable_mechanic_is_excluded(client, customer_token):
    await make_mechanic("off@e.com", NEAR, is_available=False)
    assert names(await search(client, customer_token)) == set()


@pytest.mark.asyncio
async def test_mechanic_not_supporting_the_vehicle_type_is_excluded(client, customer_token):
    await make_mechanic("caronly@e.com", NEAR, types=(VehicleType.CAR,))
    assert names(await search(client, customer_token, vehicle_type="BIKE")) == set()


@pytest.mark.asyncio
async def test_mechanic_supporting_both_types_matches_either(client, customer_token):
    await make_mechanic("both@e.com", NEAR, types=(VehicleType.BIKE, VehicleType.CAR))
    assert "Garage both" in names(await search(client, customer_token, vehicle_type="BIKE"))
    assert "Garage both" in names(await search(client, customer_token, vehicle_type="CAR"))


@pytest.mark.asyncio
async def test_a_mechanic_cannot_exist_without_coordinates(client, customer_token):
    """"Missing location" is excluded structurally, not by the query.

    latitude/longitude are NOT NULL on mechanic_profiles, so a coordinate-less
    mechanic cannot be persisted at all. The `isnot(None)` guard in find_nearby is
    therefore defensive only. This asserts the invariant that makes it so.
    """
    from sqlalchemy import update
    from sqlalchemy.exc import IntegrityError

    profile = await make_mechanic("nocoords@e.com", NEAR)
    with pytest.raises(IntegrityError, match="latitude"):
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(MechanicProfile)
                .where(MechanicProfile.id == profile.id)
                .values(latitude=None)
            )
            await session.commit()


# ------------------------------------------------------------------ distance

@pytest.mark.asyncio
async def test_distance_is_great_circle_not_euclidean(client, customer_token):
    """One degree of latitude is ~111.19 km; a Euclidean degree count would be ~1."""
    await make_mechanic("onedeg@e.com", FAR, radius_km=200.0)
    m = (await search(client, customer_token)).json()["data"]["mechanics"][0]
    assert 110.5 <= m["distance_km"] <= 111.6


@pytest.mark.asyncio
async def test_distance_at_the_origin_is_zero(client, customer_token):
    await make_mechanic("here@e.com", ORIGIN)
    m = (await search(client, customer_token)).json()["data"]["mechanics"][0]
    assert m["distance_km"] == 0.0


@pytest.mark.asyncio
async def test_results_are_ordered_nearest_first(client, customer_token):
    await make_mechanic("b-far@e.com", (23.2225, 72.5714), radius_km=100.0)   # ~22 km
    await make_mechanic("a-near@e.com", (23.0325, 72.5714), radius_km=100.0)  # ~1 km
    ms = (await search(client, customer_token)).json()["data"]["mechanics"]
    assert [m["garage_name"] for m in ms] == ["Garage a-near", "Garage b-far"]
    assert ms[0]["distance_km"] < ms[1]["distance_km"]


@pytest.mark.asyncio
async def test_radius_boundary_includes_just_inside_and_excludes_just_outside(
    client, customer_token
):
    # NEAR is ~5.56 km from ORIGIN.
    await make_mechanic("inside@e.com", NEAR, radius_km=6.0)
    await make_mechanic("outside@e.com", NEAR, radius_km=5.0)
    found = names(await search(client, customer_token))
    assert "Garage inside" in found
    assert "Garage outside" not in found


# ------------------------------------------------------------------ payload

@pytest.mark.asyncio
async def test_response_carries_what_the_ui_needs(client, customer_token):
    await make_mechanic("payload@e.com", NEAR, types=(VehicleType.CAR,))
    m = (await search(client, customer_token)).json()["data"]["mechanics"][0]
    for field in ("id", "garage_name", "latitude", "longitude", "distance_km",
                  "supported_vehicle_types", "is_available"):
        assert field in m, field
    assert m["supported_vehicle_types"] == ["CAR"]
    assert m["is_available"] is True


@pytest.mark.asyncio
async def test_response_withholds_private_details(client, customer_token):
    await make_mechanic("private@e.com", NEAR)
    body = (await search(client, customer_token)).text
    for leaked in ("owner_name", "address", "working_start_time", "user_id",
                   "hashed_password", "phone_number"):
        assert leaked not in body, leaked


# ------------------------------------------------------------------ validation

@pytest.mark.asyncio
@pytest.mark.parametrize("params", [
    {"latitude": 91, "longitude": 72.5, "vehicle_type": "CAR"},
    {"latitude": 23.0, "longitude": 181, "vehicle_type": "CAR"},
    {"latitude": 23.0, "longitude": 72.5, "vehicle_type": "Truck"},
    {"latitude": 23.0, "longitude": 72.5},
    {"longitude": 72.5, "vehicle_type": "CAR"},
])
async def test_invalid_query_parameters_are_rejected(client, customer_token, params):
    res = await client.get(URL, params=params, headers=auth(customer_token))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_no_matches_returns_an_empty_list_not_an_error(client, customer_token):
    res = await search(client, customer_token)
    assert res.status_code == 200
    assert res.json()["data"]["mechanics"] == []


# ------------------------------------------------------------------ authorization

@pytest.mark.asyncio
async def test_anonymous_requests_are_rejected(client):
    res = await client.get(URL, params={"latitude": 23.0, "longitude": 72.5,
                                        "vehicle_type": "CAR"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_discovery_is_a_customer_capability(client, mechanic_token, admin_user):
    assert (await search(client, mechanic_token)).status_code == 403
    admin_token = create_access_token(subject=str(admin_user.id))
    assert (await search(client, admin_token)).status_code == 403
