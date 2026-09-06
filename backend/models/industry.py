"""Controlled industry reference model.

Companies store ``industry_id`` (never the label), so a rename resolves
everywhere automatically. ``name`` is unique.
"""

from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config import utc_now
from backend.db.base import Base


class Industry(Base):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)