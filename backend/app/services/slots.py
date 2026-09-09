"""Appointment slot availability.

Slots are derived, never stored: a mechanic's working window (the existing
`working_start_time` / `working_end_time` on the profile) is divided into
service-length slots, and anything overlapping an appointment that still holds
the calendar is removed.

Nothing here invents availability. If the mechanic's window cannot fit the
service, the day simply has no slots.
"""

from datetime import date as Date, datetime, time as Time, timedelta
from typing import List, Sequence, Tuple

from fastapi import HTTPException, status as http_status

# Slots start on this grid, so two customers are offered the same start times
# and the database's unique index is a meaningful guard rather than a formality.
SLOT_GRID_MINUTES = 30


def parse_hhmm(value: str) -> Time:
    """Parse the profile's "HH:MM" working hours. The schema already validates it."""
    hours, minutes = value.split(":")
    return Time(hour=int(hours), minute=int(minutes))


def _to_minutes(value: Time) -> int:
    return value.hour * 60 + value.minute


def _to_time(minutes: int) -> Time:
    return Time(hour=minutes // 60, minute=minutes % 60)


def end_time_for(start: Time, duration_minutes: int) -> Time:
    """The end of a slot. Raises if the service would run past midnight."""
    end = _to_minutes(start) + duration_minutes
    if end > 24 * 60 - 1:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="That service does not fit before the end of the day.",
        )
    return _to_time(end)


def overlaps(a_start: Time, a_end: Time, b_start: Time, b_end: Time) -> bool:
    """Half-open overlap: a slot ending exactly when another starts is fine."""
    return _to_minutes(a_start) < _to_minutes(b_end) and _to_minutes(b_start) < _to_minutes(a_end)


def available_slots(
    working_start: str,
    working_end: str,
    duration_minutes: int,
    taken: Sequence[Tuple[Time, Time]],
    on_date: Date,
    now: datetime,
) -> List[Time]:
    """Every start time that fits the working window and is not already taken.

    `taken` is the mechanic's existing appointments for that date. `now` must be
    the *local* time at the service location (see `app.core.clock`): these slots
    are wall-clock times, and comparing them against UTC offers slots that have
    already passed. It is passed in rather than read here so the caller owns the
    clock and tests are deterministic.
    """
    open_at = _to_minutes(parse_hhmm(working_start))
    close_at = _to_minutes(parse_hhmm(working_end))
    if close_at <= open_at:
        return []

    # A slot in the past is not available. Today is filtered against the clock;
    # earlier dates have no slots at all.
    if on_date < now.date():
        return []
    earliest = _to_minutes(Time(hour=now.hour, minute=now.minute)) if on_date == now.date() else 0

    slots: List[Time] = []
    cursor = open_at
    while cursor + duration_minutes <= close_at:
        if cursor >= earliest:
            start = _to_time(cursor)
            end = _to_time(cursor + duration_minutes)
            if not any(overlaps(start, end, t_start, t_end) for t_start, t_end in taken):
                slots.append(start)
        cursor += SLOT_GRID_MINUTES
    return slots


def assert_within_working_hours(start: Time, end: Time, working_start: str,
                                working_end: str) -> None:
    open_at = _to_minutes(parse_hhmm(working_start))
    close_at = _to_minutes(parse_hhmm(working_end))
    if _to_minutes(start) < open_at or _to_minutes(end) > close_at:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"That time is outside the mechanic's working hours "
                   f"({working_start}–{working_end}).",
        )


def assert_not_in_past(on_date: Date, start: Time, now: datetime) -> None:
    """`now` must be local to the service location — see `available_slots`.

    The appointment instant is built in the same zone as `now` so the two are
    comparable; a naive combine would be an instant in whatever zone the server
    happens to run in.
    """
    starts_at = datetime.combine(on_date, start, tzinfo=now.tzinfo)
    if starts_at < now:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="That appointment time is in the past.",
        )


def horizon_dates(now: datetime, days: int = 14) -> List[Date]:
    """The bookable window offered to customers, starting today."""
    return [(now + timedelta(days=offset)).date() for offset in range(days)]
