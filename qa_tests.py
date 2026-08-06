import urllib.request
import urllib.error
import json
import uuid

BASE_URL = "http://localhost:8000/api/v1/auth"

def make_request(method, endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
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
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    phone = f"+1{uuid.uuid4().int % 10000000000:010d}"
    password = "StrongPassword123!"

    print("--- 1. Register valid user ---")
    status, res = make_request("POST", "/register", {
        "email": email,
        "phone_number": phone,
        "password": password
    })
    print(f"Status: {status}")
    print(f"Response: {res}")
    
    print("\n--- 2. Register duplicate email ---")
    status, res = make_request("POST", "/register", {
        "email": email,
        "phone_number": "+19999999999",
        "password": password
    })
    print(f"Status: {status}")
    
    print("\n--- 3. Register duplicate phone ---")
    status, res = make_request("POST", "/register", {
        "email": f"new_{email}",
        "phone_number": phone,
        "password": password
    })
    print(f"Status: {status}")
    
    print("\n--- 4. Register invalid email ---")
    status, res = make_request("POST", "/register", {
        "email": "not-an-email",
        "phone_number": "+18888888888",
        "password": password
    })
    print(f"Status: {status}")

    print("\n--- 5. Register weak password ---")
    status, res = make_request("POST", "/register", {
        "email": f"weak_{email}",
        "phone_number": "+17777777777",
        "password": "short"
    })
    print(f"Status: {status}")

    print("\n--- 6. Login correct ---")
    status, res = make_request("POST", "/login", {
        "email": email,
        "password": password
    })
    print(f"Status: {status}")
    if status == 200:
        access_token = res["data"]["access_token"]
        refresh_token = res["data"]["refresh_token"]
    else:
        access_token = None
        refresh_token = None

    print("\n--- 7. Login wrong password ---")
    status, res = make_request("POST", "/login", {
        "email": email,
        "password": "WrongPassword123!"
    })
    print(f"Status: {status}")

    print("\n--- 8. Get /me valid ---")
    status, res = make_request("GET", "/me", token=access_token)
    print(f"Status: {status}")

    print("\n--- 9. Get /me invalid token ---")
    status, res = make_request("GET", "/me", token="invalidtoken")
    print(f"Status: {status}")

    print("\n--- 10. Refresh valid ---")
    status, res = make_request("POST", "/refresh", {
        "refresh_token": refresh_token
    })
    print(f"Status: {status}")
    if status == 200:
        access_token = res["data"]["access_token"]
        refresh_token = res["data"]["refresh_token"]

    print("\n--- 11. Refresh invalid ---")
    status, res = make_request("POST", "/refresh", {
        "refresh_token": "tampered_token"
    })
    print(f"Status: {status}")

    print("\n--- 12. Logout ---")
    status, res = make_request("POST", "/logout", {
        "refresh_token": refresh_token
    }, token=access_token)
    print(f"Status: {status}")

    print("\n--- 13. Refresh after logout ---")
    status, res = make_request("POST", "/refresh", {
        "refresh_token": refresh_token
    })
    print(f"Status: {status}")

run_tests()
