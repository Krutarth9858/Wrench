"""The single authority for booking status transitions (RAD FR-05).

Nothing else in the codebase may set `Booking.status`; every change goes through
`assert_transition`. Clients never send a status value — they call an intent
endpoint (accept / reject / start / complete / cancel) and the server decides.

    PENDING ──accept──▶ ACCEPTED ──start──▶ IN_PROGRESS ──complete──▶ COMPLETED
       │                    │
       │ reject             │
       ▼                    │
    REJECTED                │
       ▲                    │
       └── cancel ──────────┴──▶ CANCELLED   (customer, before work starts)
"""

from typing import Dict, FrozenSet

from fastapi import HTTPException, status as http_status

from app.models.booking import BookingStatus
from app.models.user import UserRole

# (role, current status) -> statuses that role may move the booking to.
_ALLOWED: Dict[UserRole, Dict[BookingStatus, FrozenSet[BookingStatus]]] = {
    UserRole.MECHANIC: {
        BookingStatus.PENDING: frozenset({BookingStatus.ACCEPTED, BookingStatus.REJECTED}),
        BookingStatus.ACCEPTED: frozenset({BookingStatus.IN_PROGRESS}),
        BookingStatus.IN_PROGRESS: frozenset({BookingStatus.COMPLETED}),
    },
    UserRole.CUSTOMER: {
        # A customer may withdraw until the mechanic actually starts work.
        BookingStatus.PENDING: frozenset({BookingStatus.CANCELLED}),
        BookingStatus.ACCEPTED: frozenset({BookingStatus.CANCELLED}),
    },
}

TERMINAL_STATUSES = frozenset(
    {BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED}
)


def is_allowed(role: UserRole, current: BookingStatus, target: BookingStatus) -> bool:
    return target in _ALLOWED.get(role, {}).get(current, frozenset())


def assert_transition(role: UserRole, current: BookingStatus, target: BookingStatus) -> None:
    """Raise 409 unless `role` may move a booking from `current` to `target`."""
    if is_allowed(role, current, target):
        return
    if current in TERMINAL_STATUSES:
        detail = f"Booking is already {current.value} and cannot be changed."
    else:
        detail = f"Cannot move a {current.value} booking to {target.value}."
    raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=detail)
