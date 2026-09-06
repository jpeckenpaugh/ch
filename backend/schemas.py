"""Pydantic request models for the API contract.

Sprint 01: company requests carry ``industry_id`` (a controlled reference)
instead of free-form ``industry``/``hq_location`` text. All structured company
fields are optional except ``name``, which must be non-empty. Auth request
models (login/change-password/user-create) live in ``backend/auth/schemas.py``.
"""

import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

_LOCATION_TYPES = Literal["Headquarters", "Office", "Plant", "Other"]
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _strip_non_empty(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("must not be empty")
    return value


class CompanyIn(BaseModel):
    name: str
    industry_id: Optional[int] = None
    website: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        return _strip_non_empty(v)


class IndustryIn(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        return _strip_non_empty(v)


class LocationIn(BaseModel):
    label: str
    address: Optional[str] = None
    city: str
    country_code: str
    type: _LOCATION_TYPES

    @field_validator("label", "city", "country_code")
    @classmethod
    def required_must_not_be_blank(cls, v: str) -> str:
        return _strip_non_empty(v)


class ReferenceIn(BaseModel):
    title: str
    url: str
    description: Optional[str] = None

    @field_validator("title", "url")
    @classmethod
    def required_must_not_be_blank(cls, v: str) -> str:
        return _strip_non_empty(v)


class NewsIn(BaseModel):
    title: str
    source: str
    url: str
    published_at: str
    summary: Optional[str] = None
    is_scraped: Optional[bool] = None

    @field_validator("title", "source", "url")
    @classmethod
    def required_must_not_be_blank(cls, v: str) -> str:
        return _strip_non_empty(v)

    @field_validator("published_at")
    @classmethod
    def published_at_must_be_date(cls, v: str) -> str:
        v = v.strip()
        if not _DATE_RE.fullmatch(v):
            raise ValueError("published_at must be a date in YYYY-MM-DD form")
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:  # pragma: no cover - guards impossible dates
            raise ValueError("published_at must be a valid date") from exc
        return v
