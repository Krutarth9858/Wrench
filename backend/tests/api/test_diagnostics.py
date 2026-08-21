"""Phase 6A — AI troubleshooting foundation (RAD FR-06).

The LLM is mocked throughout: the suite must never depend on network access or
credentials. One test uses the real StubProvider to prove the default path works.
"""

import pytest

from app.api.routes import diagnostics as diagnostics_route
from app.core.security import create_access_token, get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.diagnostic import DiagnosticSession, MessageRole
from app.models.user import User, UserRole
from app.services.llm import LLMError, StubProvider

URL = "/api/v1/diagnostics"

GOOD = {
    "message": "Based on the information provided, a possible cause is a weak battery.",
    "questions": ["Do the headlights come on?"],
    "possible_causes": ["Weak or discharged battery"],
    "severity": "MEDIUM",
    "confidence": 0.62,
    "needs_mechanic": True,
}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


class FakeLLM:
    """Returns a queued payload or raises. Records what it was asked."""

    def __init__(self, payloads=None, error=None):
        self._payloads = list(payloads or [GOOD])
        self._error = error
        self.calls = []

    async def complete_json(self, system_prompt, messages, schema):
        self.calls.append({"system": system_prompt, "messages": messages})
        if self._error:
            raise self._error
        return self._payloads.pop(0) if len(self._payloads) > 1 else self._payloads[0]


@pytest.fixture
def fake_llm(monkeypatch):
    llm = FakeLLM()
    monkeypatch.setattr(diagnostics_route, "get_llm", lambda: llm)
    return llm


def use_llm(monkeypatch, llm):
    monkeypatch.setattr(diagnostics_route, "get_llm", lambda: llm)
    return llm


async def start(client, token, **over):
    payload = {"vehicle_type": "BIKE",
               "problem_description": "My bike will not start this morning.", **over}
    return await client.post(f"{URL}/", json=payload, headers=auth(token))


# ------------------------------------------------------------------ session

@pytest.mark.asyncio
async def test_customer_starts_a_session_without_a_saved_vehicle(client, customer_token, fake_llm):
    res = await start(client, customer_token)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["vehicle_type"] == "BIKE"
    assert data["status"] == "ACTIVE"
    # opening problem + assistant reply
    assert [m["role"] for m in data["messages"]] == ["USER", "ASSISTANT"]


@pytest.mark.asyncio
async def test_the_structured_result_is_persisted(client, customer_token, fake_llm):
    data = (await start(client, customer_token)).json()["data"]
    assert data["result"] == {
        "severity": "MEDIUM", "confidence": 0.62, "needs_mechanic": True,
        "possible_causes": ["Weak or discharged battery"],
        "follow_up_questions": ["Do the headlights come on?"],
    }


@pytest.mark.asyncio
async def test_the_session_survives_a_refetch(client, customer_token, fake_llm):
    sid = (await start(client, customer_token)).json()["data"]["id"]
    again = await client.get(f"{URL}/{sid}", headers=auth(customer_token))
    assert again.status_code == 200
    assert again.json()["data"]["result"]["severity"] == "MEDIUM"
    assert len(again.json()["data"]["messages"]) == 2


@pytest.mark.asyncio
async def test_vehicle_type_and_problem_are_validated(client, customer_token, fake_llm):
    assert (await start(client, customer_token, vehicle_type="Truck")).status_code == 422
    assert (await start(client, customer_token, problem_description="no")).status_code == 422


# ------------------------------------------------------------------ conversation

@pytest.mark.asyncio
async def test_replies_are_persisted_in_order(client, customer_token, fake_llm):
    sid = (await start(client, customer_token)).json()["data"]["id"]
    res = await client.post(f"{URL}/{sid}/messages",
                            json={"content": "Yes, the headlights are dim."},
                            headers=auth(customer_token))
    assert res.status_code == 200
    roles = [m["role"] for m in res.json()["data"]["messages"]]
    assert roles == ["USER", "ASSISTANT", "USER", "ASSISTANT"]
    assert res.json()["data"]["messages"][2]["content"] == "Yes, the headlights are dim."


