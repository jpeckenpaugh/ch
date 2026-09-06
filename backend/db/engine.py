"""Async engine (aiosqlite) and session factory.

The database location comes from ``backend.config`` (which honors the
``COMPANY_HUB_DB`` override). The engine and session factory are created lazily
and can be re-created via :func:`reset` so the test suite can point the app at
throwaway databases per test.

SQLite foreign-key enforcement is enabled per connection (the SQLAlchemy SQLite
dialect does not enable ``PRAGMA foreign_keys`` by default), so ``ON DELETE
CASCADE`` behaves as the schema declares.
"""

import asyncio
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.config import DB_PATH, PROJECT_ROOT, ensure_dirs

ALEMBIC_INI = PROJECT_ROOT / "backend" / "alembic" / "alembic.ini"

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _database_url() -> str:
    return f"sqlite+aiosqlite:///{DB_PATH}"


def get_engine() -> AsyncEngine:
    """Return the cached async engine, creating it on first use."""
    global _engine
    if _engine is None:
        engine = create_async_engine(_database_url())

        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        _engine = engine
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """Return the cached async session factory for the current engine."""
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _sessionmaker


def reset() -> None:
    """Dispose the cached engine/session factory.

    Used by the test suite so each test can point the app at a fresh database.
    """
    global _engine, _sessionmaker
    if _engine is not None:
        try:
            asyncio.run(_engine.dispose())
        except Exception:
            pass
    _engine = None
    _sessionmaker = None


def run_migrations() -> None:
    """Apply the Alembic migrations up to ``head`` against the current DB.

    Blocking; the async lifespan runs it via ``asyncio.to_thread`` because
    Alembic's command runner spins up its own event loop. A database already at
    the current version requires no further action (a no-op ``upgrade head``).
    """
    from alembic import command
    from alembic.config import Config as AlembicConfig

    ensure_dirs()
    cfg = AlembicConfig(str(ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", _database_url())
    command.upgrade(cfg, "head")


async def run_migrations_async() -> None:
    """Async wrapper around :func:`run_migrations` for the lifespan."""
    await asyncio.to_thread(run_migrations)