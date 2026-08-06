import pytest
import asyncio
import os

# Ensure tests use an in-memory SQLite database
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, engine
from app.models.user import User
from app.core.security import get_password_hash, create_access_token

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
async def customer_user():
    user = User(
        email="customer@example.com",
        phone_number="+1111111111",
        hashed_password=get_password_hash("password"),
        role="CUSTOMER"
    )
    from app.db.session import async_session
    async with async_session() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user

@pytest.fixture
def customer_token(customer_user):
    return create_access_token(subject=str(customer_user.id))

@pytest.fixture
async def mechanic_user():
    user = User(
        email="mechanic@example.com",
        phone_number="+2222222222",
        hashed_password=get_password_hash("password"),
        role="MECHANIC"
    )
    from app.db.session import async_session
    async with async_session() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user

@pytest.fixture
def mechanic_token(mechanic_user):
    return create_access_token(subject=str(mechanic_user.id))
