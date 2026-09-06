"""Fixed standard country reference model (read-only this sprint).

``code`` is the ISO 3166-1 alpha-2 code (e.g. ``GB`` for the United Kingdom);
both ``code`` and ``name`` are unique.
"""

from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.config import utc_now
from backend.db.base import Base


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(2), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)