import asyncio
import uuid
import urllib.request
import urllib.error
import json

from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash, create_access_token

async def seed_users():
    async with AsyncSessionLocal() as session:
        customer = User(
            email=f"cust_{uuid.uuid4().hex[:8]}@example.com",
            phone_number=f"+1{uuid.uuid4().int % 10000000000:010d}",
            hashed_password=get_password_hash("password"),
            role=UserRole.CUSTOMER
        )
        session.add(customer)
        
        mechanic = User(
            email=f"mech_{uuid.uuid4().hex[:8]}@example.com",
            phone_number=f"+1{uuid.uuid4().int % 10000000000:010d}",
            hashed_password=get_password_hash("password"),
            role=UserRole.MECHANIC
        )
        session.add(mechanic)
        await session.commit()
        await session.refresh(customer)
        await session.refresh(mechanic)
        return customer, mechanic

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
    customer, mechanic = asyncio.run(seed_users())
    
    customer_token = create_access_token(subject=str(customer.id))
    mechanic_token = create_access_token(subject=str(mechanic.id))
    
    print("\n--- TEST 1: Customer Profile Creation ---")
    status, res = make_request("PUT", "/api/v1/profile/customer/", {
        "full_name": "Test Customer",
        "phone_number": "+11234567890",
        "emergency_contact_name": "Emergency",
        "emergency_contact_number": "+10987654321",
        "address": "123 St",
        "city": "City",
        "state": "State",
        "country": "Country",
        "latitude": 10.0,
        "longitude": 20.0
    }, token=customer_token)
    print("Status:", status)
    if status != 200:
        print("Response:", res)
        return
    else:
        print("Success")

    print("\n--- TEST 2: Mechanic Profile Creation ---")
    status, res = make_request("PUT", "/api/v1/profile/mechanic/", {
        "garage_name": "Speedy Auto",
        "owner_name": "Mike Smith",
        "experience_years": 10,
        "specialization": "Engine Repair",
        "supported_vehicle_types": ["Car", "Truck"],
        "address": "456 Auto Blvd",
        "city": "Springfield",
        "state": "IL",
        "country": "USA",
        "latitude": 39.7900,
        "longitude": -89.6400,
        "service_radius_km": 25.5,
        "working_start_time": "08:00",
        "working_end_time": "18:00"
    }, token=mechanic_token)
    print("Status:", status)
    if status != 200:
        print("Response:", res)
    else:
        print("Success")

    print("\n--- TEST 3: RBAC Mechanic accessing Customer ---")
    status, res = make_request("GET", "/api/v1/profile/customer/", token=mechanic_token)
    print("Status:", status)
    print("Response:", res)

    print("\n--- TEST 4: RBAC Customer accessing Mechanic ---")
    status, res = make_request("GET", "/api/v1/profile/mechanic/", token=customer_token)
    print("Status:", status)
    print("Response:", res)

    print("\n--- TEST 5: Customer Location Update ---")
    status, res = make_request("PATCH", "/api/v1/profile/customer/location", {
        "latitude": 45.0,
        "longitude": -100.0
    }, token=customer_token)
    print("Status:", status)
    if status == 200:
        print("New Latitude:", res.get("data", {}).get("latitude"))

    print("\n--- TEST 6: Validation Error (Invalid Vehicle Type) ---")
    status, res = make_request("PUT", "/api/v1/profile/mechanic/", {
        "garage_name": "Speedy Auto",
        "owner_name": "Mike Smith",
        "experience_years": 10,
        "specialization": "Engine Repair",
        "supported_vehicle_types": ["Airplane"], # Invalid
        "address": "456 Auto Blvd",
        "city": "Springfield",
        "state": "IL",
        "country": "USA",
        "latitude": 39.7900,
        "longitude": -89.6400,
        "service_radius_km": 25.5,
        "working_start_time": "08:00",
        "working_end_time": "18:00"
    }, token=mechanic_token)
    print("Status:", status)
    if status == 422:
        print("Validation caught successfully.")
    else:
        print("Response:", res)

if __name__ == "__main__":
    run_tests()