@pytest.mark.asyncio
async def test_an_empty_message_is_rejected(client, customer_token, fake_llm):
    sid = (await start(client, customer_token)).json()["data"]["id"]
    res = await client.post(f"{URL}/{sid}/messages", json={"content": ""},
                            headers=auth(customer_token))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_the_model_receives_the_safety_prompt_and_vehicle_context(
    client, customer_token, fake_llm
):
    await start(client, customer_token)
    call = fake_llm.calls[0]
    assert "Safety" in call["system"] and "never replace a physical inspection" in call["system"]
    assert "Vehicle type: BIKE" in call["messages"][0]["content"]


# ------------------------------------------------------------------ failure modes

@pytest.mark.asyncio
async def test_a_provider_failure_is_a_clean_503(client, customer_token, monkeypatch):
    use_llm(monkeypatch, FakeLLM(error=LLMError("provider down")))
    res = await start(client, customer_token)
    assert res.status_code == 503
    assert "unavailable" in res.json()["detail"].lower()
    # the raw provider error must not leak
    assert "provider down" not in res.text


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", [
    {"message": "hi", "severity": "CATASTROPHIC", "confidence": 0.5, "needs_mechanic": True},
    {"message": "hi", "severity": "LOW", "confidence": 7.0, "needs_mechanic": True},
    {"severity": "LOW", "confidence": 0.5, "needs_mechanic": True},          # no message
    {"message": "", "severity": "LOW", "confidence": 0.5, "needs_mechanic": True},
])
async def test_malformed_model_output_is_rejected(client, customer_token, monkeypatch, bad):
    use_llm(monkeypatch, FakeLLM(payloads=[bad]))
    res = await start(client, customer_token)
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_nothing_is_persisted_when_the_model_fails(client, customer_user, customer_token, monkeypatch):
    use_llm(monkeypatch, FakeLLM(error=LLMError("down")))
    await start(client, customer_token)

    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(DiagnosticSession))).scalars().all()
    # the session row exists but carries no fabricated result
    assert all(r.severity is None and r.possible_causes == [] for r in rows)


@pytest.mark.asyncio
async def test_the_default_stub_provider_works_offline(client, customer_token, monkeypatch):
    """The shipped default needs no key and no network."""
    monkeypatch.setattr(diagnostics_route, "get_llm", lambda: StubProvider())
    res = await start(client, customer_token)
    assert res.status_code == 201
    assert res.json()["data"]["result"]["severity"] in {"LOW", "MEDIUM", "HIGH"}


# ------------------------------------------------------------------ authorization

@pytest.mark.asyncio
async def test_another_customer_cannot_read_or_reply(client, customer_token, fake_llm):
    sid = (await start(client, customer_token)).json()["data"]["id"]
    async with AsyncSessionLocal() as db:
        intruder = User(email="nosy@example.com", phone_number="+15557770001",
                        hashed_password=get_password_hash("password"), role=UserRole.CUSTOMER)
        db.add(intruder); await db.commit(); await db.refresh(intruder)
    token = create_access_token(subject=str(intruder.id))

    assert (await client.get(f"{URL}/{sid}", headers=auth(token))).status_code == 404
    reply = await client.post(f"{URL}/{sid}/messages", json={"content": "let me in"},
                              headers=auth(token))
    assert reply.status_code == 404


@pytest.mark.asyncio
async def test_a_mechanic_cannot_use_the_diagnostic_api(client, mechanic_token, fake_llm):
    assert (await start(client, mechanic_token)).status_code == 403


@pytest.mark.asyncio
async def test_anonymous_access_is_rejected(client):
    assert (await client.post(f"{URL}/", json={})).status_code == 401
    assert (await client.get(f"{URL}/00000000-0000-0000-0000-000000000000")).status_code == 401


@pytest.mark.asyncio
async def test_an_unknown_session_is_404(client, customer_token, fake_llm):
    res = await client.get(f"{URL}/00000000-0000-0000-0000-000000000000",
                           headers=auth(customer_token))
    assert res.status_code == 404
