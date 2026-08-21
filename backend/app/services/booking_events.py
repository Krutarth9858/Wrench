"""Booking event contract for the realtime channel.

Events are emitted only after the database transaction that changed the booking
has committed, and only to the two parties of that booking.
"""

from typing import Any, Dict

from app.models.booking import Booking, BookingStatus
from app.services.realtime import manager

# Status -> event name. BOOKING_CREATED is emitted explicitly on creation.
STATUS_EVENTS: Dict[BookingStatus, str] = {
    BookingStatus.PENDING: "BOOKING_CREATED",
    BookingStatus.ACCEPTED: "BOOKING_ACCEPTED",
    BookingStatus.REJECTED: "BOOKING_REJECTED",
    BookingStatus.IN_PROGRESS: "BOOKING_STARTED",
    BookingStatus.COMPLETED: "BOOKING_COMPLETED",
    BookingStatus.CANCELLED: "BOOKING_CANCELLED",
}


def build_event(booking: Booking, event_type: str) -> Dict[str, Any]:
    """Minimal payload: enough to update a list, not enough to leak details.

    Clients refetch over REST for anything richer, which keeps the database
    authoritative and avoids duplicating the booking projection here.
    """
    return {
        "type": event_type,
        "booking_id": str(booking.id),
        "status": booking.status.value,
    }


async def emit_booking_event(booking: Booking, event_type: str | None = None) -> None:
    event = build_event(booking, event_type or STATUS_EVENTS[booking.status])
    await manager.send_to_users([booking.customer_id, booking.mechanic_id], event)
