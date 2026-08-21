"""Create development test accounts and mechanic profiles.

Development only. It talks to the running API rather than the database, so every
account it creates goes through the same validation and RBAC as a real signup —
nothing is inserted behind the application's back.

Usage (backend running on :8000):
    ./venv/bin/python -m scripts.seed_dev
    ./venv/bin/python -m scripts.seed_dev --api http://127.0.0.1:8000/api/v1

Prints the generated credentials. Emails are randomised so the script can be run
repeatedly without colliding with existing accounts.
"""

import argparse
import json
import random
import sys
import urllib.error
import urllib.request

PASSWORD = "password123"

# Coordinates used for the seeded garages (Ahmedabad). Development fixtures only.
ORIGIN = (23.0225, 72.5714)
GARAGES = [
    ("Dev Two-Wheeler Garage", ["BIKE"], 23.0425, 72.5714, 25.0),
    ("Dev Four-Wheeler Garage", ["CAR"], 23.0525, 72.5714, 25.0),
    ("Dev All-Vehicle Garage", ["BIKE", "CAR"], 23.0725, 72.5714, 30.0),
]


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")

    def call(self, method: str, path: str, body=None, token: str | None = None):
        request = urllib.request.Request(self.base + path, method=method)
        request.add_header("Content-Type", "application/json")
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        if body is not None:
            request.data = json.dumps(body).encode()
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")
        except urllib.error.URLError as error:
            sys.exit(f"Cannot reach {self.base} — is the backend running? ({error.reason})")

    def account(self, prefix: str, role: str = "CUSTOMER") -> tuple[str, str]:
        digits = random.randint(1_000_000, 9_999_999)
        email = f"{prefix}{digits}@example.com"
        status, body = self.call("POST", "/auth/register", {
            "email": email, "phone_number": f"+1{digits:010d}",
            "password": PASSWORD, "role": role,
        })
        if status != 201:
            sys.exit(f"Could not register {email}: {status} {body}")
        _, tokens = self.call("POST", "/auth/login", {"email": email, "password": PASSWORD})
        return email, tokens["data"]["access_token"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Wrench development accounts.")
    parser.add_argument("--api", default="http://127.0.0.1:8000/api/v1")
    args = parser.parse_args()
    api = Api(args.api)

    print("Seeding development accounts…\n")

    mechanics = []
    for name, types, latitude, longitude, radius in GARAGES:
        email, token = api.account("dev.mech.", "MECHANIC")
        status, _ = api.call("PUT", "/profile/mechanic/", {
            "garage_name": name, "owner_name": "Dev Owner", "experience_years": 5,
            "specialization": "General repair", "supported_vehicle_types": types,
            "address": "1 Development Road", "city": "Ahmedabad", "state": "GJ",
            "country": "India", "latitude": latitude, "longitude": longitude,
            "service_radius_km": radius, "working_start_time": "08:00",
            "working_end_time": "20:00",
        }, token)
        if status != 200:
            sys.exit(f"Could not create the profile for {name}: {status}")
        mechanics.append((name, email, types))
        print(f"  MECHANIC  {email}  ({name}, {'/'.join(types)}, available)")

    customer_email, _ = api.account("dev.cust.")
    # Deliberately no saved vehicles: booking must work without one.
    print(f"  CUSTOMER  {customer_email}  (no saved vehicles)")

    print(f"\n  Password for every account: {PASSWORD}")
    print(f"  Search from: {ORIGIN[0]}, {ORIGIN[1]}")
    print("\nSign in at http://localhost:5173/login")


if __name__ == "__main__":
    main()
