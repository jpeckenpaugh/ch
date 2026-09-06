"""Locations sub-resource CRUD (async ORM).

A company has zero or more locations. At most one Headquarters per company is
enforced with a clear ``422`` (the existing Headquarters is left unchanged); a
partial unique index provides defense in depth. Removing the Headquarters is
allowed, so a company may end up with zero locations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.db.session import get_session
from backend.models.company import Company, Location
from backend.models.country import Country
from backend.schemas import LocationIn
from backend.serializers import location_to_dict

router = APIRouter(tags=["locations"])

require_user = require_access("user")


async def _fetch_company(session: AsyncSession, company_id: int) -> None:
    if await session.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail="Company not found")


async def _fetch_location(
    session: AsyncSession, company_id: int, location_id: int
) -> Location:
    location = await session.scalar(
        select(Location).where(
            Location.id == location_id, Location.company_id == company_id
        )
    )
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


async def _country_name(session: AsyncSession, country_code: str) -> str | None:
    return await session.scalar(select(Country.name).where(Country.code == country_code))


async def _validate_country(session: AsyncSession, country_code: str) -> None:
    if await session.scalar(select(Country.code).where(Country.code == country_code)) is None:
        raise HTTPException(status_code=422, detail="Unknown country_code")


async def _ensure_not_second_hq(
    session: AsyncSession, company_id: int, *, exclude_id: int | None = None
) -> None:
    stmt = select(Location.id).where(
        Location.company_id == company_id, Location.type == "Headquarters"
    )
    if exclude_id is not None:
        stmt = stmt.where(Location.id != exclude_id)
    if await session.scalar(stmt) is not None:
        raise HTTPException(
            status_code=422, detail="Company already has a Headquarters"
        )


async def _location_payload(session: AsyncSession, location: Location) -> dict:
    return location_to_dict(location, await _country_name(session, location.country_code))


@router.post("/companies/{company_id}/locations", status_code=201)
async def create_location(
    company_id: int,
    payload: LocationIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    await _validate_country(session, payload.country_code)
    if payload.type == "Headquarters":
        await _ensure_not_second_hq(session, company_id)
    location = Location(
        company_id=company_id,
        label=payload.label,
        address=payload.address,
        city=payload.city,
        country_code=payload.country_code,
        type=payload.type,
    )
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return await _location_payload(session, location)


@router.put("/companies/{company_id}/locations/{location_id}")
async def update_location(
    company_id: int,
    location_id: int,
    payload: LocationIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    await _fetch_location(session, company_id, location_id)
    await _validate_country(session, payload.country_code)
    if payload.type == "Headquarters":
        await _ensure_not_second_hq(session, company_id, exclude_id=location_id)
    location = await _fetch_location(session, company_id, location_id)
    location.label = payload.label
    location.address = payload.address
    location.city = payload.city
    location.country_code = payload.country_code
    location.type = payload.type
    await session.commit()
    await session.refresh(location)
    return await _location_payload(session, location)


@router.delete("/companies/{company_id}/locations/{location_id}", status_code=204)
async def delete_location(
    company_id: int,
    location_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    location = await _fetch_location(session, company_id, location_id)
    await session.delete(location)
    await session.commit()
    return None