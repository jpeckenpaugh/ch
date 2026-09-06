"""Company reference model.

``added_by`` (the signed-in user's email snapshot) and ``created_at`` are
immutable; edits update only ``title``, ``url``, ``description``, and
``updated_at``.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config import utc_now
from backend.db.base import Base


class Reference(Base):
    __tablename__ = "references"
    __table_args__ = (Index("idx_references_company", "company_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="cascade"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)

    company: Mapped["Company"] = relationship("Company", back_populates="references")