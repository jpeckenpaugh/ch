"""Company news sub-resource CRUD (async ORM).

UI-created records always have ``is_scraped = false``; the API accepts the flag
so automated workflows may set it true later. On ``PUT`` an omitted
``is_scraped`` preserves the current value.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.roles import require_access
from backend.config import utc_now
from backend.db.session import get_session
from backend.models.company import Company
from backend.models.news_article import NewsArticle
from backend.schemas import NewsIn
from backend.serializers import news_to_dict

router = APIRouter(tags=["news"])

require_user = require_access("user")

_EDITABLE_FIELDS = ("title", "source", "url", "published_at", "summary")


async def _fetch_company(session: AsyncSession, company_id: int) -> None:
    if await session.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail="Company not found")


async def _fetch_news(
    session: AsyncSession, company_id: int, news_id: int
) -> NewsArticle:
    article = await session.scalar(
        select(NewsArticle).where(
            NewsArticle.id == news_id, NewsArticle.company_id == company_id
        )
    )
    if article is None:
        raise HTTPException(status_code=404, detail="News article not found")
    return article


def _scraped_flag(payload: NewsIn, current: bool | None = None) -> bool:
    if payload.is_scraped is not None:
        return payload.is_scraped
    return bool(current) if current is not None else False


@router.post("/companies/{company_id}/news", status_code=201)
async def create_news(
    company_id: int,
    payload: NewsIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    now = utc_now()
    article = NewsArticle(
        company_id=company_id,
        title=payload.title,
        source=payload.source,
        url=payload.url,
        published_at=payload.published_at,
        summary=payload.summary,
        is_scraped=_scraped_flag(payload),
        created_at=now,
        updated_at=now,
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return news_to_dict(article)


@router.put("/companies/{company_id}/news/{news_id}")
async def update_news(
    company_id: int,
    news_id: int,
    payload: NewsIn,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    existing = await _fetch_news(session, company_id, news_id)
    for field in _EDITABLE_FIELDS:
        setattr(existing, field, getattr(payload, field))
    existing.is_scraped = _scraped_flag(payload, existing.is_scraped)
    existing.updated_at = utc_now()
    await session.commit()
    await session.refresh(existing)
    return news_to_dict(existing)


@router.delete("/companies/{company_id}/news/{news_id}", status_code=204)
async def delete_news(
    company_id: int,
    news_id: int,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_user),
):
    await _fetch_company(session, company_id)
    article = await _fetch_news(session, company_id, news_id)
    await session.delete(article)
    await session.commit()
    return None