"""Reference data: the fixed standard country list (read-only), via the async
ORM. No runtime country-management UI this sprint; the list is the curated seed
list.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.db.session import get_session
from backend.models.country import Country

router = APIRouter(prefix="/countries", tags=["countries"])


@router.get("")
async def list_countries(
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_access("read-only")),
):
    rows = (
        await session.scalars(
            select(Country).order_by(func.lower(Country.name), Country.name)
        )
    ).all()
    return [{"code": c.code, "name": c.name} for c in rows]