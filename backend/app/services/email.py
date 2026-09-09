"""The single transactional-email boundary for Wrench.

Everything that sends mail goes through `get_mailer()`, the same shape the LLM
and payment boundaries use (`services/llm.py`, `services/payment_gateway.py`).

Configuration (app/core/config.py):
    EMAIL_PROVIDER   console | resend      (default: console)
    EMAIL_API_KEY    provider key, required for any real provider
    EMAIL_FROM       verified sender, e.g. "Wrench <no-reply@yourdomain.com>"

`resend` sends real email through Resend's HTTPS API. `console` is the offline
default so the app runs and the suite passes without an account — it is not a
fake mail server: it implements the same `Mailer` protocol, records what was
sent in memory for tests to assert on, and logs only that a message went out.

Nothing here ever logs a message body: OTP codes must not reach logs.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API = "https://api.resend.com/emails"


class EmailError(RuntimeError):
    """The provider was unreachable or refused the message."""


@dataclass
class SentEmail:
    to: str
    subject: str
    html: str
    text: str


def _redact(address: str) -> str:
    """`someone@example.com` -> `s***@example.com`, safe to log."""
    local, _, domain = address.partition("@")
    if not domain:
        return "***"
    return f"{local[:1]}***@{domain}"


class Mailer(Protocol):
    name: str

    async def send(self, to: str, subject: str, html: str, text: str) -> None:
        """Deliver one message. Raise EmailError if it could not be sent."""


class ConsoleMailer:
    """Offline provider used by default and in tests.

    Keeps the last messages in memory so tests can assert on what was sent
    without a network call — and without the body ever reaching a log.
    """

    name = "console"
    #: Most recent messages, newest last. Tests read this; nothing else should.
    outbox: List[SentEmail] = []

    async def send(self, to: str, subject: str, html: str, text: str) -> None:
        ConsoleMailer.outbox.append(SentEmail(to=to, subject=subject, html=html, text=text))
        # Body deliberately omitted: it contains the verification code.
        logger.info("email queued to %s: %s", _redact(to), subject)

    @classmethod
    def clear(cls) -> None:
        cls.outbox.clear()


class ResendMailer:
    """Production provider. Sends real email through Resend."""

    name = "resend"

    def __init__(self, api_key: str, sender: str):
        self._api_key = api_key
        self._sender = sender

    async def send(self, to: str, subject: str, html: str, text: str) -> None:
        payload = {"from": self._sender, "to": [to], "subject": subject,
                   "html": html, "text": text}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    RESEND_API, json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
        except httpx.HTTPError as exc:
            raise EmailError(f"Could not reach the email provider: {exc}") from exc
        if response.status_code >= 400:
            # Never log the payload — it carries the code.
            logger.warning("resend rejected a message to %s (%s)",
                           _redact(to), response.status_code)
            raise EmailError("The email provider refused this message.")
        logger.info("email sent to %s: %s", _redact(to), subject)


def get_mailer() -> Mailer:
    provider = (settings.EMAIL_PROVIDER or "console").lower()
    if provider == "resend":
        if not settings.EMAIL_API_KEY:
            # Failing loudly beats silently dropping verification emails.
            raise EmailError("EMAIL_PROVIDER=resend requires EMAIL_API_KEY.")
        return ResendMailer(settings.EMAIL_API_KEY, settings.EMAIL_FROM)
    return ConsoleMailer()
