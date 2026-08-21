"""AI troubleshooting (RAD FR-06).

The model is advisory. It produces text and a structured opinion; it never calls
a backend action. Booking, mechanic matching, availability and authorization are
untouched by anything here.
"""

import logging
from typing import List
from uuid import UUID

from fastapi import HTTPException, status as http_status
from pydantic import ValidationError

from app.db.repositories.diagnostic import DiagnosticRepository
from app.models.diagnostic import (
    DiagnosticMessage, DiagnosticSession, MessageRole,
)
from app.models.user import User
from app.schemas.diagnostic import (
    MODEL_OUTPUT_SCHEMA, DiagnosticCreate, ModelOutput,
)
from app.services.diagnostic_prompt import SYSTEM_PROMPT
from app.services.llm import LLMError, LLMProvider

logger = logging.getLogger(__name__)

UNAVAILABLE = (
    "The diagnostic assistant is unavailable right now. You can still find a mechanic."
)


class DiagnosticService:
    def __init__(self, repo: DiagnosticRepository, llm: LLMProvider):
        self.repo = repo
        self.llm = llm

    async def _owned(self, session_id: UUID, customer: User) -> DiagnosticSession:
        session = await self.repo.get_by_id(session_id)
        # 404 rather than 403: another customer's session id is not confirmed.
        if not session or session.customer_id != customer.id:
            raise HTTPException(status_code=404, detail="Diagnostic session not found")
        return session

    async def _turn(self, session: DiagnosticSession) -> DiagnosticSession:
        """Run one model turn and persist the result."""
        history = await self.repo.list_messages(session.id)
        transcript: List[dict] = [
            {"role": "user" if m.role is MessageRole.USER else "assistant",
             "content": m.content}
            for m in history
        ]
        context = (
            f"Vehicle type: {session.vehicle_type.value}. "
            f"Reported problem: {session.problem_description}"
        )
        transcript.insert(0, {"role": "user", "content": context})

        try:
            raw = await self.llm.complete_json(SYSTEM_PROMPT, transcript, MODEL_OUTPUT_SCHEMA)
            output = ModelOutput.model_validate(raw)
        except LLMError as exc:
            logger.warning("diagnostic turn failed: %s", exc)
            raise HTTPException(
                status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE
            ) from exc
        except ValidationError as exc:
            # The model returned something outside the agreed shape. Fail cleanly
            # rather than letting malformed data reach the database or the UI.
            logger.warning("diagnostic model returned malformed output")
            raise HTTPException(
                status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE
            ) from exc

        await self.repo.add_message(DiagnosticMessage(
            session_id=session.id, role=MessageRole.ASSISTANT, content=output.message,
        ))
        return await self.repo.save_result(
            session,
            severity=output.severity,
            confidence=output.confidence,
            needs_mechanic=output.needs_mechanic,
            possible_causes=output.possible_causes,
            follow_up_questions=output.questions,
        )

    async def start(self, customer: User, payload: DiagnosticCreate) -> DiagnosticSession:
        session = await self.repo.create_session(DiagnosticSession(
            customer_id=customer.id,
            vehicle_type=payload.vehicle_type,
            problem_description=payload.problem_description,
        ))
        await self.repo.add_message(DiagnosticMessage(
            session_id=session.id, role=MessageRole.USER,
            content=payload.problem_description,
        ))
        return await self._turn(session)

    async def reply(self, session_id: UUID, customer: User, content: str) -> DiagnosticSession:
        session = await self._owned(session_id, customer)
        await self.repo.add_message(DiagnosticMessage(
            session_id=session.id, role=MessageRole.USER, content=content,
        ))
        return await self._turn(session)

    async def get(self, session_id: UUID, customer: User) -> DiagnosticSession:
        return await self._owned(session_id, customer)

    async def messages(self, session_id: UUID) -> List[DiagnosticMessage]:
        return await self.repo.list_messages(session_id)
