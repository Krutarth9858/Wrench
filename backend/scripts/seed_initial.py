"""Seed initial admin and optional demo fixtures idempotently."""

import asyncio
import os
import sys
from decimal import Decimal

from app.core.security import get_password_hash
from app.db.repositories.user import UserRepository
from app.db.session import AsyncSessionLocal
from app.models.profile import CustomerProfile, MechanicProfile
from app.models.user import User, UserRole
from app.models.vehicle import FuelType, Vehicle, VehicleType


async def seed_initial():
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)

        # 1. Seed Admin if configured
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@wrench.com")
        admin_pass = os.environ.get("ADMIN_PASSWORD", "AdminSecure2026!")
        admin_phone = os.environ.get("ADMIN_PHONE", "+919876543200")

        if admin_email and admin_pass:
            existing_admin = await user_repo.get_by_email(admin_email)
            if not existing_admin:
                admin_user = User(
                    email=admin_email,
                    phone_number=admin_phone,
                    hashed_password=get_password_hash(admin_pass),
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_email_verified=True,
                )
                await user_repo.create(admin_user)
                print(f"[Seed] Created ADMIN user: {admin_email}")
            else:
                print(f"[Seed] Admin user {admin_email} already exists.")

        # 2. Seed Demo Customer & Mechanic if AUTO_SEED is enabled
        auto_seed = os.environ.get("AUTO_SEED", "true").lower() in ("true", "1", "yes")
        if auto_seed:
            cust_email = "kaushal@wrench.com"
            existing_cust = await user_repo.get_by_email(cust_email)
            if not existing_cust:
                cust_user = User(
                    email=cust_email,
                    phone_number="+919876543210",
                    hashed_password=get_password_hash("Password123!"),
                    role=UserRole.CUSTOMER,
                    is_active=True,
                    is_email_verified=True,
                )
                cust_user = await user_repo.create(cust_user)

                cust_profile = CustomerProfile(
                    user_id=cust_user.id,
                    full_name="Kaushal Patel",
                    phone_number="+919876543210",
                    emergency_contact_name="Gaurav Patel",
                    emergency_contact_number="+919876543299",
                    address="Titanium City Center, Satellite Road",
                    city="Ahmedabad",
                    state="Gujarat",
                    country="India",
                    latitude=Decimal("23.022500"),
                    longitude=Decimal("72.520000"),
                )
                session.add(cust_profile)

                vehicle = Vehicle(
                    user_id=cust_user.id,
                    vehicle_type=VehicleType.CAR,
                    brand="Honda",
                    model="City ZX i-VTEC",
                    fuel_type=FuelType.PETROL,
                    registration_number="GJ01AB1234",
                    nickname="My City",
                    is_default=True,
                )
                session.add(vehicle)
                await session.commit()
                print(f"[Seed] Created Demo Customer: {cust_email}")
            else:
                print(f"[Seed] Customer {cust_email} already exists.")

            mech_email = "apex.mechanic@wrench.com"
            existing_mech = await user_repo.get_by_email(mech_email)
            if not existing_mech:
                mech_user = User(
                    email=mech_email,
                    phone_number="+919876543211",
                    hashed_password=get_password_hash("Password123!"),
                    role=UserRole.MECHANIC,
                    is_active=True,
                    is_email_verified=True,
                )
                mech_user = await user_repo.create(mech_user)

                mech_profile = MechanicProfile(
                    user_id=mech_user.id,
                    garage_name="Apex Auto Care & Diagnostics",
                    owner_name="Vikram Patel",
                    experience_years=8,
                    bio="Certified multi-brand automobile diagnostic and express roadside assistance workshop.",
                    specialization="Engine Electricals & Suspension Diagnostics",
                    supported_vehicle_types=[VehicleType.CAR, VehicleType.BIKE],
                    address="Ground Floor, Titanium City Center, Satellite Road",
                    city="Ahmedabad",
                    state="Gujarat",
                    country="India",
                    latitude=Decimal("23.022500"),
                    longitude=Decimal("72.520000"),
                    service_radius_km=25.0,
                    working_start_time="08:00",
                    working_end_time="22:00",
                    is_available=True,
                    is_verified=True,
                )
                session.add(mech_profile)
                await session.commit()
                print(f"[Seed] Created Demo Mechanic: {mech_email}")
            else:
                print(f"[Seed] Mechanic {mech_email} already exists.")


def main():
    asyncio.run(seed_initial())


if __name__ == "__main__":
    main()
