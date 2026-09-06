"""Fastapi-users integer-PK user model.

The password column keeps the Sprint 01 name ``password_hash`` (TEXT NOT NULL)
but now holds a ``pwdlib``-generated hash (argon2/bcrypt) produced by
fastapi-users, replacing the hand-rolled PBKDF2 string of §8.2.1.

Sprint 03: the single ``is_superuser`` boolean is replaced by the four-level
``access_level`` (``guest``/``read-only``/``user``/``admin``). ``admin`` is the
superuser tier. The model default is ``'guest'`` so a row created without an
explicit level (e.g. the fastapi-users SSO auto-provision path) lands at guest.
"""

from __future__ import annotations

from sqlalchemy import CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config import utc_now
from backend.db.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "access_level IN ('guest','read-only','user','admin')",
            name="ck_users_access_level",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(
        "password_hash", String(1024), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    access_level: Mapped[str] = mapped_column(
        String(20), default="guest", nullable=False
    )
    created_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        "OAuthAccount", back_populates="user", passive_deletes=True
    )