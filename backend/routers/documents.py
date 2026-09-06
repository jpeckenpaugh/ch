"""Synchronous PDF document generation for a company profile (async ORM).

Generation requires a complete company (Sprint 01 rule: ``name``, an industry,
and the four contact/description text fields). Locations and a logo are not
required; a set logo is embedded when possible and otherwise omitted. PDF
generation and file writes run in a thread so the request loop is not blocked.
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.config import utc_now
from backend.db.session import get_session
from backend.models.artifact import Artifact
from backend.models.company import Company, Location
from backend.models.industry import Industry
from backend.serializers import artifact_to_dict, company_is_complete
from backend.services import pdf, storage

router = APIRouter(tags=["documents"])

_GENERATION_FAILURE = {
    "success": False,
    "message": "Not enough information to generate a document",
    "artifact": None,
}


async def _company_locations(session: AsyncSession, company_id: int) -> list[dict]:
    order = (case((Location.type == "Headquarters", 0), else_=1), Location.id.asc())
    rows = (
        await session.execute(
            select(Location.label, Location.city, Location.country_code)
            .where(Location.company_id == company_id)
            .order_by(*order)
        )
    ).all()
    return [
        {"label": label, "city": city, "country_code": country_code}
        for label, city, country_code in rows
    ]


async def _logo_bytes(session: AsyncSession, company_id: int) -> bytes | None:
    logo = (
        await session.scalars(
            select(Artifact)
            .where(Artifact.company_id == company_id, Artifact.source == "logo")
            .order_by(Artifact.id.desc())
        )
    ).first()
    if logo is None:
        return None
    path = storage.read(logo.company_id, logo.stored_filename)
    if not path.is_file():
        return None
    return await asyncio.to_thread(path.read_bytes)


@router.post("/companies/{company_id}/documents/generate", status_code=201)
async def generate_document(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_access("user")),
):
    company = await session.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    if not company_is_complete(company):
        return JSONResponse(status_code=422, content=_GENERATION_FAILURE)

    industry = None
    if company.industry_id is not None:
        ind = await session.get(Industry, company.industry_id)
        industry = ind.name if ind else None

    data = {
        "name": company.name,
        "website": company.website,
        "contact_email": company.contact_email,
        "contact_phone": company.contact_phone,
        "description": company.description,
        "updated_at": company.updated_at,
    }
    content = await asyncio.to_thread(
        pdf.generate_summary,
        data,
        industry=industry,
        locations=await _company_locations(session, company_id),
        logo_bytes=await _logo_bytes(session, company_id),
    )
    stored_filename = storage.new_stored_filename("company-summary.pdf")
    await asyncio.to_thread(storage.save, company_id, stored_filename, content)

    try:
        artifact = Artifact(
            company_id=company_id,
            original_name=f"{company.name}-summary.pdf",
            stored_filename=stored_filename,
            content_type="application/pdf",
            size_bytes=len(content),
            created_at=utc_now(),
            source="generated",
        )
        session.add(artifact)
        await session.commit()
        await session.refresh(artifact)
    except Exception:
        await asyncio.to_thread(storage.delete, company_id, stored_filename)
        raise

    return JSONResponse(
        status_code=201,
        content={
            "success": True,
            "message": "Document generated",
            "artifact": artifact_to_dict(artifact),
        },
    )