"""Company news article model.

UI-created records always have ``is_scraped = false``; the API accepts the flag
so automated workflows may set it true later.
"""

from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config import utc_now
from backend.db.base import Base


class NewsArticle(Base):
    __tablename__ = "news_articles"
    __table_args__ = (Index("idx_news_company", "company_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="cascade"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)
    published_at: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_scraped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)

    company: Mapped["Company"] = relationship("Company", back_populates="news")