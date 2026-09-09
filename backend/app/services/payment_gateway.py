"""The single payment boundary for Wrench.

Everything that talks to a payment gateway goes through `get_gateway()`, the same
shape the LLM boundary uses (`app/services/llm.py`).

Configuration (app/core/config.py):
    PAYMENT_PROVIDER          stub | razorpay      (default: stub)
    RAZORPAY_KEY_ID           publishable key id, sent to the browser checkout
    RAZORPAY_KEY_SECRET       API secret; signs checkout results and authenticates
                              API calls. Never leaves the server.
    RAZORPAY_WEBHOOK_SECRET   a *different* secret, configured in the Razorpay
                              dashboard, that signs webhook deliveries. Razorpay
                              treats these as separate credentials and so do we.

The default is `stub`: deterministic, offline, no credentials, so the app runs
and the suite passes without an account. The stub is not a pretend "always
succeeds" — it implements the *same* HMAC-SHA256 signature scheme Razorpay uses,
so the verification path under test is the real one and swapping in live keys
changes configuration, not logic.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RAZORPAY_API = "https://api.razorpay.com/v1"


class PaymentError(RuntimeError):
    """The gateway was unreachable or refused to create an order."""


class PaymentGateway(Protocol):
    name: str
    #: Sent to the browser so checkout can be opened. Never the secret.
    public_key: str

    async def create_order(self, amount_minor: int, currency: str, receipt: str) -> str:
        """Create an order and return the provider's order id."""

    def verify_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """True when `signature` proves the gateway authorised this payment."""

    def verify_webhook(self, raw_body: bytes, signature: str) -> bool:
        """True when `signature` proves the gateway sent this exact body.

        Computed over the raw bytes as received. Re-serialising the parsed JSON
        would change whitespace and key order and never match.
        """

    async def refund(self, payment_id: str, amount_minor: int, idempotency_key: str) -> str:
        """Ask the gateway to refund `amount_minor`; return the refund id."""


def _expected_signature(secret: str, order_id: str, payment_id: str) -> str:
    """Razorpay's documented scheme: HMAC-SHA256 of "<order_id>|<payment_id>"."""
    return hmac.new(
        secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()


def _expected_webhook_signature(secret: str, raw_body: bytes) -> str:
    """Razorpay's webhook scheme: HMAC-SHA256 over the raw request body."""
    return hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()


class StubGateway:
    """Offline gateway used by default and in tests.

    Orders are local ids; signatures are real HMACs over a local secret, so an
    invalid signature is rejected here exactly as it would be in production.
    """

    name = "stub"
    public_key = "stub_key"
    #: Not credentials — they sign nothing that leaves this process.
    secret = "stub-gateway-secret"
    webhook_secret = "stub-webhook-secret"

    async def create_order(self, amount_minor: int, currency: str, receipt: str) -> str:
        return f"order_stub_{uuid.uuid4().hex[:16]}"

    def verify_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        return hmac.compare_digest(
            _expected_signature(self.secret, order_id, payment_id), signature or ""
        )

    def verify_webhook(self, raw_body: bytes, signature: str) -> bool:
        return hmac.compare_digest(
            _expected_webhook_signature(self.webhook_secret, raw_body), signature or ""
        )

    async def refund(self, payment_id: str, amount_minor: int, idempotency_key: str) -> str:
        return f"rfnd_stub_{idempotency_key[:16]}"

    def sign(self, order_id: str, payment_id: str) -> str:
        """Test/dev helper: produce the signature the gateway would return."""
        return _expected_signature(self.secret, order_id, payment_id)

    def sign_webhook(self, raw_body: bytes) -> str:
        """Test/dev helper: sign a webhook body as the gateway would."""
        return _expected_webhook_signature(self.webhook_secret, raw_body)


class RazorpayGateway:
    """Live Razorpay. Orders are created server-side; the amount never comes
    from the browser, and the signature is verified with the secret key."""

    name = "razorpay"

    def __init__(self, key_id: str, key_secret: str, webhook_secret: str = ""):
        self._key_id = key_id
        self._key_secret = key_secret
        # Distinct from the API secret. Razorpay signs webhooks with the secret
        # configured on the webhook itself, not with the API key.
        self._webhook_secret = webhook_secret

    @property
    def public_key(self) -> str:
        return self._key_id

    async def create_order(self, amount_minor: int, currency: str, receipt: str) -> str:
        payload = {"amount": amount_minor, "currency": currency, "receipt": receipt,
                   "payment_capture": 1}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    f"{RAZORPAY_API}/orders", json=payload,
                    auth=(self._key_id, self._key_secret),
                )
        except httpx.HTTPError as exc:
            raise PaymentError(f"Could not reach the payment gateway: {exc}") from exc
        if response.status_code >= 400:
            logger.warning("razorpay order rejected: %s", response.text[:300])
            raise PaymentError("The payment gateway refused this order.")
        order_id = response.json().get("id")
        if not order_id:
            raise PaymentError("The payment gateway returned no order id.")
        return order_id

    def verify_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        return hmac.compare_digest(
            _expected_signature(self._key_secret, order_id, payment_id), signature or ""
        )

    def verify_webhook(self, raw_body: bytes, signature: str) -> bool:
        if not self._webhook_secret:
            # Refusing beats accepting unauthenticated state changes.
            logger.error("RAZORPAY_WEBHOOK_SECRET is not configured; rejecting webhook")
            return False
        return hmac.compare_digest(
            _expected_webhook_signature(self._webhook_secret, raw_body), signature or ""
        )

    async def refund(self, payment_id: str, amount_minor: int, idempotency_key: str) -> str:
        """Refund through Razorpay.

        The amount comes from our own payment record, never from a request.
        `idempotency_key` is sent as Razorpay's documented idempotency header so
        a retried call returns the original refund instead of making a second.
        """
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    f"{RAZORPAY_API}/payments/{payment_id}/refund",
                    json={"amount": amount_minor, "speed": "normal"},
                    headers={"X-Razorpay-Idempotency-Key": idempotency_key},
                    auth=(self._key_id, self._key_secret),
                )
        except httpx.HTTPError as exc:
            raise PaymentError(f"Could not reach the payment gateway: {exc}") from exc
        if response.status_code >= 400:
            # Body may name the payment but never the credentials.
            logger.warning("razorpay refund rejected: %s", response.text[:300])
            raise PaymentError("The payment gateway refused this refund.")
        refund_id = response.json().get("id")
        if not refund_id:
            raise PaymentError("The payment gateway returned no refund id.")
        return refund_id


def get_gateway() -> PaymentGateway:
    provider = (settings.PAYMENT_PROVIDER or "stub").lower()
    if provider == "razorpay":
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            # Failing loudly beats silently taking payments through a stub.
            raise PaymentError(
                "PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
            )
        return RazorpayGateway(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET,
                               settings.RAZORPAY_WEBHOOK_SECRET)
    return StubGateway()
