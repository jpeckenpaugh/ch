# Summary: Backend Engineer (Stage 6)

- **Date:** 2026-09-04
- **Author / Executor:** opencode (Stage 6 role)
- **Instruction file:** `instructions/enhancements/06-backend.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 06: implement sprint 02 backend (async ORM + alembic + fastapi-users)`

## Work Completed

Implemented the Sprint 02 backend per `docs/architecture.md` §9 and the six
briefs (`features/briefs/01-…-06-…`):

- **Persistence (briefs 01, 02):** replaced the hand-written `sqlite3` layer
  with async SQLAlchemy 2.0 (`aiosqlite`): ORM models under `backend/models/*`,
  a per-request async session (`backend/db/session.py`), and an async engine
  (`backend/db/engine.py`) with SQLite foreign-key enforcement. All routers now
  read/write through the ORM with byte-for-byte unchanged non-auth API
  contracts. Versioned Alembic migrations (`backend/alembic/`) with the Sprint
  01 schema as the initial baseline revision and a Sprint 02 revision applying
  the auth/schema deltas; migrations run to `head` on startup (idempotent).
- **Auth (briefs 03, 04, 05):** replaced the hand-rolled sessions/PBKDF2 auth
  with fastapi-users 15.0.5 — integer-PK `User`, the stock stateful
  `DatabaseStrategy` + `CookieTransport` (HttpOnly `session` cookie), the
  `access_tokens` store, `oauth_accounts` schema-only (brief 06). Idempotent
  stable admin bootstrap (password from `COMPANY_HUB_ADMIN_PASSWORD` or
  generated/printed once). Superuser-only `POST /api/auth/users`;
  self-service `POST /api/auth/change-password`. All `/api/` routes gated by an
  authenticated session except login.
- **Tests:** updated `tests/backend/` to the new contract (the stage owns the
  backend suite as the regression gate per scope **m**) and added new coverage
  for password change, multiple users, session expiry, and idempotent logout.
- **Environment:** installed the Stage 4 dependencies into `.venv` (they were
  pinned but not yet installed) and performed the one-time `data/` flush (scope
  **n**) to establish the migration baseline; `backend.app:app` is preserved.

## Outputs Produced / Modified

- `backend/config.py` — **new.** Paths/environment overrides (honors
  `COMPANY_HUB_DB`, `COMPANY_HUB_SESSION_TTL`), `ADMIN_EMAIL`, `utc_now`.
- `backend/models/` — **new** (replaces `backend/models.py`): `user`,
  `access_token`, `oauth_account`, `company` (+ `location`), `industry`,
  `country`, `reference`, `news_article`, `artifact`; `__init__` re-exports all
  for metadata. `User.hashed_password` maps to the Sprint 01 `password_hash`
  column.
- `backend/db/` — **new** (replaces `backend/db.py`): `base.py`
  (`DeclarativeBase`), `engine.py` (lazy async engine/session factory,
  migrations, test `reset()`), `session.py` (per-request dependency),
  `seed.py` (re-homed from `backend/data/seed.py`, content unchanged).
- `backend/auth/` — **new** (replaces `backend/routers/auth.py`): `db.py`
  (fastapi-users DB adapters + user-manager dependency), `strategies.py`
  (`DatabaseStrategy` + `CookieTransport`), `managers.py` (`UserManager`,
  `bootstrap_admin`), `schemas.py` (auth serializers), `dependencies.py`
  (`get_current_user` / `get_current_superuser`), `routers.py` (custom auth
  router assembly).
- `backend/serializers.py` — **new.** Row→JSON helpers and the company payload
  builder (role of the removed `backend/models.py` helpers).
- `backend/routers/*` — **modified.** All routers converted to async ORM; file
  I/O and PDF generation run via `asyncio.to_thread` (off the request loop).
  `backend/routers/auth.py` **removed** (superseded).
- `backend/app.py` — **modified.** Lifespan now runs migrations, bootstrap
  admin, then seed-on-empty; auth router mounted separately; all other routers
  gated with `Depends(get_current_user)`.
- `backend/alembic/` — **new.** `alembic.ini`, async `env.py`, and versions
  `0001_sprint01_baseline` (verbatim Sprint 01 schema) and
  `0002_sprint02_auth_orm` (users flags, drop `sessions`, add
  `access_tokens` + `oauth_accounts`).
