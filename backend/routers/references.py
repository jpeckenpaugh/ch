"""Company references sub-resource CRUD (async ORM).

A reference belongs to exactly one company. ``added_by`` (the signed-in user's
email, sourced from the fastapi-users current user) and ``created_at`` are
immutable; edits update only ``title``, ``url``, ``description``, and
``updated_at``.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.config import utc_now
from backend.db.session import get_session
from backend.models.company import Company
from backend.models.reference import Reference
from backend.models.user import User
from backend.schemas import ReferenceIn
from backend.serializers import reference_to_dict

router = APIRouter(tags=["references"])

require_user = require_access("user")

_EDITABLE_FIELDS = ("title", "url", "description")


async def _fetch_company(session: AsyncSession, company_id: int) -> None:
    if await session.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail="Company not found")


async def _fetch_reference(
    session: AsyncSession, company_id: int, reference_id: int
) -> Reference:
    reference = await session.scalar(
        select(Reference).where(
            Reference.id == reference_id, Reference.company_id == company_id
        )
    )
    if reference is None:
        raise HTTPException(status_code=404, detail="Reference not found")
    return reference


@router.post("/companies/{company_id}/references", status_code=201)
async def create_reference(
    company_id: int,
    payload: ReferenceIn,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_user),
):
    await _fetch_company(session, company_id)
    now = utc_now()
    reference = Reference(
        company_id=company_id,
        title=payload.title,
        url=payload.url,
        description=payload.description,
        added_by=current_user.email,
        created_at=now,
        updated_at=now,
    )
    session.add(reference)
    await session.commit()
    await session.refresh(reference)
    return reference_to_dict(reference)


@router.put("/companies/{company_id}/references/{reference_id}")
async def update_reference(
    company_id: int,
    reference_id: int,
    payload: ReferenceIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    reference = await _fetch_reference(session, company_id, reference_id)
    for field in _EDITABLE_FIELDS:
        setattr(reference, field, getattr(payload, field))
    reference.updated_at = utc_now()
    await session.commit()
    await session.refresh(reference)
    return reference_to_dict(reference)


@router.delete("/companies/{company_id}/references/{reference_id}", status_code=204)
async def delete_reference(
    company_id: int,
    reference_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    reference = await _fetch_reference(session, company_id, reference_id)
    await session.delete(reference)
    await session.commit()
    return None