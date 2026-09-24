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
        logger.info("email queued to %s: %s", _redact(to), subject)
        if (settings.ENVIRONMENT or "development").lower() != "production":
            # In local dev, print the email text so developers can immediately see the OTP
            print(f"\n{'='*55}\n[LOCAL DEV EMAIL] To: {to}\nSubject: {subject}\n\n{text}\n{'='*55}\n", flush=True)

    @classmethod
    def clear(cls) -> None:
        cls.outbox.clear()


class SmtpMailer:
    """Delivers real transactional email via SMTP (e.g., Gmail with an App Password)."""

    name = "smtp"

    def __init__(self, host: str, port: int, user: str, password: str, sender: str, tls: bool = True):
        self._host = (host or "smtp.gmail.com").strip()
        self._port = int(port) if port else 587
        self._user = (user or "").strip()
        # Clean password: strip whitespace. If it's a 16-character Google App Password with spaces ("xxxx xxxx xxxx xxxx"),
        # strip spaces so Gmail authentication succeeds cleanly.
        clean_pwd = (password or "").strip()
        if "@gmail.com" in self._user.lower() or len(clean_pwd.replace(" ", "")) == 16:
            clean_pwd = clean_pwd.replace(" ", "")
        self._password = clean_pwd
        self._sender = (sender or "").strip() or self._user
        self._tls = tls

    async def send(self, to: str, subject: str, html: str, text: str) -> None:
        import asyncio
        from email.message import EmailMessage
        import smtplib
        import ssl

        def _send() -> None:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = self._sender
            msg["To"] = to
            msg.set_content(text)
            msg.add_alternative(html, subtype="html")

            context = ssl.create_default_context()
            if self._port == 465:
                with smtplib.SMTP_SSL(self._host, self._port, timeout=15, context=context) as server:
                    if self._user and self._password:
                        server.login(self._user, self._password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self._host, self._port, timeout=15) as server:
                    server.ehlo()
                    if self._tls:
                        server.starttls(context=context)
                        server.ehlo()
                    if self._user and self._password:
                        server.login(self._user, self._password)
                    server.send_message(msg)

        try:
            await asyncio.to_thread(_send)
        except smtplib.SMTPAuthenticationError as exc:
            logger.error("SMTP authentication failed for user %s: %s", _redact(self._user), exc)
            raise EmailError(
                f"SMTP authentication failed: Invalid username or App Password for {self._user}. "
                "Ensure 2-Step Verification is enabled and generate a fresh App Password at https://myaccount.google.com/apppasswords."
            ) from exc
        except Exception as exc:
            logger.warning("SMTP failed to deliver message to %s: %s", _redact(to), exc)
            raise EmailError(f"Could not deliver email via SMTP: {exc}") from exc
        logger.info("email sent via SMTP to %s: %s", _redact(to), subject)


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
            # Never log the payload — it carries the code. Resend error response is safe to log.
            logger.warning("resend rejected a message to %s (%s): %s",
                           _redact(to), response.status_code, response.text)
            raise EmailError(f"The email provider refused this message: {response.text}")
        logger.info("email sent to %s: %s", _redact(to), subject)


def get_mailer() -> Mailer:
    provider = (settings.EMAIL_PROVIDER or "console").lower()
    if provider == "resend":
        if not settings.EMAIL_API_KEY:
            # Failing loudly beats silently dropping verification emails.
            raise EmailError("EMAIL_PROVIDER=resend requires EMAIL_API_KEY.")
        return ResendMailer(settings.EMAIL_API_KEY, settings.EMAIL_FROM)
    if provider == "smtp":
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            raise EmailError("EMAIL_PROVIDER=smtp requires SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.")
        return SmtpMailer(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            user=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            sender=settings.EMAIL_FROM or settings.SMTP_USER,
            tls=settings.SMTP_TLS,
        )
    return ConsoleMailer()
