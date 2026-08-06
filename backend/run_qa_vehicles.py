import asyncio
import uuid
import urllib.request
import urllib.error
import json

from app.db.session import async_session
from app.models.user import User, UserRole
from app.core.security import get_password_hash, create_access_token

async def seed_users():
    async with async_session() as session:
        user1 = User(
            email=f"u1_{uuid.uuid4().hex[:8]}@example.com",
            phone_number=f"+1{uuid.uuid4().int % 10000000000:010d}",
            hashed_password=get_password_hash("password"),
            role=UserRole.CUSTOMER
        )
        session.add(user1)
        
        user2 = User(
            email=f"u2_{uuid.uuid4().hex[:8]}@example.com",
            phone_number=f"+1{uuid.uuid4().int % 10000000000:010d}",
            hashed_password=get_password_hash("password"),
            role=UserRole.CUSTOMER
        )
        session.add(user2)
        await session.commit()
        await session.refresh(user1)
        await session.refresh(user2)
        return user1, user2

def make_request(method, endpoint, data=None, token=None):
    url = f"http://localhost:8000{endpoint}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if data:
        req.data = json.dumps(data).encode("utf-8")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = response.read().decode("utf-8")
            return status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body

def run_tests():
    print("Seeding database...")
    user1, user2 = asyncio.run(seed_users())
    
    token1 = create_access_token(subject=str(user1.id))
    token2 = create_access_token(subject=str(user2.id))
    
    vehicle_id = None

    print("\n--- TEST 1: Create Vehicle ---")
    status, res = make_request("POST", "/api/v1/vehicles/", {
        "vehicle_type": "CAR",
        "brand": "Toyota",
        "model": "Corolla",
        "fuel_type": "PETROL",
        "registration_number": "ABC-1234",
        "nickname": "My Daily"
    }, token=token1)
    print("Status:", status)
    if status == 201:
        vehicle_id = res["data"]["id"]
        print("Success, Vehicle ID:", vehicle_id)
    else:
        print("Response:", res)
        return

    print("\n--- TEST 2: Get Vehicle ---")
    status, res = make_request("GET", f"/api/v1/vehicles/{vehicle_id}", token=token1)
    print("Status:", status)
    if status == 200:
        print("Success, Brand:", res["data"]["brand"])
    else:
        print("Response:", res)

    print("\n--- TEST 3: List Vehicles ---")
    status, res = make_request("GET", "/api/v1/vehicles/", token=token1)
    print("Status:", status)
    if status == 200:
        print("Success, Count:", len(res["data"]["vehicles"]))
    else:
        print("Response:", res)

    print("\n--- TEST 4: Update Vehicle ---")
    status, res = make_request("PUT", f"/api/v1/vehicles/{vehicle_id}", {
        "nickname": "Old Reliable"
    }, token=token1)
    print("Status:", status)
    if status == 200:
        print("Success, Nickname:", res["data"]["nickname"])
    else:
        print("Response:", res)

    print("\n--- TEST 5: Set Default Vehicle ---")
    # First create another vehicle
    status, res = make_request("POST", "/api/v1/vehicles/", {
        "vehicle_type": "BIKE",
        "brand": "Honda",
        "model": "CBR",
        "fuel_type": "PETROL"
    }, token=token1)
    v2_id = res["data"]["id"]
    status, res = make_request("PATCH", f"/api/v1/vehicles/{v2_id}/default", token=token1)
    print("Status:", status)
    if status == 200:
        print("Success, Is Default:", res["data"]["is_default"])
        # Check first vehicle is not default
        _, res_v1 = make_request("GET", f"/api/v1/vehicles/{vehicle_id}", token=token1)
        print("Vehicle 1 is default:", res_v1["data"]["is_default"])
    else:
        print("Response:", res)

    print("\n--- TEST 6: Duplicate Registration Rejection ---")
    status, res = make_request("POST", "/api/v1/vehicles/", {
        "vehicle_type": "CAR",
        "brand": "Honda",
        "model": "Civic",
        "fuel_type": "PETROL",
        "registration_number": "ABC-1234"
    }, token=token1)
    print("Status:", status)
    if status == 400:
        print("Validation caught successfully:", res.get("detail"))
    else:
        print("Response:", res)

    print("\n--- TEST 7: Unauthorized Access (No Token) ---")
    status, res = make_request("GET", f"/api/v1/vehicles/{vehicle_id}")
    print("Status:", status)
    if status == 401:
        print("Caught 401 Unauthorized")

    print("\n--- TEST 8: Access Another User's Vehicle ---")
    status, res = make_request("GET", f"/api/v1/vehicles/{vehicle_id}", token=token2)
    print("Status:", status)
    if status == 403:
        print("Caught 403 Forbidden correctly")
    else:
        print("Response:", res)

    print("\n--- TEST 9: Delete Vehicle ---")
    status, res = make_request("DELETE", f"/api/v1/vehicles/{vehicle_id}", token=token1)
    print("Status:", status)
    if status == 204:
        print("Success (No Content)")
        _, res = make_request("GET", f"/api/v1/vehicles/{vehicle_id}", token=token1)
        print("Check if deleted (expect 404):", "Pass" if res.get("detail") == "Vehicle not found" else "Fail")

if __name__ == "__main__":
    run_tests()
