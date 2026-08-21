"""AI diagnostic endpoints (RAD FR-06). Customer-only.

Sessions are private to the customer who created them. Nothing here can create a
booking or change mechanic state — escalation is Phase 6B.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer
from app.db.repositories.diagnostic import DiagnosticRepository
from app.db.session import get_db
from app.models.diagnostic import DiagnosticSession
from app.models.user import User
from app.schemas.diagnostic import (
    DiagnosticCreate, DiagnosticMessageResponse, DiagnosticResponse, DiagnosticResult,
    MessageCreate,
)
from app.schemas.response import ResponseModel
from app.services.diagnostic import DiagnosticService
from app.services.llm import get_llm

router = APIRouter()


def get_diagnostic_service(db: AsyncSession = Depends(get_db)) -> DiagnosticService:
    return DiagnosticService(DiagnosticRepository(db), get_llm())


async def _present(session: DiagnosticSession, service: DiagnosticService) -> DiagnosticResponse:
    messages = await service.messages(session.id)
    return DiagnosticResponse(
        id=session.id,
        vehicle_type=session.vehicle_type,
        problem_description=session.problem_description,
        status=session.status,
        created_at=session.created_at,
        result=DiagnosticResult(
            severity=session.severity,
            confidence=session.confidence,
            needs_mechanic=session.needs_mechanic,
            possible_causes=list(session.possible_causes or []),
            follow_up_questions=list(session.follow_up_questions or []),
        ),
        messages=[DiagnosticMessageResponse.model_validate(m) for m in messages],
    )


@router.post("/", response_model=ResponseModel[DiagnosticResponse],
             status_code=status.HTTP_201_CREATED)
async def start_diagnostic(
    payload: DiagnosticCreate,
    current_user: User = Depends(get_current_customer),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    session = await service.start(current_user, payload)
    return ResponseModel(message="Diagnostic started", data=await _present(session, service))


@router.get("/{session_id}", response_model=ResponseModel[DiagnosticResponse])
async def get_diagnostic(
    session_id: UUID,
    current_user: User = Depends(get_current_customer),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    session = await service.get(session_id, current_user)
    return ResponseModel(data=await _present(session, service))


@router.post("/{session_id}/messages", response_model=ResponseModel[DiagnosticResponse])
async def send_message(
    session_id: UUID,
    payload: MessageCreate,
    current_user: User = Depends(get_current_customer),
    service: DiagnosticService = Depends(get_diagnostic_service),
):
    session = await service.reply(session_id, current_user, payload.content)
    return ResponseModel(data=await _present(session, service))
