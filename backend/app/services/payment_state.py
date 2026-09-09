"""The single authority for payment status transitions.

Separate from `appointment_state.py` on purpose: an appointment's scheduling
state and its money state answer different questions and move independently.
A CONFIRMED appointment can be PAID or awaiting a refund; a CANCELLED one can
still owe money back.

    PENDING ──verified──▶ PAID ──decline/cancel──▶ REFUND_PENDING
       │                                              │ refund accepted
       │ signature or gateway failure                 ▼
       ▼                                       REFUND_INITIATED
    FAILED  ──retry──▶ PENDING                        │ gateway confirms
                                                      ▼
                                                  REFUNDED
    REFUND_INITIATED ──gateway rejects──▶ REFUND_FAILED ──retry──▶ REFUND_PENDING

NOT_REQUIRED is the resting state of a custom request that has no price yet.
"""

from typing import Dict, FrozenSet

from fastapi import HTTPException, status as http_status

from app.models.appointment import PaymentStatus

P = PaymentStatus

_ALLOWED: Dict[PaymentStatus, FrozenSet[PaymentStatus]] = {
    # A quotation turns an unpriced request into a payable one.
    P.NOT_REQUIRED: frozenset({P.PENDING}),
    P.PENDING: frozenset({P.PAID, P.FAILED}),
    # A failed checkout can be retried; the appointment keeps its slot.
    P.FAILED: frozenset({P.PENDING}),
    P.PAID: frozenset({P.REFUND_PENDING}),
    P.REFUND_PENDING: frozenset({P.REFUND_INITIATED, P.REFUND_FAILED}),
    # Only the gateway moves money to REFUNDED.
    P.REFUND_INITIATED: frozenset({P.REFUNDED, P.REFUND_FAILED}),
    P.REFUND_FAILED: frozenset({P.REFUND_PENDING, P.REFUND_INITIATED}),
    P.REFUNDED: frozenset(),
}

#: Money is settled and can never move again.
TERMINAL_STATUSES = frozenset({P.REFUNDED})

#: A refund is owed or in flight — used to keep repeated cancellations from
#: issuing a second refund.
REFUND_STATUSES = frozenset({
    P.REFUND_PENDING, P.REFUND_INITIATED, P.REFUNDED, P.REFUND_FAILED,
})


def is_allowed(current: PaymentStatus, target: PaymentStatus) -> bool:
    return target in _ALLOWED.get(current, frozenset())


def assert_transition(current: PaymentStatus, target: PaymentStatus) -> None:
    """Raise 409 unless a payment may move from `current` to `target`."""
    if is_allowed(current, target):
        return
    raise HTTPException(
        status_code=http_status.HTTP_409_CONFLICT,
        detail=f"Cannot move a {current.value} payment to {target.value}.",
    )
