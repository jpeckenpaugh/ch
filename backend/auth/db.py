"""fastapi-users wiring: user/access-token DB adapters and the user manager.

The user database adapter maps the fastapi-users ``User`` model; the
access-token adapter maps the stateful ``AccessToken`` store behind the
``DatabaseStrategy``.
"""

from collections.abc import AsyncIterator

from fastapi import Depends
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from fastapi_users_db_sqlalchemy.access_token import SQLAlchemyAccessTokenDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.managers import UserManager
from backend.db.session import get_session
from backend.models.access_token import AccessToken
from backend.models.user import User


async def get_user_db(
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[SQLAlchemyUserDatabase]:
    yield SQLAlchemyUserDatabase(session, User)


async def get_access_token_db(
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[SQLAlchemyAccessTokenDatabase]:
    yield SQLAlchemyAccessTokenDatabase(session, AccessToken)


async def get_user_manager(
    user_db: SQLAlchemyUserDatabase = Depends(get_user_db),
) -> AsyncIterator[UserManager]:
    yield UserManager(user_db)