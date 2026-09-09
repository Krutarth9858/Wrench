"""The single authority for Scheduled Service status transitions.

Deliberately separate from `booking_state.py`: emergency assistance keeps
PENDING -> ACCEPTED -> IN_PROGRESS -> COMPLETED, and the two machines never share
a status value or a transition table.

Clients never send a status. They call an intent endpoint (pay / accept /
decline / start / complete / cancel / quote) and the server decides.

    fixed price                       custom
    -----------                       ------
    PAYMENT_PENDING                   REQUESTED
        | pay (verified server-side)      | quote (mechanic)
        v                                 v
    PAYMENT_CONFIRMED                 QUOTED
        | accept (mechanic)               | accept quotation (customer)
        v                                 v
    CONFIRMED                         PAYMENT_PENDING -> (as fixed price)
        | start (mechanic)
        v
    IN_SERVICE
        | complete (mechanic)
        v
    COMPLETED
"""

from typing import Dict, FrozenSet

from fastapi import HTTPException, status as http_status

from app.models.appointment import AppointmentStatus
from app.models.user import UserRole

S = AppointmentStatus

# (role, current status) -> statuses that role may move the appointment to.
_ALLOWED: Dict[UserRole, Dict[AppointmentStatus, FrozenSet[AppointmentStatus]]] = {
    UserRole.MECHANIC: {
        # A custom request is quoted before anything else can happen.
        S.REQUESTED: frozenset({S.QUOTED, S.DECLINED}),
        # Paid work still needs the mechanic to take it on, or refuse it.
        S.PAYMENT_CONFIRMED: frozenset({S.CONFIRMED, S.DECLINED}),
        S.CONFIRMED: frozenset({S.IN_SERVICE, S.DECLINED}),
        S.IN_SERVICE: frozenset({S.COMPLETED}),
    },
    UserRole.CUSTOMER: {
        # Withdrawing is allowed until the mechanic actually starts work.
        S.REQUESTED: frozenset({S.CANCELLED}),
        # Accepting a quotation moves it to payment; rejecting it cancels.
        S.QUOTED: frozenset({S.PAYMENT_PENDING, S.CANCELLED}),
        S.PAYMENT_PENDING: frozenset({S.CANCELLED}),
        S.PAYMENT_CONFIRMED: frozenset({S.CANCELLED}),
        S.CONFIRMED: frozenset({S.CANCELLED}),
    },
}

TERMINAL_STATUSES = frozenset({S.COMPLETED, S.DECLINED, S.CANCELLED})

# Statuses that still occupy the mechanic's calendar slot. A declined, cancelled
# or completed appointment frees its slot for someone else.
BLOCKING_STATUSES = frozenset({
    S.REQUESTED, S.QUOTED, S.PAYMENT_PENDING, S.PAYMENT_CONFIRMED,
    S.CONFIRMED, S.IN_SERVICE,
})

# Payment is only ever applied to an appointment waiting for it.
PAYABLE_STATUSES = frozenset({S.PAYMENT_PENDING})


def is_allowed(role: UserRole, current: AppointmentStatus, target: AppointmentStatus) -> bool:
    return target in _ALLOWED.get(role, {}).get(current, frozenset())


def assert_transition(role: UserRole, current: AppointmentStatus,
                      target: AppointmentStatus) -> None:
    """Raise 409 unless `role` may move an appointment from `current` to `target`."""
    if is_allowed(role, current, target):
        return
    if current in TERMINAL_STATUSES:
        detail = f"Appointment is already {current.value} and cannot be changed."
    else:
        detail = f"Cannot move a {current.value} appointment to {target.value}."
    raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=detail)
