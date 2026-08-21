from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.diagnostic import DiagnosticMessage, DiagnosticSession


class DiagnosticRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, session_id: UUID) -> Optional[DiagnosticSession]:
        result = await self.session.execute(
            select(DiagnosticSession).where(DiagnosticSession.id == session_id)
        )
        return result.scalars().first()

    async def list_messages(self, session_id: UUID) -> List[DiagnosticMessage]:
        result = await self.session.execute(
            select(DiagnosticMessage)
            .where(DiagnosticMessage.session_id == session_id)
            .order_by(DiagnosticMessage.created_at, DiagnosticMessage.id)
        )
        return list(result.scalars().all())

    async def create_session(self, session: DiagnosticSession) -> DiagnosticSession:
        self.session.add(session)
        await self.session.commit()
        await self.session.refresh(session)
        return session

    async def add_message(self, message: DiagnosticMessage) -> DiagnosticMessage:
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def save_result(self, session: DiagnosticSession, **fields) -> DiagnosticSession:
        for key, value in fields.items():
            setattr(session, key, value)
        await self.session.commit()
        await self.session.refresh(session)
        return session
