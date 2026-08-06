import asyncio
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, engine
import uuid

client = TestClient(app)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Run DB init
asyncio.run(init_db())

def run_tests():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    phone = f"+1{uuid.uuid4().int % 10000000000:010d}"
    password = "StrongPassword123!"

    print("--- 1. Register valid user ---")
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "phone_number": phone,
        "password": password
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    print("\n--- 2. Register duplicate email ---")
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "phone_number": "+19999999999",
        "password": password
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    print("\n--- 3. Register duplicate phone ---")
    response = client.post("/api/v1/auth/register", json={
        "email": f"new_{email}",
        "phone_number": phone,
        "password": password
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    print("\n--- 4. Register invalid email ---")
    response = client.post("/api/v1/auth/register", json={
        "email": "not-an-email",
        "phone_number": "+18888888888",
        "password": password
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    print("\n--- 5. Register weak password ---")
    response = client.post("/api/v1/auth/register", json={
        "email": f"weak_{email}",
        "phone_number": "+17777777777",
        "password": "short"
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    print("\n--- 6. Login correct ---")
    response = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": password
    })
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        res_data = response.json()["data"]
        access_token = res_data["access_token"]
        refresh_token = res_data["refresh_token"]
    else:
        access_token = None
        refresh_token = None
    print(f"Response: {response.json()}")

    print("\n--- 7. Login wrong password ---")
    response = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "WrongPassword123!"
    })
    print(f"Status: {response.status_code}")

    print("\n--- 8. Get /me valid ---")
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    print("\n--- 9. Get /me invalid token ---")
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer invalidtoken"})
    print(f"Status: {response.status_code}")

    print("\n--- 10. Refresh valid ---")
    response = client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token
    })
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        res_data = response.json()["data"]
        access_token = res_data["access_token"]
        refresh_token = res_data["refresh_token"]

    print("\n--- 11. Refresh invalid ---")
    response = client.post("/api/v1/auth/refresh", json={
        "refresh_token": "tampered_token"
    })
    print(f"Status: {response.status_code}")

    print("\n--- 12. Logout ---")
    response = client.post("/api/v1/auth/logout", json={
        "refresh_token": refresh_token
    }, headers={"Authorization": f"Bearer {access_token}"})
    print(f"Status: {response.status_code}")

    print("\n--- 13. Refresh after logout ---")
    response = client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

run_tests()
