"""Per-request async session dependency."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.engine import get_sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a short-lived async session; closed when the request ends."""
    maker = get_sessionmaker()
    async with maker() as session:
        yield session