"""Pytest fixtures for the Wrench backend.

Test database
-------------
The production models use PostgreSQL-specific column types (``postgresql.UUID``
on every primary key, ``postgresql.ARRAY`` on
``mechanic_profiles.supported_vehicle_types``), so SQLite cannot host this
schema. Tests therefore run against a real PostgreSQL database.

``DATABASE_URL`` is set below *before* ``app`` is imported, so the existing
session authority (``app.db.session``) builds its engine against the test
database. No second engine or sessionmaker is created anywhere.
"""

import os

# Must be set before any app module is imported: app.core.config.Settings is
# instantiated at import time and app.db.session builds its engine from it.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres@localhost:5432/wrench_test",
)
os.environ.setdefault("SECRET_KEY", "test-only-secret-not-used-outside-pytest")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token, get_password_hash  # noqa: E402
from app.db.session import AsyncSessionLocal, Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

# Registers every model on Base.metadata. Imported as `from app import models`
# rather than `import app.models`, which would rebind the name `app` from the
# FastAPI instance to the package and break the ASGI transport.
from app import models as _models  # noqa: E402,F401


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_schema():
    """Create the schema once for the session, drop it at the end."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables(_create_schema):
    """Truncate every table before each test.

    Repositories commit their own transactions (see brain.md §13 #9), so a
    rollback-based strategy would not isolate them. TRUNCATE is simple and
    correct regardless of who commits.
    """
    tables = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
    async with engine.begin() as conn:
        await conn.exec_driver_sql(f"TRUNCATE {tables} RESTART IDENTITY CASCADE")
    yield


@pytest_asyncio.fixture
async def client():
    """HTTP client speaking directly to the ASGI app on the current loop."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def api_prefix() -> str:
    """The versioned API prefix, read from the configuration authority."""
    return settings.API_V1_STR


async def _create_user(email: str, phone_number: str, role: UserRole) -> User:
    user = User(
        email=email,
        phone_number=phone_number,
        hashed_password=get_password_hash("password"),
        role=role,
    )
    async with AsyncSessionLocal() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def customer_user() -> User:
    return await _create_user("customer@example.com", "+11111111111", UserRole.CUSTOMER)


@pytest_asyncio.fixture
async def mechanic_user() -> User:
    return await _create_user("mechanic@example.com", "+12222222222", UserRole.MECHANIC)


@pytest_asyncio.fixture
async def admin_user() -> User:
    """Mirrors scripts/create_admin.py: ADMIN exists only via out-of-band provisioning."""
    return await _create_user("admin@example.com", "+13332221111", UserRole.ADMIN)


@pytest.fixture
def customer_token(customer_user: User) -> str:
    return create_access_token(subject=str(customer_user.id))


@pytest.fixture
def mechanic_token(mechanic_user: User) -> str:
    return create_access_token(subject=str(mechanic_user.id))
