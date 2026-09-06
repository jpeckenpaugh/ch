"""Access-token store for the fastapi-users stateful ``DatabaseStrategy``.

Columns follow architecture §9.1.2 exactly (id, token, user_id, created_at,
lifetime_seconds). ``lifetime_seconds`` records the session's configured
lifetime (NULL = the token does not expire); expiry is enforced by the strategy
against ``created_at``. ``created_at`` is a SQLAlchemy ``DateTime`` (internal,
never exposed in payloads) so the strategy can compute the token's age.
"""

from __future__ import annotations

from datetime import datetime

from fastapi_users_db_sqlalchemy.generics import now_utc
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class AccessToken(Base):
    __tablename__ = "access_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="cascade"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    lifetime_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)