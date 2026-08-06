from fastapi import APIRouter, Depends, status
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

router = APIRouter()

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
