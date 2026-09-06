"""Company CRUD + profile payloads (async SQLAlchemy).

Company payloads resolve controlled data at read time: ``industry`` is nested
``{id, name}``, ``hq_location`` is derived from the Headquarters location
(never stored), and ``logo_url`` points at the stored logo object. The generic
``artifacts_count`` excludes ``source = 'logo'`` rows.
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import false, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.config import utc_now
from backend.db.session import get_session
from backend.models.artifact import Artifact
from backend.models.company import Company, Location
from backend.models.country import Country
from backend.models.industry import Industry
from backend.models.news_article import NewsArticle
from backend.models.reference import Reference
from backend.schemas import CompanyIn
from backend.serializers import (
    artifact_to_dict,
    company_item_to_dict,
    location_to_dict,
    news_to_dict,
    reference_to_dict,
)
from backend.services import storage

router = APIRouter(prefix="/companies", tags=["companies"])

require_read_only = require_access("read-only")
require_user = require_access("user")

_COMPANY_FIELDS = (
    "name",
    "industry_id",
    "website",
    "contact_email",
    "contact_phone",
    "description",
)


async def _fetch_company(session: AsyncSession, company_id: int) -> Company:
    company = await session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def _validate_industry(session: AsyncSession, industry_id: int | None) -> None:
    if industry_id is None:
        return
    if await session.get(Industry, industry_id) is None:
        raise HTTPException(status_code=422, detail="Unknown industry_id")


async def _industry_map(session: AsyncSession) -> dict[int, dict]:
    rows = (await session.scalars(select(Industry))).all()
    return {r.id: {"id": r.id, "name": r.name} for r in rows}


async def _counts_map(session: AsyncSession, company_ids: list[int]) -> dict[int, int]:
    if not company_ids:
        return {}
    stmt = (
        select(Artifact.company_id, func.count())
        .where(Artifact.company_id.in_(company_ids), Artifact.source != "logo")
        .group_by(Artifact.company_id)
    )
    return {cid: n for cid, n in (await session.execute(stmt)).all()}


async def _hq_map(session: AsyncSession, company_ids: list[int]) -> dict[int, str]:
    """Map company_id -> "<city>, <country_code>" of its Headquarters."""
    if not company_ids:
        return {}
    stmt = (
        select(Location.company_id, Location.city, Location.country_code)
        .where(Location.company_id.in_(company_ids), Location.type == "Headquarters")
        .order_by(Location.id)
    )
    result: dict[int, str] = {}
    for cid, city, country_code in (await session.execute(stmt)).all():
        result.setdefault(cid, f"{city}, {country_code}")
    return result


async def _logo_map(session: AsyncSession, company_ids: list[int]) -> dict[int, str]:
    if not company_ids:
        return {}
    stmt = (
        select(Artifact.company_id, Artifact.id)
        .where(Artifact.company_id.in_(company_ids), Artifact.source == "logo")
        .order_by(Artifact.id)
    )
    result: dict[int, str] = {}
    for cid, artifact_id in (await session.execute(stmt)).all():
        result.setdefault(cid, f"/api/artifacts/{artifact_id}/content")
    return result


def _item(
    company: Company,
    counts: dict[int, int],
    industry_map: dict[int, dict],
    hq_map: dict[int, str],
    logo_map: dict[int, str],
) -> dict:
    return company_item_to_dict(
        company,
        industry_map.get(company.industry_id),
        hq_map.get(company.id),
        counts.get(company.id, 0),
        logo_map.get(company.id),
    )


async def _items_for(session: AsyncSession, company_ids: list[int]):
    counts = await _counts_map(session, company_ids)
    industry_map = await _industry_map(session)
    hq_map = await _hq_map(session, company_ids)
    logo_map = await _logo_map(session, company_ids)
    return counts, industry_map, hq_map, logo_map


def _apply_company_fields(company: Company, payload: CompanyIn) -> None:
    for field in _COMPANY_FIELDS:
        setattr(company, field, getattr(payload, field))


@router.get("")
async def list_companies(
    q: str | None = None,
    countries: str | None = None,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_read_only),
):
    stmt = select(Company)
    if q:
        stmt = stmt.where(Company.name.ilike(f"%{q}%"))
    codes = [c.strip() for c in countries.split(",")] if countries is not None else None
    codes = [c for c in codes if c] if codes is not None else None
    if codes:
        stmt = stmt.where(
            Company.id.in_(
                select(Location.company_id).where(Location.country_code.in_(codes))
            )
        )
    elif countries is not None:
        # Filter present but no valid codes: active filter matching nothing.
        stmt = stmt.where(false())
    stmt = stmt.order_by(Company.id.asc())

    companies = (await session.scalars(stmt)).all()
    ids = [c.id for c in companies]
    counts, industry_map, hq_map, logo_map = await _items_for(session, ids)
    return [
        _item(c, counts, industry_map, hq_map, logo_map)
        for c in companies
    ]


@router.post("", status_code=201)
async def create_company(
    payload: CompanyIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _validate_industry(session, payload.industry_id)
    company = Company(created_at=utc_now(), updated_at=utc_now())
    _apply_company_fields(company, payload)
    session.add(company)
    await session.commit()
    await session.refresh(company)
    counts, industry_map, hq_map, logo_map = await _items_for(session, [company.id])
    return _item(company, counts, industry_map, hq_map, logo_map)


@router.get("/{company_id}")
async def get_company(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_read_only),
):
    company = await _fetch_company(session, company_id)
    counts, industry_map, hq_map, logo_map = await _items_for(session, [company_id])
    data = _item(company, counts, industry_map, hq_map, logo_map)

    loc_rows = (
        await session.execute(
            select(Location, Country.name.label("country_name"))
            .outerjoin(Country, Country.code == Location.country_code)
            .where(Location.company_id == company_id)
            .order_by(Location.id.asc())
        )
    ).all()
    data["locations"] = [
        location_to_dict(loc, country_name) for loc, country_name in loc_rows
    ]

    refs = (
        await session.scalars(
            select(Reference)
            .where(Reference.company_id == company_id)
            .order_by(Reference.id.desc())
        )
    ).all()
    data["references"] = [reference_to_dict(r) for r in refs]

    news = (
        await session.scalars(
            select(NewsArticle)
            .where(NewsArticle.company_id == company_id)
            .order_by(NewsArticle.id.desc())
        )
    ).all()
    data["news"] = [news_to_dict(n) for n in news]

    arts = (
        await session.scalars(
            select(Artifact)
            .where(Artifact.company_id == company_id, Artifact.source != "logo")
            .order_by(Artifact.id.desc())
        )
    ).all()
    data["artifacts"] = [artifact_to_dict(a) for a in arts]
    return data


@router.put("/{company_id}")
async def update_company(
    company_id: int,
    payload: CompanyIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    company = await _fetch_company(session, company_id)
    await _validate_industry(session, payload.industry_id)
    _apply_company_fields(company, payload)
    company.updated_at = utc_now()
    await session.commit()
    await session.refresh(company)
    counts, industry_map, hq_map, logo_map = await _items_for(session, [company_id])
    return _item(company, counts, industry_map, hq_map, logo_map)


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    company = await _fetch_company(session, company_id)
    await session.delete(company)
    await session.commit()
    await asyncio.to_thread(storage.delete_company_dir, company_id)
    return None