- `backend/schemas.py`, `backend/services/storage.py` — **modified** (small):
  `LoginIn` moved to `backend/auth/schemas.py`; storage import re-pointed to
  `backend.config`.
- `tests/backend/conftest.py`, `test_auth.py`, `test_seed.py`,
  `test_references.py` — **modified.** New contract + new auth checks.

## Key Decisions

- **Resolutions applied (authoritative, run decision-maker):** JSON login body;
  custom idempotent logout; `access_tokens` columns per §9.1.2 (no
  `expires_at`, refresh disabled); `access_tokens.created_at` stored as
  SQLAlchemy `DateTime` (internal, never exposed); migration baseline = Sprint
  01 schema verbatim with a Sprint 02 revision applying the deltas.
- **Custom auth-router assembly** (`backend/auth/routers.py`) instead of the
  stock `get_auth_router`: the contract requires a JSON login body, an
  idempotent logout (`204` with no session — the stock router returns `401`),
  and the `{id, email, is_superuser}` `me` payload. Routes are built from the
  same fastapi-users components (`UserManager.authenticate`,
  `DatabaseStrategy`, `CookieTransport`).
- **`me`/`login`/`user-create` email is plain `str`, not `EmailStr`:** Pydantic
  `EmailStr` rejects `admin@localhost` (dot-less domain). A light validator
  (non-empty, contains `@`, lowercased) replaces it. Created accounts store
  lowercase email; sign-in is case-insensitive.
- **Auth dependency:** `get_current_user` resolves the `session` cookie via the
  strategy and raises exactly `401 {"detail": "Not authenticated"}` (the stock
  authenticator's 401 has a null detail, which would violate §9.2).
- **Password policy (backend-authored):** minimum 8 characters, enforced in
  `UserManager.validate_password` and in the auth schemas → `422` for too-short
  passwords on change-password and user creation. Recorded so the frontend can
  surface it.
- **`lifetime_seconds` column:** a small `DatabaseStrategy` subclass writes the
  configured TTL into the column (NULL = never expires); expiry itself is the
  stock strategy's absolute-lifetime check against `created_at`.
- **Logo replace:** explicit `flush()` between deleting the old `logo` row and
  inserting the replacement — the ORM flush order would otherwise insert first
  and trip the `idx_artifacts_one_logo` partial unique index.
- **Schema migration on existing data:** the dev DB is flushed once (scope **n**),
  so migrations run fresh in sequence; `users` gains the `is_*` columns with
  SQLite `server_default` (1/0/0) so the columns are NOT NULL.
- **Alembic invocation:** `run_migrations()` runs `command.upgrade(cfg, "head")`
  via `asyncio.to_thread` (Alembic spins its own event loop); `script_location =
  %(here)s` makes it cwd-independent.

## Open Questions & Concerns

- **Frontend (Stage 7) handoff:** the `POST /api/auth/login` success body is now
  `{access_token, token_type}` (the SPA's `login.js` currently does
  `setSession(user)` expecting `{id, email}`); `GET /api/auth/me` now returns
  `{id, email, is_superuser}` (additive). Sign-in/sign-out paths are unchanged.
  A new self-service change-password form is needed. `PATCH /api/auth/me` is
  implemented (password-only self-service) but unused by the SPA.
- **Verification (Stage 8) handoff:** backend suite is updated (64 passing) with
  new auth checks (password change, multiple users, session expiry). Browser
  suite is Stage 7's to update (login-flow tests); the run uses
  `COMPANY_HUB_ADMIN_PASSWORD` (default `test-admin-password`), which now
  persists across restarts (no re-randomization).
- **Operational notes for Stage 7/8:** after the Stage 6 `data/` flush, the next
  `./run.sh` migrates and seeds the fresh dev DB automatically (one-time
  baseline established). The admin password printed at boot is stable across
  restarts unless the admin is deleted.
- **Minor contract notes:** login/`me`/account-creation email validation is the
  light shape check above (not full RFC email validation); `change-password`
  requires ≥8-char new password.

## Status

- [x] Complete
- [ ] Needs review