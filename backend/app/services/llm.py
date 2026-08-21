"""The single LLM boundary for Wrench.

Everything that talks to a model goes through `get_llm()`. Providers are adapters
behind one protocol so a second client never appears elsewhere in the codebase.

Configuration (app/core/config.py):
    LLM_PROVIDER  stub | gemini      (default: stub)
    LLM_API_KEY   provider key, required for any real provider
    LLM_MODEL     model id

The default is `stub`: deterministic, offline, no key. That keeps the app runnable
and the test suite independent of network access and credentials. RAD section 4
names Gemini/OpenAI; Gemini is implemented, and another provider is a new adapter
implementing `LLMProvider` plus one branch in `get_llm()` — nothing else changes.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Provider was unreachable, refused the request, or returned nothing usable."""


class LLMProvider(Protocol):
    async def complete_json(
        self, system_prompt: str, messages: List[Dict[str, str]], schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Return a JSON object conforming to `schema`. Raise LLMError otherwise."""


class StubProvider:
    """Offline provider used by default and in tests.

    Deterministic and intentionally cautious: it never claims a diagnosis, and
    always recommends a mechanic. It exists so the product runs without
    credentials, not to imitate a model.
    """

    async def complete_json(
        self, system_prompt: str, messages: List[Dict[str, str]], schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        turns = sum(1 for m in messages if m["role"] == "user")
        if turns <= 1:
            return {
                "message": (
                    "Thanks — based on the information provided I need a little more "
                    "detail before suggesting possible causes."
                ),
                "questions": [
                    "Does anything happen when you try to start the vehicle?",
                    "Are the lights or dashboard indicators working?",
                ],
                "possible_causes": [],
                "severity": "LOW",
                "confidence": 0.2,
                "needs_mechanic": False,
            }
        return {
            "message": (
                "Based on the information provided, here are some possible causes. "
                "This is advisory only — consider having a mechanic inspect the vehicle."
            ),
            "questions": [],
            "possible_causes": ["Weak or discharged battery", "Loose or corroded connection"],
            "severity": "MEDIUM",
            "confidence": 0.6,
            "needs_mechanic": True,
        }


class GeminiProvider:
    """Google Gemini via the REST API, using its native JSON response mode."""

    BASE = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str):
        self._api_key = api_key
        self._model = model

    async def complete_json(
        self, system_prompt: str, messages: List[Dict[str, str]], schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [
                {"role": "user" if m["role"] == "user" else "model",
                 "parts": [{"text": m["content"]}]}
                for m in messages
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
                "temperature": 0.2,
            },
        }
        url = f"{self.BASE}/{self._model}:generateContent"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    url, params={"key": self._api_key}, json=payload
                )
        except httpx.HTTPError as exc:  # network, DNS, timeout
            raise LLMError("The diagnostic service is unreachable.") from exc

        if response.status_code >= 400:
            # Never log or surface the key or the raw provider body.
            logger.warning("gemini returned %s", response.status_code)
            raise LLMError("The diagnostic service rejected the request.")

        try:
            text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
        except (KeyError, IndexError, ValueError, TypeError) as exc:
            raise LLMError("The diagnostic service returned an unreadable response.") from exc

        if not isinstance(parsed, dict):
            raise LLMError("The diagnostic service returned an unexpected response.")
        return parsed


def get_llm() -> LLMProvider:
    """Resolve the configured provider. The only place a provider is constructed."""
    provider = (settings.LLM_PROVIDER or "stub").lower()
    if provider == "stub":
        return StubProvider()
    if provider == "gemini":
        if not settings.LLM_API_KEY:
            raise LLMError("LLM_API_KEY is not configured.")
        return GeminiProvider(settings.LLM_API_KEY, settings.LLM_MODEL)
    raise LLMError(f"Unknown LLM_PROVIDER: {provider}")
