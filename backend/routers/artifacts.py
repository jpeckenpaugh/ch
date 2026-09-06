"""Artifact upload / list / download / delete, plus logo upload/replace/remove
(async SQLAlchemy).

Logos are stored objects like any other artifact (bytes under
``data/artifacts/<company_id>/`` plus a metadata row with ``source = 'logo'``)
but are surfaced separately via ``logo_url`` and excluded from the generic
Files & artifacts list. At most one logo per company is enforced by a partial
unique index; replacing one deletes the previous row (and its bytes) before
inserting the new row within a single transaction. File bytes are handled via
the storage service (off the request loop).
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.config import utc_now
from backend.db.session import get_session
from backend.models.artifact import Artifact
from backend.models.company import Company
from backend.serializers import artifact_to_dict
from backend.services import storage

router = APIRouter(tags=["artifacts"])

require_read_only = require_access("read-only")
require_user = require_access("user")


async def _fetch_company(session: AsyncSession, company_id: int) -> None:
    if await session.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail="Company not found")


async def _fetch_artifact(session: AsyncSession, artifact_id: int) -> Artifact:
    artifact = await session.get(Artifact, artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


def _require_filename(file: UploadFile) -> None:
    if not (file.filename or "").strip():
        raise HTTPException(
            status_code=422, detail="A file part with a filename is required"
        )


@router.post("/companies/{company_id}/artifacts", status_code=201)
async def upload_artifact(
    company_id: int,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    _require_filename(file)
    content = await file.read()
    stored_filename = storage.new_stored_filename(file.filename or "")
    await asyncio.to_thread(storage.save, company_id, stored_filename, content)
    try:
        await _fetch_company(session, company_id)
        artifact = Artifact(
            company_id=company_id,
            original_name=file.filename,
            stored_filename=stored_filename,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=len(content),
            created_at=utc_now(),
            source="upload",
        )
        session.add(artifact)
        await session.commit()
        await session.refresh(artifact)
    except Exception:
        await asyncio.to_thread(storage.delete, company_id, stored_filename)
        raise
    return artifact_to_dict(artifact)


@router.get("/companies/{company_id}/artifacts")
async def list_artifacts(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_read_only),
):
    await _fetch_company(session, company_id)
    rows = (
        await session.scalars(
            select(Artifact)
            .where(Artifact.company_id == company_id, Artifact.source != "logo")
            .order_by(Artifact.id.desc())
        )
    ).all()
    return [artifact_to_dict(a) for a in rows]


@router.get("/artifacts/{artifact_id}/content")
async def download_artifact(
    artifact_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_read_only),
):
    artifact = await _fetch_artifact(session, artifact_id)
    path = storage.read(artifact.company_id, artifact.stored_filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(
        path,
        media_type=artifact.content_type,
        filename=artifact.original_name,
    )


@router.delete("/artifacts/{artifact_id}", status_code=204)
async def delete_artifact(
    artifact_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    artifact = await _fetch_artifact(session, artifact_id)
    company_id, stored_filename = artifact.company_id, artifact.stored_filename
    await session.delete(artifact)
    await session.commit()
    await asyncio.to_thread(storage.delete, company_id, stored_filename)
    return None


@router.post("/companies/{company_id}/logo", status_code=201)
async def upload_logo(
    company_id: int,
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    _require_filename(file)
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Logo must be an image")
    await _fetch_company(session, company_id)
    content = await file.read()
    stored_filename = storage.new_stored_filename(file.filename or "")
    await asyncio.to_thread(storage.save, company_id, stored_filename, content)
    old_row = None
    old_company_id = None
    old_stored = None
    try:
        old_row = (
            await session.scalars(
                select(Artifact)
                .where(Artifact.company_id == company_id, Artifact.source == "logo")
                .order_by(Artifact.id.desc())
            )
        ).first()
        if old_row is not None:
            old_company_id, old_stored = old_row.company_id, old_row.stored_filename
            await session.delete(old_row)
            # Flush the delete before inserting the replacement: the partial
            # unique index idx_artifacts_one_logo forbids two 'logo' rows for a
            # company, and the ORM flush order would otherwise insert first.
            await session.flush()
        artifact = Artifact(
            company_id=company_id,
            original_name=file.filename,
            stored_filename=stored_filename,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=len(content),
            created_at=utc_now(),
            source="logo",
        )
        session.add(artifact)
        await session.commit()
        await session.refresh(artifact)
    except Exception:
        await asyncio.to_thread(storage.delete, company_id, stored_filename)
        raise
    if old_row is not None:
        await asyncio.to_thread(storage.delete, old_company_id, old_stored)
    return artifact_to_dict(artifact)


@router.delete("/companies/{company_id}/logo", status_code=204)
async def delete_logo(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    logo = (
        await session.scalars(
            select(Artifact)
            .where(Artifact.company_id == company_id, Artifact.source == "logo")
            .order_by(Artifact.id.desc())
        )
    ).first()
    if logo is None:
        raise HTTPException(status_code=404, detail="Logo not found")
    cid, stored_filename = logo.company_id, logo.stored_filename
    await session.delete(logo)
    await session.commit()
    await asyncio.to_thread(storage.delete, cid, stored_filename)
    return None