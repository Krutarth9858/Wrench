"""The application's two clocks, kept deliberately distinct.

Wrench stores two different kinds of time and they must not be compared to
each other:

* **System timestamps** — `created_at`, `updated_at`, `quoted_at`, token expiry.
  These are instants. They are UTC and stay UTC.

* **Appointment wall-clock time** — `scheduled_date`, `start_time`, `end_time`,
  and a mechanic's `working_start_time` / `working_end_time`. These are local
  times at the service location: "10:00" means ten in the morning where the
  garage is, not an instant on a global timeline.

The original bug was comparing the second kind against the first. `_now()`
returned UTC wall-clock, so in IST (UTC+05:30) the server believed the local
time was five and a half hours earlier than it was and offered slots that had
already passed. The mirror-image failure hides valid morning slots in
timezones behind UTC.

`APP_TIMEZONE` names the zone the appointment wall-clock is expressed in.
"""

from datetime import date as Date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings


def app_timezone() -> ZoneInfo:
    """The configured service-location timezone.

    A bad value is a configuration error worth failing loudly on rather than
    silently serving appointments in the wrong zone.
    """
    try:
        return ZoneInfo(settings.APP_TIMEZONE)
    except ZoneInfoNotFoundError as exc:  # pragma: no cover - configuration error
        raise RuntimeError(
            f"APP_TIMEZONE={settings.APP_TIMEZONE!r} is not a known IANA timezone."
        ) from exc


def local_now() -> datetime:
    """Timezone-aware 'now' in the application timezone.

    Use this for anything compared against appointment wall-clock values.
    """
    return datetime.now(app_timezone())


def local_today() -> Date:
    return local_now().date()


def system_now() -> datetime:
    """Timezone-aware UTC 'now', for instants recorded on a row."""
    return datetime.now(timezone.utc)
