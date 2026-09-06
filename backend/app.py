"""FastAPI application assembly (Sprint 02).

Wire-up only: build the app, mount routers and the frontend static files, and
initialize runtime state on startup (migrations, bootstrap admin, seed). No
business logic lives here.

Every ``/api/`` route requires an authenticated session (the fastapi-users
``get_current_user`` dependency over the stateful ``DatabaseStrategy`` +
``CookieTransport``) except ``POST /api/auth/login``; logout is idempotent and
does not require a session. The frontend static files are served without auth —
the SPA itself renders the login view when unauthenticated.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.auth import bootstrap_admin
from backend.auth.oauth import get_google_oauth_router
from backend.auth.providers import router as providers_router
from backend.auth.routers import router as auth_router
from backend.config import FRONTEND_DIR, ensure_dirs
from backend.db.engine import get_sessionmaker, run_migrations
from backend.db.seed import seed_if_empty
from backend.routers import (
    artifacts,
    companies,
    documents,
    industries,
    locations,
    news,
    reference,
    references,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    await asyncio.to_thread(run_migrations)
    await bootstrap_admin()
    async with get_sessionmaker()() as session:
        await seed_if_empty(session)
    yield


app = FastAPI(
    title="Company Hub",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(auth_router, prefix="/api")
app.include_router(providers_router, prefix="/api")

google_oauth_router = get_google_oauth_router()
if google_oauth_router is not None:
    app.include_router(google_oauth_router, prefix="/api")

for router in (
    industries.router,
    reference.router,
    companies.router,
    locations.router,
    references.router,
    news.router,
    artifacts.router,
    documents.router,
):
    app.include_router(router, prefix="/api")

if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")