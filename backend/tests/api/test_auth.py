"""Phase 1 — authentication and role-based authorization (RAD FR-01)."""

import pytest

from app.core.security import create_access_token, create_refresh_token
from app.models.user import UserRole

PREFIX = "/api/v1"

CUSTOMER = {"email": "cust@example.com", "phone_number": "+13334445555", "password": "password123"}
MECHANIC = {"email": "mech@example.com", "phone_number": "+13334446666", "password": "password123",
            "role": "MECHANIC"}


async def register(client, payload):
    return await client.post(f"{PREFIX}/auth/register", json=payload)


async def login(client, email, password):
    return await client.post(f"{PREFIX}/auth/login", json={"email": email, "password": password})


async def tokens_for(client, payload):
    await register(client, payload)
    res = await login(client, payload["email"], payload["password"])
    return res.json()["data"]


# --------------------------------------------------------------------------- registration

@pytest.mark.asyncio
async def test_customer_registration_defaults_to_customer_role(client):
    res = await register(client, CUSTOMER)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["email"] == CUSTOMER["email"]
    assert data["role"] == UserRole.CUSTOMER.value
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_mechanic_can_self_register(client):
    res = await register(client, MECHANIC)
    assert res.status_code == 201
    assert res.json()["data"]["role"] == UserRole.MECHANIC.value


@pytest.mark.asyncio
async def test_registration_never_returns_the_password(client):
    res = await register(client, CUSTOMER)
    body = res.text
    assert CUSTOMER["password"] not in body
    assert "password" not in res.json()["data"]
    assert "hashed_password" not in res.json()["data"]


@pytest.mark.asyncio
async def test_password_is_stored_hashed_not_plaintext(client):
    await register(client, CUSTOMER)
    from app.db.repositories.user import UserRepository
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = await UserRepository(session).get_by_email(CUSTOMER["email"])
    assert user.hashed_password != CUSTOMER["password"]
    assert user.hashed_password.startswith("$argon2")


@pytest.mark.asyncio
async def test_duplicate_email_is_rejected(client):
    await register(client, CUSTOMER)
    res = await register(client, {**CUSTOMER, "phone_number": "+13334447777"})
    assert res.status_code == 400
    assert "Email already registered" in res.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_phone_number_is_rejected(client):
    await register(client, CUSTOMER)
    res = await register(client, {**CUSTOMER, "email": "other@example.com"})
    assert res.status_code == 400
    assert "Phone number already registered" in res.json()["detail"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "override",
    [
        {"password": "short"},          # below min_length=8
        {"email": "not-an-email"},      # EmailStr
        {"phone_number": "abc"},        # E.164 validator
    ],
)
async def test_invalid_registration_input_is_rejected(client, override):
    res = await register(client, {**CUSTOMER, **override})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_public_registration_cannot_create_an_admin(client):
    """Privilege-escalation guard: ADMIN is not an accepted self-registration role."""
    res = await register(client, {**CUSTOMER, "role": "ADMIN"})
    assert res.status_code == 422

    from app.db.repositories.user import UserRepository
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        assert await UserRepository(session).get_by_email(CUSTOMER["email"]) is None


# --------------------------------------------------------------------------- login

