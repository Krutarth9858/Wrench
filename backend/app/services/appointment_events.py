"""Appointment event contract for the realtime channel.

The *same* socket and the same ConnectionManager the emergency booking flow uses
— there is only one realtime architecture. Appointment events carry their own
type names so a client can tell the two flows apart and never confuses a
scheduled service with a roadside booking.

Events are emitted only after the transaction that changed the appointment has
committed, and only to the two parties of that appointment.
"""

from typing import Any, Dict

from app.models.appointment import Appointment, AppointmentStatus
from app.services.realtime import manager

STATUS_EVENTS: Dict[AppointmentStatus, str] = {
    AppointmentStatus.REQUESTED: "APPOINTMENT_REQUESTED",
    AppointmentStatus.QUOTED: "APPOINTMENT_QUOTED",
    AppointmentStatus.PAYMENT_PENDING: "APPOINTMENT_PAYMENT_PENDING",
    AppointmentStatus.PAYMENT_CONFIRMED: "APPOINTMENT_PAYMENT_CONFIRMED",
    AppointmentStatus.CONFIRMED: "APPOINTMENT_CONFIRMED",
    AppointmentStatus.IN_SERVICE: "APPOINTMENT_STARTED",
    AppointmentStatus.COMPLETED: "APPOINTMENT_COMPLETED",
    AppointmentStatus.DECLINED: "APPOINTMENT_DECLINED",
    AppointmentStatus.CANCELLED: "APPOINTMENT_CANCELLED",
}


def build_event(appointment: Appointment, event_type: str) -> Dict[str, Any]:
    """Minimal payload: enough to know something changed, not enough to leak
    details. Clients refetch over REST, keeping the database authoritative."""
    return {
        "type": event_type,
        "appointment_id": str(appointment.id),
        "status": appointment.status.value,
    }


async def emit_appointment_event(appointment: Appointment,
                                 event_type: str | None = None) -> None:
    event = build_event(appointment, event_type or STATUS_EVENTS[appointment.status])
    await manager.send_to_users([appointment.customer_id, appointment.mechanic_id], event)
