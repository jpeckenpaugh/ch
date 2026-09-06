# Summary: System Engineer (Stage 4)

- **Date:** 2026-09-04
- **Author / Executor:** opencode (Stage 4 role)
- **Instruction file:** `instructions/enhancements/04-system-engineering.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 04: provision ORM/auth dependencies and environment notes`

## Work Completed

Reassessed the existing v0.1 development/runtime environment against the six
Sprint 02 briefs. The Sprint 02 scope introduces a new dependency surface the
v0.1 environment did not cover — a maintained ORM, versioned migrations, and the
fastapi-users auth library — so environment changes were required. I added the
new pinned dependencies to `requirements.txt`, and updated
`environment-notes.md` to record the new packages and the one-time migration
baseline flush for Sprint 02. No other environment artifacts needed changes.

## Outputs Produced / Modified

- `requirements.txt` — modified. Added, pinned (latest-stable compatible):
  `sqlalchemy[asyncio]==2.0.52`, `alembic==1.19.2`, `aiosqlite==0.22.1`,
  `fastapi-users[sqlalchemy]==15.0.5`, `fastapi-users-db-sqlalchemy==7.0.0`,
  `pwdlib[argon2,bcrypt]==0.3.0`, `email-validator==2.3.0`, `makefun==1.16.0`,
  `pyjwt[crypto]==2.13.0`. Existing deps (`fastapi`, `uvicorn`,
  `python-multipart`, `fpdf2`) retained unchanged.
- `environment-notes.md` — modified. Expanded the dependencies table with the
  new packages and their roles; updated the storage section (SQLite now via
  async SQLAlchemy/aiosqlite); added a "Sprint 02 — migration baseline flush"
  note mirroring the documented Sprint 01 flush.
- `instructions/enhancements/summaries/04-system-engineering.md` — new summary.

No changes to `install.sh`, `run.sh`, `.gitignore`, or `requirements-dev.txt`.

## Key Decisions

- **Version pinning:** pinned latest-stable compatible versions per the run's
  directive — SQLAlchemy 2.0.52, fastapi-users 15.0.5, fastapi-users-db-
  sqlalchemy 7.0.0, latest Alembic (1.19.2) and aiosqlite (0.22.1).
- **fastapi-users `[sqlalchemy]` extra only:** no `[oauth]` extra was added,
  because brief 06 is schema-only and no OAuth routes are in scope this sprint.
- **Password hashing:** `pwdlib[argon2,bcrypt]==0.3.0` (fastapi-users' default
  pinned backend) replaces the hand-rolled PBKDF2; the maintained library's
  hashing is used per brief 03 and scope item **f**. The hand-rolled code is
  removed by the Backend stage (6), not here.
- **Transitives:** pinned `email-validator`, `makefun`, and `pyjwt[crypto]`
  (all required by fastapi-users 15.0.5). Note: the resolver's
  "itsdangerous" suggestion was checked against the package's `requires_dist`
  and is **not** a fastapi-users 15.0.5 dependency, so it was not added.
- **`run.sh`, `.gitignore`, interpreter untouched** (scope **o**): the entry
  contract `backend.app:app`, gitignore paths (`.venv/`, `data/`, `tmp/`), and
  Python 3.12 remain as-is.
- **No session-lifetime env override** was introduced; that decision is
  deferred to architecture (Stage 5)/backend (Stage 6) per the Stage 4
  resolution.

## Open Questions & Concerns

- None blocking. No new environment contract changed beyond the added
  dependencies; downstream roles rely on the same `run.sh` entry point and the
  existing `COMPANY_HUB_DB` / `COMPANY_HUB_ADMIN_PASSWORD` overrides.
- Flagged for downstream stages (not blocking): the Sprint 02 migration
  baseline flush under `data/` (scope **n**) is an operator action Stage 6
  performs; verification (Stage 8) must account for it in tests.

## Status

- [x] Complete
- [ ] Needs review