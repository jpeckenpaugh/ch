"""Custom assembly of the fastapi-users auth routes under ``/api/auth``.

The stock ``get_auth_router`` is not used directly because the contract deviates
from it (architecture §9.2.1, §10.2):

- **JSON login body** ``{email, password}`` (stock fastapi-users login is
  form-encoded via ``OAuth2PasswordRequestForm``);
- **idempotent logout** — ``204`` even with no session (the stock router
  returns ``401`` without a token);
- **``me`` payload** ``{id, email, access_level}`` (Sprint 03: ``is_superuser``
  replaced by the level);
- **user management** — admin-only ``GET``/``POST``/``PATCH``/``DELETE
  /users`` with the §10.2.4 guardrails (bootstrap-admin immutability,
  last-remaining-admin, no self role-change).

The routes below are assembled from the same fastapi-users components
(``UserManager.authenticate``, the ``DatabaseStrategy``, and the
``CookieTransport``), so the auth machinery is the maintained library's.

Routes: ``POST /login``, ``POST /logout``, ``GET /me``, ``PATCH /me``,
``POST /change-password`` (self-service), and the admin user-management routes
(``GET``/``POST``/``PATCH``/``DELETE`` under ``/users``). The register router is
not mounted (no self-service signup).
"""

from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi_users import exceptions
from fastapi_users.authentication.strategy.db import DatabaseStrategy
from fastapi_users.authentication.transport.bearer import BearerResponse
from fastapi_users.authentication.transport.cookie import CookieTransport
from fastapi_users.manager import BaseUserManager
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.db import get_user_manager
from backend.auth.dependencies import get_current_user
from backend.auth.roles import get_current_admin
from backend.auth.schemas import (
    ChangePasswordIn,
    LoginIn,
    UserCreate,
    UserManagementRead,
    UserManagementUpdate,
    UserRead,
    UserUpdate,
)
from backend.auth.strategies import get_cookie_transport, get_database_strategy
from backend.config import ADMIN_EMAIL
from backend.db.session import get_session
from backend.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

_BOOTSTRAP_IMMUTABLE = "The bootstrap admin cannot be modified"
_LAST_ADMIN = "Cannot demote or delete the last remaining admin"
_NO_SELF_ROLE_CHANGE = "Admins cannot change their own level"


@router.post("/login", response_model=BearerResponse)
async def login(
    payload: LoginIn,
    request: Request,
    user_manager: BaseUserManager = Depends(get_user_manager),
    strategy: DatabaseStrategy = Depends(get_database_strategy),
    transport: CookieTransport = Depends(get_cookie_transport),
):
    user = await user_manager.authenticate(
        SimpleNamespace(username=payload.email, password=payload.password)
    )
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_BAD_CREDENTIALS",
        )
    token = await strategy.write_token(user)
    response = JSONResponse(BearerResponse(access_token=token, token_type="bearer").model_dump())
    response.set_cookie(
        transport.cookie_name,
        token,
        max_age=transport.cookie_max_age,
        path=transport.cookie_path,
        domain=transport.cookie_domain,
        secure=transport.cookie_secure,
        httponly=transport.cookie_httponly,
        samesite=transport.cookie_samesite,
    )
    await user_manager.on_after_login(user, request, response)
    return response


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    user_manager: BaseUserManager = Depends(get_user_manager),
    strategy: DatabaseStrategy = Depends(get_database_strategy),
    transport: CookieTransport = Depends(get_cookie_transport),
):
    token = request.cookies.get(transport.cookie_name)
    if token:
        await strategy.destroy_token(token, None)
    response = Response(status_code=204)
    response.delete_cookie(transport.cookie_name, path=transport.cookie_path)
    return response


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: UserUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    user_manager: BaseUserManager = Depends(get_user_manager),
):
    try:
        updated = await user_manager.update(payload, user, safe=True, request=request)
    except exceptions.InvalidPasswordException:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid password")
    return updated


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordIn,
    request: Request,
    user: User = Depends(get_current_user),
    user_manager: BaseUserManager = Depends(get_user_manager),
):
    verified, _ = user_manager.password_helper.verify_and_update(
        payload.old_password, user.hashed_password
    )
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_PASSWORD"
        )
    try:
        await user_manager.update(
            UserUpdate(password=payload.new_password), user, safe=True, request=request
        )
    except exceptions.InvalidPasswordException:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid password")
    return {"status": "ok"}


async def _fetch_user(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _admin_count(session: AsyncSession) -> int:
    return await session.scalar(
        select(func.count()).select_from(User).where(User.access_level == "admin")
    )


@router.get("/users", response_model=list[UserManagementRead])
async def list_users(
    user: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    rows = (await session.scalars(select(User).order_by(User.id.asc()))).all()
    return rows


@router.post("/users", status_code=201, response_model=UserRead)
async def create_user(
    payload: UserCreate,
    request: Request,
    user: User = Depends(get_current_admin),
    user_manager: BaseUserManager = Depends(get_user_manager),
):
    try:
        created = await user_manager.create(payload, safe=False, request=request)
    except exceptions.UserAlreadyExists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="REGISTER_USER_ALREADY_EXISTS",
        )
    except exceptions.InvalidPasswordException:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid password")
    return created


@router.patch("/users/{user_id}", response_model=UserManagementRead)
async def update_user(
    user_id: int,
    payload: UserManagementUpdate,
    user: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    if payload.access_level is None and payload.is_active is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of access_level or is_active is required",
        )
    target = await _fetch_user(session, user_id)
    if target.email == ADMIN_EMAIL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_BOOTSTRAP_IMMUTABLE)

    if payload.access_level is not None:
        if user.id == target.id and payload.access_level != target.access_level:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_NO_SELF_ROLE_CHANGE)
        if target.access_level == "admin" and payload.access_level != "admin":
            if await _admin_count(session) - 1 <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_LAST_ADMIN)
        target.access_level = payload.access_level

    if payload.is_active is not None:
        target.is_active = payload.is_active

    await session.commit()
    await session.refresh(target)
    return target


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    user: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    target = await _fetch_user(session, user_id)
    if target.email == ADMIN_EMAIL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_BOOTSTRAP_IMMUTABLE)
    if target.access_level == "admin":
        if await _admin_count(session) - 1 <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_LAST_ADMIN)
    await session.delete(target)
    await session.commit()
    return None


from backend.auth.dependencies import get_current_user as get_current_user  # noqa: E402
