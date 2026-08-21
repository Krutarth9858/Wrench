from fastapi import HTTPException, status
from app.db.repositories.user import UserRepository
from app.db.repositories.token import TokenRepository
from app.schemas.user import UserCreate, UserLogin
from app.models.user import User, UserRole
from app.models.token import RefreshToken
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.config import settings
import datetime
import hashlib
import uuid

class AuthService:
    def __init__(self, user_repo: UserRepository, token_repo: TokenRepository):
        self.user_repo = user_repo
        self.token_repo = token_repo

    async def register(self, user_in: UserCreate) -> User:
        if await self.user_repo.get_by_email(user_in.email):
            raise HTTPException(status_code=400, detail="Email already registered")
        if await self.user_repo.get_by_phone_number(user_in.phone_number):
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        user = User(
            email=user_in.email,
            phone_number=user_in.phone_number,
            hashed_password=get_password_hash(user_in.password),
            role=UserRole(user_in.role),
        )
        return await self.user_repo.create(user)

    async def authenticate(self, user_in: UserLogin) -> User:
        user = await self.user_repo.get_by_email(user_in.email)
        if not user or not verify_password(user_in.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Inactive user")
        return user

    def _hash_token(self, token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    async def create_tokens(self, user: User) -> tuple[str, str]:
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        
        # Save hashed refresh token to DB
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        db_token = RefreshToken(
            user_id=user.id,
            hashed_token=self._hash_token(refresh_token),
            expires_at=expires_at
        )
        await self.token_repo.create(db_token)
        
        return access_token, refresh_token

    async def refresh_tokens(self, refresh_token: str) -> tuple[str, str]:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Invalid token type")
            user_id = payload.get("sub")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")

        hashed = self._hash_token(refresh_token)
        db_token = await self.token_repo.get_by_hashed_token(hashed)
        
        if not db_token or db_token.is_revoked or db_token.expires_at < datetime.datetime.now(datetime.timezone.utc):
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        # Revoke old token
        await self.token_repo.revoke_token(hashed)

        return await self.create_tokens(user)

    async def logout(self, refresh_token: str) -> None:
        hashed = self._hash_token(refresh_token)
        await self.token_repo.revoke_token(hashed)
