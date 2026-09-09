"""Appointment slots are wall-clock local time, not UTC.

Regression: `_now()` returned UTC wall-clock and was compared against the
mechanic's local working hours. In IST (UTC+05:30) the server believed local
time was five and a half hours earlier than it was, so at 14:00 IST it still
offered the 09:00 slot — an appointment time that had already passed. The
mirror-image failure hides valid morning slots in zones behind UTC.

These are pure functions with an injected clock, so they assert the rule rather
than whatever the wall clock happens to say when the suite runs.
"""

from datetime import date as Date, datetime, time as Time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

from app.services.slots import (
    assert_not_in_past, assert_within_working_hours, available_slots, end_time_for,
)

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc
DAY = Date(2026, 9, 9)

WORK_START, WORK_END = "09:00", "18:00"
SIXTY = 60


def ist(hour: int, minute: int = 0, on: Date = DAY) -> datetime:
    return datetime(on.year, on.month, on.day, hour, minute, tzinfo=IST)


# ---------------------------------------------------------------- the boundary

def test_morning_slot_survives_until_its_local_time():
    """08:30 IST: the 09:00 appointment has not happened yet."""
    slots = available_slots(WORK_START, WORK_END, SIXTY, [], DAY, ist(8, 30))
    assert Time(9, 0) in slots


def test_morning_slot_is_gone_once_its_local_time_has_passed():
    """10:00 IST: 09:00 is in the past and must not be offered."""
    slots = available_slots(WORK_START, WORK_END, SIXTY, [], DAY, ist(10, 0))
    assert Time(9, 0) not in slots
    assert Time(10, 0) in slots


def test_utc_clock_would_have_offered_slots_that_already_passed():
    """The exact defect, pinned.

    At 14:00 IST the same instant is 08:30 UTC. Feeding the UTC wall clock in
    offers 09:00 through 13:30 — every one of them already past locally.
    """
    same_instant_utc = ist(14, 0).astimezone(UTC)

    correct = available_slots(WORK_START, WORK_END, SIXTY, [], DAY, ist(14, 0))
    wrong = available_slots(WORK_START, WORK_END, SIXTY, [], DAY, same_instant_utc)

    assert Time(9, 0) not in correct and Time(13, 0) not in correct
    assert correct[0] == Time(14, 0)
    # Demonstrates what the bug produced, so a regression is unmistakable.
    assert Time(9, 0) in wrong


def test_late_evening_ist_does_not_leak_into_the_next_day():
    """23:30 IST is 18:00 UTC — the UTC clock would still call it 'today'."""
    slots = available_slots(WORK_START, WORK_END, SIXTY, [], DAY, ist(23, 30))
    assert slots == []


def test_after_midnight_ist_offers_the_whole_working_day():
    """00:30 IST is still the previous day in UTC."""
    slots = available_slots(WORK_START, WORK_END, SIXTY, [], DAY, ist(0, 30))
    assert slots[0] == Time(9, 0)


# ------------------------------------------------------------------- the rules

def test_tomorrow_is_offered_in_full_regardless_of_the_time_now():
    tomorrow = DAY + timedelta(days=1)
    slots = available_slots(WORK_START, WORK_END, SIXTY, [], tomorrow, ist(17, 45))
    assert slots[0] == Time(9, 0)
    assert slots[-1] == Time(17, 0)


def test_a_past_date_has_no_slots():
    yesterday = DAY - timedelta(days=1)
    assert available_slots(WORK_START, WORK_END, SIXTY, [], yesterday, ist(9, 0)) == []


def test_slots_stay_inside_the_working_window():
    slots = available_slots("09:00", "12:00", 90, [], DAY, ist(0, 0))
    assert slots == [Time(9, 0), Time(9, 30), Time(10, 0), Time(10, 30)]


def test_a_booked_range_removes_every_overlapping_start():
    taken = [(Time(10, 0), Time(11, 30))]
    slots = available_slots(WORK_START, WORK_END, SIXTY, taken, DAY, ist(0, 0))
    assert Time(9, 0) in slots
    assert Time(10, 0) not in slots and Time(11, 0) not in slots
    assert Time(11, 30) in slots


def test_creation_and_generation_agree_on_what_is_past():
    """A slot the generator offers must also pass creation validation, and one
    it withholds must be refused — the two share the same clock."""
    now = ist(10, 30)
    offered = available_slots(WORK_START, WORK_END, SIXTY, [], DAY, now)

    assert_not_in_past(DAY, offered[0], now)  # does not raise

    with pytest.raises(HTTPException) as refused:
        assert_not_in_past(DAY, Time(9, 0), now)
    assert refused.value.status_code == 422


def test_working_hours_are_enforced_on_creation():
    with pytest.raises(HTTPException) as exc:
        assert_within_working_hours(Time(17, 30), Time(18, 30), WORK_START, WORK_END)
    assert exc.value.status_code == 409
    # The boundary itself is allowed.
    assert_within_working_hours(Time(17, 0), Time(18, 0), WORK_START, WORK_END)


def test_a_service_cannot_run_past_midnight():
    with pytest.raises(HTTPException) as exc:
        end_time_for(Time(23, 30), 120)
    assert exc.value.status_code == 422
