"""A production deploy must not start on development configuration.

`EMAIL_PROVIDER=console` is the dangerous one: the app boots, accepts
registrations, and silently discards every verification email.
"""

import pytest

from app.core.config import settings
from app.core.preflight import assert_production_ready, production_problems


@pytest.fixture
def production(monkeypatch):
    """A configuration that is production-ready in every respect."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "set")
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "razorpay")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "set")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "set")
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "set")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "set")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://app.example.com/auth/google/callback")
    monkeypatch.setattr(settings, "BACKEND_CORS_ORIGINS", "https://app.example.com")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+asyncpg://u:p@db.example.com/wrench")


def test_a_ready_configuration_starts(production):
    assert production_problems() == []
    assert_production_ready()  # does not raise


def test_development_configuration_is_never_blocked(monkeypatch):
    """The default environment must boot on a laptop no matter what."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "console")
    assert_production_ready()  # does not raise


def test_console_email_is_refused_in_production(production, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "console")
    with pytest.raises(RuntimeError, match="EMAIL_PROVIDER"):
        assert_production_ready()


def test_a_configured_provider_still_needs_its_key(production, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "")
    assert any("EMAIL_API_KEY" in p for p in production_problems())


def test_stub_payments_are_refused_in_production(production, monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "stub")
    assert any("PAYMENT_PROVIDER" in p for p in production_problems())


def test_razorpay_without_a_webhook_secret_is_refused(production, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    assert any("RAZORPAY_WEBHOOK_SECRET" in p for p in production_problems())


@pytest.mark.parametrize("attr,value,expected", [
    ("GOOGLE_REDIRECT_URI", "http://localhost:5174/auth/google/callback", "GOOGLE_REDIRECT_URI"),
    ("BACKEND_CORS_ORIGINS", "http://localhost:5174", "BACKEND_CORS_ORIGINS"),
    ("DATABASE_URL", "postgresql+asyncpg://postgres@localhost:5432/wrench", "DATABASE_URL"),
])
def test_development_hosts_are_refused(production, monkeypatch, attr, value, expected):
    monkeypatch.setattr(settings, attr, value)
    assert any(expected in p for p in production_problems())


def test_every_problem_is_reported_at_once(production, monkeypatch):
    """A deploy should not be a guessing game of one error at a time."""
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "console")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+asyncpg://postgres@localhost/x")
    monkeypatch.setattr(settings, "BACKEND_CORS_ORIGINS", "http://localhost:5174")
    assert len(production_problems()) >= 3


def test_no_secret_value_is_ever_printed(production, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "")
    report = " ".join(production_problems())
    # Names only — never the value of anything that is set.
    assert "set" not in report.split()
