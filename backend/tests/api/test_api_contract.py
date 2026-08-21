"""Regression tests for the Phase 0 backend contract fixes.

Each test here protects a specific change:
  - the /api/v1 prefix is applied exactly once (main.py)
  - health is reachable for the frontend smoke flow
  - CORS allows the Vite dev origin and rejects others (main.py)
  - SECRET_KEY has no default (core/config.py)
"""

import pytest

from app.main import app


def test_every_route_is_versioned_exactly_once(api_prefix):
    """The prefix must be applied at the single mount point, never doubled."""
    paths = [r.path for r in app.routes if getattr(r, "path", "").startswith("/api")]
    assert paths, "no versioned routes registered"
    for path in paths:
        assert path.startswith(api_prefix), path
        assert not path.startswith(api_prefix + api_prefix), f"duplicated prefix: {path}"


def test_expected_routes_are_mounted(api_prefix):
    paths = {getattr(r, "path", "") for r in app.routes}
    for suffix in ("/health", "/auth/login", "/auth/me", "/vehicles/",
                   "/profile/customer/", "/profile/mechanic/"):
        assert f"{api_prefix}{suffix}" in paths, f"missing {api_prefix}{suffix}"


def test_unprefixed_paths_are_not_served(api_prefix):
    """Guards against re-introducing the old unversioned contract."""
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/health" not in paths
    assert "/auth/login" not in paths


@pytest.mark.asyncio
async def test_health_endpoint(client, api_prefix):
    response = await client.get(f"{api_prefix}/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_cors_allows_vite_dev_origin(client, api_prefix):
    origin = "http://localhost:5173"
    response = await client.get(f"{api_prefix}/health", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin


@pytest.mark.asyncio
async def test_cors_rejects_unknown_origin(client, api_prefix):
    response = await client.get(
        f"{api_prefix}/health", headers={"Origin": "http://evil.example.com"}
    )
    assert "access-control-allow-origin" not in response.headers


def test_secret_key_has_no_default(monkeypatch):
    """A missing SECRET_KEY must fail loudly, never fall back to a known value."""
    from pydantic import ValidationError

    from app.core.config import Settings

    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, DATABASE_URL="postgresql+asyncpg://u@localhost/d")


@pytest.mark.asyncio
async def test_uuid_ids_serialize_as_json_strings(client, api_prefix, customer_token):
    """Regression: brain.md §13 #10.

    Response schemas declared `id: str` while SQLAlchemy returns `uuid.UUID`
    (postgresql.UUID(as_uuid=True)). Pydantic v2 does not coerce UUID -> str, so
    every profile/vehicle/user response raised ValidationError -> HTTP 500.
    They are now typed `UUID`; this pins the wire format as a string so the fix
    cannot regress into a breaking API change.
    """
    headers = {"Authorization": f"Bearer {customer_token}"}
    response = await client.get(f"{api_prefix}/auth/me", headers=headers)
    assert response.status_code == 200
    user_id = response.json()["data"]["id"]
    assert isinstance(user_id, str)
    from uuid import UUID as _UUID
    _UUID(user_id)  # parses as a UUID
