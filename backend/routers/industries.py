"""Industry reference data: list, add, and rename (no delete this sprint)
via the async ORM.

Industries are controlled references: companies store ``industry_id`` and never
the label, so a rename resolves everywhere automatically. Duplicate detection is
case-insensitive at the application layer so the controlled vocabulary cannot
accumulate case-variant near-duplicates.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.config import utc_now
from backend.db.session import get_session
from backend.models.industry import Industry
from backend.schemas import IndustryIn

router = APIRouter(prefix="/industries", tags=["industries"])

require_read_only = require_access("read-only")
require_user = require_access("user")


async def _fetch_industry(session: AsyncSession, industry_id: int) -> Industry:
    industry = await session.get(Industry, industry_id)
    if industry is None:
        raise HTTPException(status_code=404, detail="Industry not found")
    return industry


async def _existing_id_named(session: AsyncSession, name: str) -> int | None:
    return await session.scalar(
        select(Industry.id).where(func.lower(Industry.name) == name.lower())
    )


@router.get("")
async def list_industries(
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_read_only),
):
    rows = (
        await session.scalars(
            select(Industry).order_by(func.lower(Industry.name), Industry.name)
        )
    ).all()
    return [{"id": r.id, "name": r.name} for r in rows]


@router.post("", status_code=201)
async def create_industry(
    payload: IndustryIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    name = payload.name
    if await _existing_id_named(session, name) is not None:
        raise HTTPException(status_code=409, detail="Industry already exists")
    industry = Industry(name=name, created_at=utc_now())
    session.add(industry)
    await session.commit()
    await session.refresh(industry)
    return {"id": industry.id, "name": industry.name}


@router.put("/{industry_id}")
async def rename_industry(
    industry_id: int,
    payload: IndustryIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    name = payload.name
    await _fetch_industry(session, industry_id)
    existing = await _existing_id_named(session, name)
    if existing is not None and existing != industry_id:
        raise HTTPException(status_code=409, detail="Industry already exists")
    industry = await _fetch_industry(session, industry_id)
    industry.name = name
    await session.commit()
    return {"id": industry_id, "name": industry.name}