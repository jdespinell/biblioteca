from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import CurrentUser, DBSession
from app.core.security import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    hash_password,
    set_auth_cookies,
    verify_password,
    REFRESH_TOKEN_COOKIE,
    decode_token,
)
from app.models.user import User
from app.schemas.auth import UserLogin, UserRegister, UserResponse, UserUpdate
from fastapi import Cookie
from jose import JWTError
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: UserRegister,
    response: Response,
    db: DBSession,
) -> UserResponse:
    """Register a new user account. Sets HttpOnly JWT cookies on success."""
    clean_email = body.email.strip().lower()
    existing = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con este correo electrónico",
        )

    user = User(
        email=clean_email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        preferred_language=body.preferred_language,
    )
    db.add(user)
    await db.flush()  # Get user.id without committing

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    set_auth_cookies(response, access_token, refresh_token)

    return UserResponse.model_validate(user)


@router.post("/login", response_model=UserResponse)
async def login(
    body: UserLogin,
    response: Response,
    db: DBSession,
) -> UserResponse:
    """Authenticate with email/password. Sets HttpOnly JWT cookies on success."""
    clean_email = body.email.strip().lower()
    result = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    user: User | None = result.scalar_one_or_none()

    # Constant-time check to prevent timing attacks
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    set_auth_cookies(response, access_token, refresh_token)

    return UserResponse.model_validate(user)


@router.post("/refresh", response_model=UserResponse)
async def refresh_token(
    response: Response,
    db: DBSession,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
) -> UserResponse:
    """Issue a new access token using the refresh token cookie."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )

    if not refresh_token:
        raise credentials_exception

    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    new_access = create_access_token(subject=str(user.id))
    new_refresh = create_refresh_token(subject=str(user.id))
    set_auth_cookies(response, new_access, new_refresh)

    return UserResponse.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    """Clear auth cookies (logout)."""
    clear_auth_cookies(response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser) -> UserResponse:
    """Return the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    current_user: CurrentUser,
    db: DBSession,
) -> UserResponse:
    """Update the current user's profile (name, language)."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.preferred_language is not None:
        current_user.preferred_language = body.preferred_language
    db.add(current_user)
    return UserResponse.model_validate(current_user)
