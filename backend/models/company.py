"""Company and location models.

A company has zero or more locations; ``hq_location`` in payloads is derived
from the Headquarters location and never stored. At most one Headquarters per
company is enforced at the application layer (422) and, for defense in depth,
by the partial unique index ``idx_locations_one_hq``.

``passive_deletes=True`` on the child relationships makes ORM company deletion
rely on the database ``ON DELETE CASCADE`` rather than loading and nullifying
children (whose foreign keys are NOT NULL).
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config import utc_now
from backend.db.base import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    industry_id: Mapped[int | None] = mapped_column(
        ForeignKey("industries.id"), nullable=True
    )
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, default=utc_now, nullable=False)

    industry: Mapped["Industry | None"] = relationship("Industry")
    locations: Mapped[list["Location"]] = relationship(
        "Location", back_populates="company", passive_deletes=True
    )
    references: Mapped[list["Reference"]] = relationship(
        "Reference", back_populates="company", passive_deletes=True
    )
    news: Mapped[list["NewsArticle"]] = relationship(
        "NewsArticle", back_populates="company", passive_deletes=True
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        "Artifact", back_populates="company", passive_deletes=True
    )


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        Index("idx_locations_company", "company_id"),
        Index(
            "idx_locations_one_hq",
            "company_id",
            unique=True,
            sqlite_where=text("type = 'Headquarters'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="cascade"), nullable=False
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str] = mapped_column(String, nullable=False)
    country_code: Mapped[str] = mapped_column(
        ForeignKey("countries.code"), nullable=False
    )
    type: Mapped[str] = mapped_column(String, nullable=False)

    company: Mapped["Company"] = relationship("Company", back_populates="locations")