@pytest.mark.asyncio
async def test_login_returns_an_access_and_refresh_token(client):
    await register(client, CUSTOMER)
    res = await login(client, CUSTOMER["email"], CUSTOMER["password"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["access_token"] and data["refresh_token"]
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_with_a_wrong_password_is_rejected(client):
    await register(client, CUSTOMER)
    res = await login(client, CUSTOMER["email"], "wrong-password")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_with_an_unknown_email_is_rejected(client):
    res = await login(client, "nobody@example.com", "password123")
    assert res.status_code == 401


# --------------------------------------------------------------------------- access tokens

@pytest.mark.asyncio
async def test_me_returns_the_authenticated_user(client):
    t = await tokens_for(client, CUSTOMER)
    res = await client.get(
        f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {t['access_token']}"}
    )
    assert res.status_code == 200
    assert res.json()["data"]["email"] == CUSTOMER["email"]
    assert "hashed_password" not in res.text


@pytest.mark.asyncio
async def test_protected_route_rejects_a_missing_token(client):
    assert (await client.get(f"{PREFIX}/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_protected_route_rejects_a_malformed_token(client):
    res = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": "Bearer nonsense"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_rejects_an_expired_token(client):
    from datetime import timedelta

    expired = create_access_token(subject="00000000-0000-0000-0000-000000000000",
                                  expires_delta=timedelta(seconds=-30))
    res = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_a_refresh_token_is_not_accepted_as_an_access_token(client):
    t = await tokens_for(client, CUSTOMER)
    res = await client.get(
        f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {t['refresh_token']}"}
    )
    assert res.status_code == 401


# --------------------------------------------------------------------------- refresh / logout

@pytest.mark.asyncio
async def test_refresh_issues_a_new_usable_token_pair(client):
    t = await tokens_for(client, CUSTOMER)
    res = await client.post(f"{PREFIX}/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert res.status_code == 200
    new = res.json()["data"]
    assert new["refresh_token"] != t["refresh_token"]

    me = await client.get(
        f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {new['access_token']}"}
    )
    assert me.status_code == 200


@pytest.mark.asyncio
async def test_a_rotated_refresh_token_cannot_be_reused(client):
    t = await tokens_for(client, CUSTOMER)
    await client.post(f"{PREFIX}/auth/refresh", json={"refresh_token": t["refresh_token"]})
    replay = await client.post(f"{PREFIX}/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert replay.status_code == 401


@pytest.mark.asyncio
async def test_an_access_token_is_not_accepted_for_refresh(client):
    t = await tokens_for(client, CUSTOMER)
    res = await client.post(f"{PREFIX}/auth/refresh", json={"refresh_token": t["access_token"]})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_the_refresh_token(client):
    t = await tokens_for(client, CUSTOMER)
    headers = {"Authorization": f"Bearer {t['access_token']}"}
    res = await client.post(
        f"{PREFIX}/auth/logout", json={"refresh_token": t["refresh_token"]}, headers=headers
    )
    assert res.status_code == 200

    after = await client.post(f"{PREFIX}/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert after.status_code == 401


@pytest.mark.asyncio
async def test_logout_requires_authentication(client):
    res = await client.post(f"{PREFIX}/auth/logout", json={"refresh_token": "whatever"})
    assert res.status_code == 401


# --------------------------------------------------------------------------- RBAC

@pytest.mark.asyncio
async def test_customer_reaches_customer_route_and_mechanic_does_not(client):
    cust = await tokens_for(client, CUSTOMER)
    mech = await tokens_for(client, MECHANIC)

    ok = await client.get(f"{PREFIX}/profile/customer/",
                          headers={"Authorization": f"Bearer {cust['access_token']}"})
    assert ok.status_code == 404  # authorized; profile simply not created yet

    denied = await client.get(f"{PREFIX}/profile/customer/",
                              headers={"Authorization": f"Bearer {mech['access_token']}"})
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_mechanic_reaches_mechanic_route_and_customer_does_not(client):
    cust = await tokens_for(client, CUSTOMER)
    mech = await tokens_for(client, MECHANIC)

    ok = await client.get(f"{PREFIX}/profile/mechanic/",
                          headers={"Authorization": f"Bearer {mech['access_token']}"})
    assert ok.status_code == 404

    denied = await client.get(f"{PREFIX}/profile/mechanic/",
                              headers={"Authorization": f"Bearer {cust['access_token']}"})
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_admin_route_rejects_customer_and_mechanic(client):
    cust = await tokens_for(client, CUSTOMER)
    mech = await tokens_for(client, MECHANIC)
    for t in (cust, mech):
        res = await client.get(f"{PREFIX}/admin/users",
                               headers={"Authorization": f"Bearer {t['access_token']}"})
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_provisioned_admin_reaches_the_admin_route(client, admin_user):
    token = create_access_token(subject=str(admin_user.id))
    res = await client.get(f"{PREFIX}/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json()["data"], list)
    assert "hashed_password" not in res.text


@pytest.mark.asyncio
async def test_admin_route_rejects_anonymous(client):
    assert (await client.get(f"{PREFIX}/admin/users")).status_code == 401


@pytest.mark.asyncio
async def test_inactive_user_is_refused(client, customer_user):
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import update
    from app.models.user import User

    async with AsyncSessionLocal() as session:
        await session.execute(update(User).where(User.id == customer_user.id).values(is_active=False))
        await session.commit()

    token = create_access_token(subject=str(customer_user.id))
    res = await client.get(f"{PREFIX}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_refresh_token_for_an_unknown_user_is_refused(client):
    orphan = create_refresh_token(subject="00000000-0000-0000-0000-000000000000")
    res = await client.post(f"{PREFIX}/auth/refresh", json={"refresh_token": orphan})
    assert res.status_code == 401
