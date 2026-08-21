import pytest

@pytest.mark.asyncio
async def test_customer_profile_creation(client, customer_token):
    headers = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "full_name": "John Doe",
        "phone_number": "+11234567890",
        "emergency_contact_name": "Jane Doe",
        "emergency_contact_number": "+10987654321",
        "address": "123 Main St",
        "city": "Springfield",
        "state": "IL",
        "country": "USA",
        "latitude": 39.7817,
        "longitude": -89.6501
    }
    
    response = await client.put("/api/v1/profile/customer/", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["full_name"] == "John Doe"
    assert "id" in data

@pytest.mark.asyncio
async def test_customer_forbidden_for_mechanic(client, mechanic_token):
    headers = {"Authorization": f"Bearer {mechanic_token}"}
    response = await client.get("/api/v1/profile/customer/", headers=headers)
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_mechanic_profile_creation(client, mechanic_token):
    headers = {"Authorization": f"Bearer {mechanic_token}"}
    payload = {
        "garage_name": "Speedy Auto",
        "owner_name": "Mike Smith",
        "experience_years": 10,
        "specialization": "Engine Repair",
        # Canonical VehicleType values. "Truck" was removed in Phase 2: RAD section 3
        # limits scope to two- and four-wheelers and excludes heavy commercial vehicles.
        "supported_vehicle_types": ["CAR", "BIKE"],
        "address": "456 Auto Blvd",
        "city": "Springfield",
        "state": "IL",
        "country": "USA",
        "latitude": 39.7900,
        "longitude": -89.6400,
        "service_radius_km": 25.5,
        "working_start_time": "08:00",
        "working_end_time": "18:00"
    }
    
    response = await client.put("/api/v1/profile/mechanic/", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["garage_name"] == "Speedy Auto"
    assert data["supported_vehicle_types"] == ["CAR", "BIKE"]

@pytest.mark.asyncio
async def test_mechanic_forbidden_for_customer(client, customer_token):
    headers = {"Authorization": f"Bearer {customer_token}"}
    response = await client.get("/api/v1/profile/mechanic/", headers=headers)
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_customer_location_update(client, customer_token):
    headers = {"Authorization": f"Bearer {customer_token}"}
    # Ensure profile exists first
    await client.put("/api/v1/profile/customer/", json={
        "full_name": "Location Tester",
        "phone_number": "+11234567890",
        "emergency_contact_name": "Jane",
        "emergency_contact_number": "+10987654321",
        "address": "Loc St",
        "city": "Loc City",
        "state": "IL",
        "country": "USA",
        "latitude": 0.0,
        "longitude": 0.0
    }, headers=headers)

    payload = {
        "latitude": 40.0,
        "longitude": -90.0
    }
    response = await client.patch("/api/v1/profile/customer/location", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["latitude"] == 40.0
    assert data["longitude"] == -90.0

@pytest.mark.asyncio
async def test_404_profile_not_found(client, customer_token):
    # Every table is truncated before each test (tests/conftest.py::_clean_tables),
    # so this customer genuinely has no profile yet.
    headers = {"Authorization": f"Bearer {customer_token}"}
    response = await client.get("/api/v1/profile/customer/", headers=headers)
    assert response.status_code == 404
