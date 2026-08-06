import urllib.request
import urllib.error
import json
import uuid

BASE_URL = "http://localhost:8000/api/v1"

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
    print("--- SPRINT 3 QA TESTS ---")
    
    # 1. Setup - Create Customer
    customer_email = f"cust_{uuid.uuid4().hex[:8]}@example.com"
    customer_phone = f"+1{uuid.uuid4().int % 10000000000:010d}"
    print("\n[+] Registering Customer")
    # We need a way to register a customer vs mechanic. Wait! 
    # The registration endpoint in Sprint 2 currently defaults the role or doesn't accept role!
    # Let's check how registration handles roles. 
    # Ah, let's just make the request and see.
    pass

if __name__ == "__main__":
    run_tests()
