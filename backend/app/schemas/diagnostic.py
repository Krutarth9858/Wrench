from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.diagnostic import DiagnosticStatus, MessageRole, Severity
from app.models.vehicle import VehicleType


class DiagnosticCreate(BaseModel):
    """No saved Vehicle required — the customer picks a type, as in booking."""

    vehicle_type: VehicleType
    problem_description: str = Field(..., min_length=5, max_length=2000)


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class DiagnosticMessageResponse(BaseModel):
    id: UUID
    role: MessageRole
    content: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DiagnosticResult(BaseModel):
    """Advisory only. Nothing in booking, matching or authorization reads this."""

    severity: Optional[Severity] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    needs_mechanic: Optional[bool] = None
    possible_causes: List[str] = []
    follow_up_questions: List[str] = []


class DiagnosticResponse(BaseModel):
    id: UUID
    vehicle_type: VehicleType
    problem_description: str
    status: DiagnosticStatus
    created_at: Optional[datetime] = None
    result: DiagnosticResult
    messages: List[DiagnosticMessageResponse]

    model_config = ConfigDict(from_attributes=True)


class ModelOutput(BaseModel):
    """Validation boundary for whatever the model returns.

    The model is untrusted input: anything outside this shape is rejected and the
    turn fails cleanly rather than reaching the database or the UI.
    """

    message: str = Field(..., min_length=1, max_length=4000)
    questions: List[str] = Field(default_factory=list, max_length=5)
    possible_causes: List[str] = Field(default_factory=list, max_length=6)
    severity: Severity = Severity.LOW
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    needs_mechanic: bool = False


# Schema handed to providers that support native structured output.
MODEL_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "message": {"type": "string"},
        "questions": {"type": "array", "items": {"type": "string"}},
        "possible_causes": {"type": "array", "items": {"type": "string"}},
        "severity": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]},
        "confidence": {"type": "number"},
        "needs_mechanic": {"type": "boolean"},
    },
    "required": ["message", "severity", "confidence", "needs_mechanic"],
}
