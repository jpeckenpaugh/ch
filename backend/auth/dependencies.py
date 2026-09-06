"""Auth gate dependency backed by the fastapi-users components.

Every protected ``/api/`` route resolves the ``session`` cookie through the
``DatabaseStrategy`` (``access_tokens`` → ``users``); a missing/invalid/expired
session — or a deactivated account — yields the contracted ``401 {"detail":
"Not authenticated"}``. Level-based authorization (``403``) lives in
``backend/auth/roles.py`` (``require_access`` / ``get_current_admin``).
"""

from fastapi import Depends, HTTPException, status
from fastapi_users.authentication.strategy.db import DatabaseStrategy
from fastapi_users.manager import BaseUserManager

from backend.auth.db import get_user_manager
from backend.auth.strategies import cookie_scheme, get_database_strategy
from backend.models.user import User


async def get_current_user(
    token: str | None = Depends(cookie_scheme),
    user_manager: BaseUserManager = Depends(get_user_manager),
    strategy: DatabaseStrategy = Depends(get_database_strategy),
) -> User:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = await strategy.read_token(token, user_manager)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user