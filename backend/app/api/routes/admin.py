"""Back-office endpoints.

RAD section 3 scopes administrative functions (mechanic verification, platform
analytics) to a supporting back-office module. This router exists so ADMIN
authorization is exercised by a real route; it reuses the single RBAC authority
in app/api/deps.py rather than checking roles inline.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.repositories.user import UserRepository
from app.db.session import get_db
from app.models.user import User
from app.schemas.response import ResponseModel
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/users", response_model=ResponseModel[List[UserResponse]])
async def list_users(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    users = await repo.list_all()
    return ResponseModel(data=[UserResponse.model_validate(u) for u in users])
