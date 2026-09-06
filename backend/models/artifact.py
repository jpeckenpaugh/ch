"""Stored-object metadata model.

Bytes live on disk under ``data/artifacts/<company_id>/`` keyed by the
server-generated ``stored_filename`` (never exposed to clients); the database
row holds only metadata. ``source`` is one of ``upload``, ``generated``, or
``logo``. At most one logo per company is enforced by the partial unique index
``idx_artifacts_one_logo``.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config import utc_now
from backend.db.base import Base


class Artifact(Base):
    __tablename__ = "artifacts"
    __table_args__ = (
        Index("idx_artifacts_company", "company_id"),
        Index(
            "idx_artifacts_one_logo",
            "company_id",
            unique=True,
            sqlite_where=text("source = 'logo'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="cascade"), nullable=False
    )
    original_name: Mapped[str] = mapped_column(String, nullable=False)
    stored_filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)

    company: Mapped["Company"] = relationship("Company", back_populates="artifacts")