from fastapi import HTTPException, status
from app.db.repositories.user import UserRepository
from app.db.repositories.token import TokenRepository
from app.schemas.user import UserCreate, UserLogin
from app.models.user import User, UserRole
from app.models.token import RefreshToken
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.services.google_oauth import GoogleIdentity
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
        # A Google-only account has no password hash; `verify_password` must not
        # be handed None. The message stays identical either way so the response
        # never reveals which accounts exist or how they sign in.
        if not user or not user.hashed_password or not verify_password(
                user_in.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Inactive user")
        return user

    async def sign_in_with_google(self, identity: GoogleIdentity,
                                  default_role: str = "CUSTOMER") -> User:
        """Find or create the Wrench account for a verified Google identity.

        Linking rules, in order:

        1. Known `google_sub` -> that account. The subject is Google's stable
           identifier and is what we actually key on.
        2. Existing account with the same email -> link it, but only when Google
           says the address is verified. Linking on an unverified address would
           let anyone who can create a Google account with someone else's
           address take over that Wrench account.
        3. Otherwise -> create a new account in the requested signup role.

        Never creates a second account for an email that already has one.
        """
        existing = await self.user_repo.get_by_google_sub(identity.subject)
        if existing:
            if not existing.is_active:
                raise HTTPException(status_code=403, detail="Inactive user")
            return existing

        by_email = await self.user_repo.get_by_email(identity.email)
        if by_email:
            if not identity.email_verified:
                raise HTTPException(
                    status_code=409,
                    detail="An account already uses this email. Sign in with your "
                           "password instead.",
                )
            if not by_email.is_active:
                raise HTTPException(status_code=403, detail="Inactive user")
            # Adopt the Google identity onto the existing account. The role is
            # left exactly as it was — Google can never change it.
            by_email.google_sub = identity.subject
            by_email.is_email_verified = True
            return await self.user_repo.save(by_email)

        role = default_role if default_role in ("CUSTOMER", "MECHANIC") else "CUSTOMER"
        user = User(
            email=identity.email,
            # Google supplies neither. Both stay empty until the customer fills
            # them in; the columns are nullable for exactly this case.
            phone_number=None,
            hashed_password=None,
            google_sub=identity.subject,
            is_email_verified=identity.email_verified,
            role=UserRole(role),
        )
        return await self.user_repo.create(user)

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
