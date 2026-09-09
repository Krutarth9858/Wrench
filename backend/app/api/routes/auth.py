import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.repositories.user import UserRepository
from app.db.repositories.token import TokenRepository
from app.services.auth import AuthService
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.token import TokenResponse, TokenRefreshRequest
from app.schemas.response import ResponseModel
from app.api.deps import get_current_user
from app.models.user import User
from app.models.otp import OTPPurpose
from app.db.repositories.otp import OTPRepository
from app.schemas.auth_extra import (
    GoogleAuthUrlResponse, GoogleCallbackRequest, OTPRequest, OTPRequestResponse,
    OTPVerifyRequest,
)
from app.services import google_oauth, rate_limit
from app.services.otp import OTPService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


def get_otp_service(db: AsyncSession = Depends(get_db)) -> OTPService:
    return OTPService(OTPRepository(db))


def _caller(request: Request) -> str:
    """A coarse client key for rate limiting. Not an identity."""
    return request.client.host if request.client else "unknown"

def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    user_repo = UserRepository(db)
    token_repo = TokenRepository(db)
    return AuthService(user_repo, token_repo)

@router.post("/register", response_model=ResponseModel[UserResponse], status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)
):
    user = await auth_service.register(user_in)
    return ResponseModel(
        message="User registered successfully",
        data=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=ResponseModel[TokenResponse])
async def login(
    user_in: UserLogin,
    auth_service: AuthService = Depends(get_auth_service)
):
    user = await auth_service.authenticate(user_in)
    access_token, refresh_token = await auth_service.create_tokens(user)
    return ResponseModel(
        message="Login successful",
        data=TokenResponse(access_token=access_token, refresh_token=refresh_token)
    )

@router.post("/refresh", response_model=ResponseModel[TokenResponse])
async def refresh_token(
    request: TokenRefreshRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    access_token, refresh_token = await auth_service.refresh_tokens(request.refresh_token)
    return ResponseModel(
        message="Token refreshed successfully",
        data=TokenResponse(access_token=access_token, refresh_token=refresh_token)
    )

@router.post("/logout", response_model=ResponseModel)
async def logout(
    request: TokenRefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(get_current_user)
):
    await auth_service.logout(request.refresh_token)
    return ResponseModel(message="Logged out successfully")

@router.get("/me", response_model=ResponseModel[UserResponse])
async def read_users_me(
    current_user: User = Depends(get_current_user)
):
    return ResponseModel(
        data=UserResponse.model_validate(current_user)
    )

@router.post("/swagger-login", response_model=TokenResponse, include_in_schema=False)
async def swagger_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service)
):
    user_in = UserLogin(email=form_data.username, password=form_data.password)
    user = await auth_service.authenticate(user_in)
    access_token, refresh_token = await auth_service.create_tokens(user)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# ------------------------------------------------------------- Google Sign-In

@router.get("/google/url", response_model=ResponseModel[GoogleAuthUrlResponse])
async def google_authorization_url(
    role: str = Query("CUSTOMER", pattern="^(CUSTOMER|MECHANIC)$"),
):
    """Start Google Sign-In.

    The `state` is signed by this server and carries the role chosen on the
    registration screen, so the callback can be trusted and the existing role
    model is preserved. The redirect URI comes from configuration, never from
    the request.
    """
    try:
        url = google_oauth.authorization_url(google_oauth.issue_state(role))
    except google_oauth.GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    return ResponseModel(data=GoogleAuthUrlResponse(authorization_url=url))


@router.post("/google/callback", response_model=ResponseModel[TokenResponse])
async def google_callback(
    body: GoogleCallbackRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Complete Google Sign-In and issue the ordinary Wrench session.

    The browser supplies only an opaque code; the identity is whatever Google
    returns to this server. No email, name or picture from the client is read.
    """
    rate_limit.enforce(f"google:{_caller(request)}", 20, 3600,
                       "Too many sign-in attempts. Please try again later.")
    try:
        role = google_oauth.verify_state(body.state)
        identity = await google_oauth.exchange_code(body.code)
    except google_oauth.GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    user = await auth_service.sign_in_with_google(identity, default_role=role)
    access_token, refresh_token = await auth_service.create_tokens(user)
    return ResponseModel(
        message="Signed in with Google",
        data=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


# ---------------------------------------------------------------- email OTP

@router.post("/otp/request", response_model=ResponseModel[OTPRequestResponse])
async def request_otp(
    body: OTPRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
    otp_service: OTPService = Depends(get_otp_service),
):
    """Send a verification code.

    The response is identical whether or not the address has an account, so this
    endpoint cannot be used to enumerate users. Rate limits still apply to the
    address either way.
    """
    caller = _caller(request)
    purpose = OTPPurpose(body.purpose)
    reply = ResponseModel(
        message="If that email has an account, a code is on its way.",
        data=OTPRequestResponse(
            email=body.email,
            expires_in_minutes=settings.OTP_EXPIRY_MINUTES,
            resend_after_seconds=settings.OTP_RESEND_COOLDOWN_SECONDS,
        ),
    )

    user = await auth_service.user_repo.get_by_email(body.email)
    if not user:
        # Spend the caller's allowance anyway, so timing and limits look the
        # same for an unknown address as for a real one.
        rate_limit.enforce(f"otp:request:ip:{caller}",
                           settings.OTP_MAX_REQUESTS_PER_HOUR * 3, 3600,
                           "Too many codes requested. Please try again later.")
        return reply

    await otp_service.issue(user, purpose, caller_key=caller)
    return reply


@router.post("/otp/verify", response_model=ResponseModel[TokenResponse])
async def verify_otp(
    body: OTPVerifyRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
    otp_service: OTPService = Depends(get_otp_service),
):
    """Redeem a code.

    On success for EMAIL_VERIFICATION the address is marked verified and the
    ordinary Wrench session is issued — the same tokens `/login` returns, not a
    second session mechanism.
    """
    user = await auth_service.user_repo.get_by_email(body.email)
    if not user:
        # Same shape as a wrong code, so a bad address is indistinguishable.
        raise HTTPException(status_code=400,
                            detail="That code is no longer valid. Request a new one.")

    await otp_service.verify(user, OTPPurpose(body.purpose), body.code,
                             caller_key=_caller(request))

    if OTPPurpose(body.purpose) == OTPPurpose.EMAIL_VERIFICATION:
        user.is_email_verified = True
        await auth_service.user_repo.save(user)

    access_token, refresh_token = await auth_service.create_tokens(user)
    return ResponseModel(
        message="Email verified",
        data=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )
