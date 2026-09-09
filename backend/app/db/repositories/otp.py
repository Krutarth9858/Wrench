from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.otp import EmailOTP, OTPPurpose


class OTPRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def latest_live(self, user_id: UUID, purpose: OTPPurpose) -> Optional[EmailOTP]:
        """The one code that could still be redeemed: not used, not superseded."""
        result = await self.session.execute(
            select(EmailOTP)
            .where(EmailOTP.user_id == user_id,
                   EmailOTP.purpose == purpose,
                   EmailOTP.used_at.is_(None),
                   EmailOTP.superseded_at.is_(None))
            .order_by(EmailOTP.created_at.desc())
        )
        return result.scalars().first()

    async def supersede_live(self, user_id: UUID, purpose: OTPPurpose,
                             at: datetime) -> None:
        """Retire every live code so only the newest one can ever verify."""
        await self.session.execute(
            update(EmailOTP)
            .where(EmailOTP.user_id == user_id,
                   EmailOTP.purpose == purpose,
                   EmailOTP.used_at.is_(None),
                   EmailOTP.superseded_at.is_(None))
            .values(superseded_at=at)
        )
        await self.session.commit()

    async def create(self, otp: EmailOTP) -> EmailOTP:
        self.session.add(otp)
        await self.session.commit()
        await self.session.refresh(otp)
        return otp

    async def save(self, otp: EmailOTP) -> EmailOTP:
        await self.session.commit()
        await self.session.refresh(otp)
        return otp

    async def delete_expired(self, before: datetime) -> int:
        """Housekeeping for spent codes. Not wired to a scheduler — Wrench has
        no job runner — but available to one."""
        from sqlalchemy import delete
        result = await self.session.execute(
            delete(EmailOTP).where(EmailOTP.expires_at < before)
        )
        await self.session.commit()
        return result.rowcount or 0
