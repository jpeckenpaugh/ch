"""User manager and the stable admin bootstrap.

The manager validates passwords (minimum length, a backend-authored rule) and
parses integer user ids. ``bootstrap_admin`` creates the stable superuser
idempotently on startup: password from ``COMPANY_HUB_ADMIN_PASSWORD`` if set,
else a fresh complex password generated and printed once at creation. The
credential persists in the database and is never re-randomized on later
restarts (supersedes the Sprint 01 per-startup regeneration).
"""

import os
import secrets

from fastapi_users import exceptions
from fastapi_users.manager import BaseUserManager, IntegerIDMixin

from backend.auth.schemas import UserCreate
from backend.config import ADMIN_EMAIL, AGENT_EMAIL, utc_now
from backend.db.engine import get_sessionmaker
from backend.models.user import User

MIN_PASSWORD_LENGTH = 8


class UserManager(IntegerIDMixin, BaseUserManager[User, int]):
    """Integer-PK user manager with a minimal password policy.

    ``reset_password_token_secret``/``verification_token_secret`` are required
    class attributes; neither the reset nor the verify router is mounted this
    sprint, so they are never exercised.
    """

    reset_password_token_secret = "company-hub-reset-password-secret"
    verification_token_secret = "company-hub-verify-token-secret"

    async def validate_password(self, password: str, user: UserCreate | User) -> None:
        if len(password) < MIN_PASSWORD_LENGTH:
            raise exceptions.InvalidPasswordException(
                reason=f"Password should be at least {MIN_PASSWORD_LENGTH} characters"
            )


async def _ensure_user(
    session, user_db, email: str, password_env: str, access_level: str, label: str
) -> None:
    """Create a user idempotently, enforcing ``password_env`` when set.

    When the ``*_PASSWORD`` env var is set the credential is enforced
    deterministically (created with it if absent, reset to it if present).
    When it is unset, an existing account is left untouched and a missing one
    is created with a fresh complex password generated and printed once.
    """
    existing = await user_db.get_by_email(email)
    from_env = bool(os.environ.get(password_env))
    password = os.environ.get(password_env)

    if existing is not None:
        if from_env:
            existing.hashed_password = UserManager(user_db).password_helper.hash(password)
            await session.commit()
        return

    password = password or secrets.token_urlsafe(24)
    hashed = UserManager(user_db).password_helper.hash(password)
    await user_db.create(
        {
            "email": email,
            "hashed_password": hashed,
            "is_active": True,
            "access_level": access_level,
            "is_verified": True,
            "created_at": utc_now(),
        }
    )
    if not from_env:
        print(
            f"\nCompany Hub {label} login -> email: {email}  password: {password}\n",
            flush=True,
        )


async def bootstrap_admin() -> None:
    """Ensure the bootstrap accounts exist with the configured passwords.

    Creates ``admin@localhost`` (admin) and ``agent@localhost`` (user), each
    governed by its own ``COMPANY_HUB_*_PASSWORD`` env var.
    """
    from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

    async with get_sessionmaker()() as session:
        user_db = SQLAlchemyUserDatabase(session, User)
        await _ensure_user(
            session, user_db, ADMIN_EMAIL, "COMPANY_HUB_ADMIN_PASSWORD", "admin", "admin"
        )
        await _ensure_user(
            session, user_db, AGENT_EMAIL, "COMPANY_HUB_AGENT_PASSWORD", "user", "agent"
        )