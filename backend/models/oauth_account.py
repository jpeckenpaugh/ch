"""Schema-only OAuth account model (scope item k, brief 06).

The account model can represent a link to an external identity provider, but no
OAuth login routes or SSO flows exist this sprint and no rows are written. The
columns beyond the link identity (``oauth_name``, ``account_id``) follow the
standard fastapi-users OAuth account shape so a future Google-SSO sprint can
consume them without a data-model change.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "oauth_name", name="uq_oauth_accounts_user_provider"
        ),
        UniqueConstraint(
            "oauth_name", "account_id", name="uq_oauth_accounts_provider_account"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="cascade"), nullable=False
    )
    oauth_name: Mapped[str] = mapped_column(String(100), nullable=False)
    access_token: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True)
    account_id: Mapped[str] = mapped_column(String(320), nullable=False)
    account_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")