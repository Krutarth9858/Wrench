"""Provision an ADMIN user out-of-band.

ADMIN cannot be created through the public API by design: app/schemas/user.py
restricts self-registration to CUSTOMER and MECHANIC, so a crafted
`role: "ADMIN"` request is rejected with 422. This script is the only path.

Usage (from backend/):
    ./venv/bin/python -m scripts.create_admin --email a@b.com --phone +11234567890

The password is read from the ADMIN_PASSWORD environment variable, or prompted
for interactively. It is never taken from argv, so it cannot leak into shell
history or the process list.
"""

import argparse
import asyncio
import getpass
import os
import sys

from app.core.security import get_password_hash
from app.db.repositories.user import UserRepository
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole


async def create_admin(email: str, phone_number: str, password: str) -> None:
    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)
        if await repo.get_by_email(email):
            sys.exit(f"A user with email {email} already exists.")
        if await repo.get_by_phone_number(phone_number):
            sys.exit(f"A user with phone number {phone_number} already exists.")
        user = await repo.create(
            User(
                email=email,
                phone_number=phone_number,
                hashed_password=get_password_hash(password),
                role=UserRole.ADMIN,
            )
        )
        print(f"Created ADMIN {user.email} ({user.id})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a Wrench ADMIN user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--phone", required=True, help="E.164, e.g. +11234567890")
    args = parser.parse_args()

    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")

    asyncio.run(create_admin(args.email, args.phone, password))


if __name__ == "__main__":
    main()
