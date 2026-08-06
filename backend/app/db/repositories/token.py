from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import Optional
from app.models.token import RefreshToken
import datetime

class TokenRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, token: RefreshToken) -> RefreshToken:
        self.session.add(token)
        await self.session.commit()
        await self.session.refresh(token)
        return token

    async def get_by_hashed_token(self, hashed_token: str) -> Optional[RefreshToken]:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.hashed_token == hashed_token)
        )
        return result.scalars().first()

    async def revoke_token(self, hashed_token: str) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.hashed_token == hashed_token)
            .values(is_revoked=True)
        )
        await self.session.commit()

    async def delete_expired(self, current_time: datetime.datetime) -> None:
        await self.session.execute(
            delete(RefreshToken).where(RefreshToken.expires_at < current_time)
        )
        await self.session.commit()
