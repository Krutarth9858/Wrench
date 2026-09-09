"""The Scheduled Service catalogue — the one place service content and prices live.

`SERVICE_CATALOG` is the seed for the `service_packages` table. The database is
the runtime authority (so prices can be edited operationally without a deploy);
this module is where the initial, business-replaceable values are declared, and
the migration seeds from it.

PRICES ARE PLACEHOLDERS. No business-approved price list exists in this
repository, so the amounts below are clearly-marked stand-ins. They are isolated
here deliberately: changing them requires editing this file (or the table), never
application logic and never a React component.

Amounts are in minor units (paise). 149900 == Rs 1,499.00.
"""

from typing import Dict, List, Optional, TypedDict

from app.models.appointment import ServiceType
from app.models.vehicle import VehicleType


class PackageSeed(TypedDict):
    name: str
    description: str
    included_items: List[str]
    best_for: str
    # None means "no fixed price": the mechanic quotes it.
    price_minor: Optional[int]
    duration_minutes: int


_BASIC_INCLUDES = [
    "Engine oil check/replacement",
    "Brake inspection",
    "Tyre pressure and condition check",
    "Battery health check",
    "Coolant and other fluid inspection",
    "Lights and electrical check",
    "General vehicle inspection",
]

_FULL_INCLUDES = [
    "Everything included in Basic Service",
    "Engine oil and filter replacement",
    "Air filter inspection/replacement",
    "Detailed brake inspection",
    "Battery and electrical system inspection",
    "Suspension and steering inspection",
    "Tyre inspection",
    "Coolant, brake fluid and other fluid checks",
    "Detailed overall vehicle inspection",
]

_ENGINE_INCLUDES = [
    "Engine diagnostic scan",
    "Engine performance inspection",
    "Starting/cranking issue diagnosis",
    "Abnormal noise inspection",
    "Overheating diagnosis",
    "Warning-light/error-code check",
    "Basic fuel and ignition system inspection",
    "Diagnostic report with recommended action",
]

_CUSTOM_INCLUDES = [
    "Describe the problem in your own words",
    "Mechanic reviews your request",
    "You receive a quotation before paying",
    "Pay only after you approve the quotation",
]

# (service_type, vehicle_type) -> package definition.
# BIKE == 2-Wheeler, CAR == 4-Wheeler in the existing VehicleType enum.
SERVICE_CATALOG: Dict[ServiceType, Dict[VehicleType, PackageSeed]] = {
    ServiceType.BASIC: {
        VehicleType.BIKE: {
            "name": "Basic Service",
            "description": "Routine maintenance to keep your vehicle in good condition.",
            "included_items": _BASIC_INCLUDES,
            "best_for": "Regular preventive maintenance.",
            "price_minor": 49900,   # PLACEHOLDER
            "duration_minutes": 60,
        },
        VehicleType.CAR: {
            "name": "Basic Service",
            "description": "Routine maintenance to keep your vehicle in good condition.",
            "included_items": _BASIC_INCLUDES,
            "best_for": "Regular preventive maintenance.",
            "price_minor": 149900,  # PLACEHOLDER
            "duration_minutes": 90,
        },
    },
    ServiceType.FULL: {
        VehicleType.BIKE: {
            "name": "Full Service",
            "description": "A comprehensive service covering the major systems of your vehicle.",
            "included_items": _FULL_INCLUDES,
            "best_for": "Periodic or major servicing.",
            "price_minor": 99900,   # PLACEHOLDER
            "duration_minutes": 120,
        },
        VehicleType.CAR: {
            "name": "Full Service",
            "description": "A comprehensive service covering the major systems of your vehicle.",
            "included_items": _FULL_INCLUDES,
            "best_for": "Periodic or major servicing.",
            "price_minor": 299900,  # PLACEHOLDER
            "duration_minutes": 180,
        },
    },
    ServiceType.ENGINE_CHECKUP: {
        VehicleType.BIKE: {
            "name": "Engine Checkup",
            "description": "Focused diagnosis for engine-related problems and performance issues.",
            "included_items": _ENGINE_INCLUDES,
            "best_for": ("Check-engine lights, poor performance, starting problems, "
                         "overheating and unusual engine sounds."),
            "price_minor": 79900,   # PLACEHOLDER
            "duration_minutes": 90,
        },
        VehicleType.CAR: {
            "name": "Engine Checkup",
            "description": "Focused diagnosis for engine-related problems and performance issues.",
            "included_items": _ENGINE_INCLUDES,
            "best_for": ("Check-engine lights, poor performance, starting problems, "
                         "overheating and unusual engine sounds."),
            "price_minor": 199900,  # PLACEHOLDER
            "duration_minutes": 120,
        },
    },
    ServiceType.CUSTOM: {
        VehicleType.BIKE: {
            "name": "Custom Service",
            "description": ("Tell us what your vehicle needs and submit a service request "
                            "for a specific problem."),
            "included_items": _CUSTOM_INCLUDES,
            "best_for": "Anything that does not fit a standard package.",
            "price_minor": None,    # quoted by the mechanic — never fabricated
            "duration_minutes": 60,
        },
        VehicleType.CAR: {
            "name": "Custom Service",
            "description": ("Tell us what your vehicle needs and submit a service request "
                            "for a specific problem."),
            "included_items": _CUSTOM_INCLUDES,
            "best_for": "Anything that does not fit a standard package.",
            "price_minor": None,    # quoted by the mechanic — never fabricated
            "duration_minutes": 90,
        },
    },
}


def seed_rows() -> List[dict]:
    """Flatten the catalogue into rows for the seeding migration."""
    rows: List[dict] = []
    for service_type, per_vehicle in SERVICE_CATALOG.items():
        for vehicle_type, seed in per_vehicle.items():
            rows.append({
                "service_type": service_type.value,
                "vehicle_type": vehicle_type.value,
                **seed,
            })
    return rows
