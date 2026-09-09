"""Production configuration preflight.

Several settings have development-friendly defaults — `EMAIL_PROVIDER=console`
sends nothing, `LLM_PROVIDER=stub` answers offline, CORS points at localhost.
Those defaults are right for a laptop and silently wrong in production: the app
would boot happily and simply never deliver a verification email.

So when `ENVIRONMENT=production` this refuses to start and names every variable
that still needs attention, rather than failing later and quietly. It reports
all problems at once so a deploy is not a guessing game, and it never prints a
secret — only whether one is set.
"""

import logging
from typing import List

from app.core.config import settings

logger = logging.getLogger(__name__)

DEV_HOSTS = ("localhost", "127.0.0.1", "ngrok-free.app", "ngrok.io")


def _looks_local(value: str) -> bool:
    return any(host in (value or "") for host in DEV_HOSTS)


def production_problems() -> List[str]:
    """Everything that would be wrong about this configuration in production."""
    problems: List[str] = []

    if (settings.EMAIL_PROVIDER or "console").lower() == "console":
        problems.append(
            "EMAIL_PROVIDER is 'console': verification emails would be silently "
            "discarded. Set EMAIL_PROVIDER=resend with EMAIL_API_KEY and EMAIL_FROM."
        )
    elif not settings.EMAIL_API_KEY:
        problems.append("EMAIL_API_KEY is required for the configured EMAIL_PROVIDER.")

    if (settings.PAYMENT_PROVIDER or "stub").lower() == "stub":
        problems.append(
            "PAYMENT_PROVIDER is 'stub': no real payment would be taken. "
            "Set PAYMENT_PROVIDER=razorpay."
        )
    else:
        for name in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"):
            if not getattr(settings, name, ""):
                problems.append(f"{name} is required when PAYMENT_PROVIDER=razorpay.")

    if settings.GOOGLE_CLIENT_ID and _looks_local(settings.GOOGLE_REDIRECT_URI):
        problems.append(
            "GOOGLE_REDIRECT_URI still points at a development host. It must be the "
            "deployed HTTPS callback, registered in the Google Cloud Console."
        )

    if any(_looks_local(origin) for origin in settings.cors_origins):
        problems.append("BACKEND_CORS_ORIGINS still contains a development origin.")

    if _looks_local(settings.DATABASE_URL):
        problems.append("DATABASE_URL still points at a local database.")

    # An offline model is a degraded feature rather than a broken one, so this
    # is worth saying out loud but not worth refusing to boot over.
    if (settings.LLM_PROVIDER or "stub").lower() == "stub":
        logger.warning(
            "LLM_PROVIDER is 'stub': AI troubleshooting will return canned guidance."
        )

    return problems


def assert_production_ready() -> None:
    """Refuse to start a production deployment on development configuration."""
    if (settings.ENVIRONMENT or "development").lower() != "production":
        return
    problems = production_problems()
    if problems:
        raise RuntimeError(
            "Refusing to start: ENVIRONMENT=production but the configuration is "
            "not production-ready.\n  - " + "\n  - ".join(problems)
        )
