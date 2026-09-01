"""Short-lived, single-use tickets for authenticating a WebSocket handshake.

Browsers cannot set an Authorization header on a WebSocket handshake, so the
access token used to be passed as `?token=<JWT>`. Query strings are written to
access logs, proxy logs and browser history, which put a live 15-minute bearer
token in plaintext in every one of them.

A ticket replaces it: the client asks for one over an ordinary authenticated
POST (header auth, never logged), then connects with `?ticket=<opaque>`. The
ticket is random, expires in seconds, and is consumed on first use — so the value
that does land in the logs is worthless by the time anyone reads it.

Scaling limitation: tickets live in this process, matching `ConnectionManager`.
With more than one worker a ticket minted on worker A cannot be redeemed on
worker B; that needs the same shared backplane the fan-out needs (see brain.md).
"""

import secrets
import time
from typing import Dict, Optional, Tuple
from uuid import UUID

#: Long enough to cover a slow handshake, short enough that a leaked ticket in a
#: log is already dead. The ticket is single-use regardless.
TICKET_TTL_SECONDS = 30

_tickets: Dict[str, Tuple[UUID, float]] = {}


def _purge(now: float) -> None:
    for key in [k for k, (_, expires) in _tickets.items() if expires <= now]:
        _tickets.pop(key, None)


def issue(user_id: UUID) -> str:
    """Mint a ticket for an already-authenticated user."""
    now = time.monotonic()
    _purge(now)
    ticket = secrets.token_urlsafe(32)
    _tickets[ticket] = (user_id, now + TICKET_TTL_SECONDS)
    return ticket


def redeem(ticket: str) -> Optional[UUID]:
    """Consume a ticket, returning its user id, or None if invalid/expired/used."""
    now = time.monotonic()
    _purge(now)
    entry = _tickets.pop(ticket, None)  # single use: pop even when expired
    if entry is None:
        return None
    user_id, expires = entry
    return user_id if expires > now else None
