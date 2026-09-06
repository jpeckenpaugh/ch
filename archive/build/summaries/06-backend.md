# Summary: Backend Engineer (Stage 6)

- **Date:** 2026-09-01
- **Author / Executor:** Backend Engineer role (agent)
- **Instruction file:** `instructions/build/06-backend.md`
- **Commit:** `stage 06: implement backend per architecture`

## Work Completed

Implemented the complete FastAPI backend under `backend/` exactly per
`docs/architecture.md` (Stage 5) and the Stage 3 feature briefs: the ASGI
application (`backend.app:app`, honoring the `run.sh` entry-point contract), the
SQLite persistence layer with schema init and seed-on-empty, a local-filesystem
object-storage service, a one-page PDF summary service, and every API endpoint
defined in the architecture's contract (companies CRUD + search, artifact
upload/list/download/delete, synchronous document generation). The backend
creates `data/` and `data/artifacts/` at startup, mounts `frontend/` as static
files only when that folder exists (it is Stage 7's artifact), and was verified
end-to-end against a live `uvicorn` server via `./run.sh`.

## Outputs Produced

- `backend/__init__.py`
- `backend/app.py` — FastAPI app assembly, lifespan startup (`init_db`), router
  mounting, conditional `frontend/` static mount
- `backend/db.py` — repo-root-anchored paths, SQLite connection/context manager,
  schema DDL, `init_db()`
- `backend/models.py` — row→JSON mapping; derived `is_complete`, `artifacts_count`,
  artifact `download_url` (excludes `stored_filename` from the API surface)
- `backend/schemas.py` — Pydantic `CompanyIn` (name required + non-blank → `422`)
- `backend/routers/companies.py` — list/search, create, profile, full-replace
  `PUT`, delete (DB cascade + storage cleanup)
- `backend/routers/artifacts.py` — upload (UUID `stored_filename`), list
  (newest-first), content download, delete
- `backend/routers/documents.py` — synchronous generation; `422` failure body
- `backend/services/storage.py` — object storage under
  `data/artifacts/<company_id>/`
- `backend/services/pdf.py` — one-page clean PDF via `fpdf2` (Unicode font if
  available on host, else latin-1-sanitized fallback)
- `backend/data/seed.py` — seed companies (structured data only)

## Key Decisions

- **Verified against a live server** (not just import): every contract status
  code, body shape, download header, and storage/Db-cascade cleanup was
  exercised via `curl` against `./run.sh` (logs in `./tmp/`); `data/` reset to
  a pristine 6-company seeded state afterward.
- **Data path anchored to repo root** (from `backend/__file__`), not the CWD,
  so the app is robust wherever it is launched.
- **`PUT` returns the list-item shape** (no `artifacts` array), consistent with
  `POST`, per human resolution.
- **Generation failure** returns `JSONResponse(status_code=422, content={...})`
  to match the documented body exactly (not FastAPI's default `422` detail
  list).
- **Static mount is conditional**: `frontend/` is mounted only when present, so
  the backend runs/testable standalone before Stage 7; verified `GET /` returns
  `404` with the folder absent.
- **Timestamps** are ISO-8601 UTC with a `Z` suffix; `created_at` set once,
  `updated_at` refreshed on `PUT`.
- **Foreign keys enabled** per connection, so `ON DELETE CASCADE` on artifacts
  works (verified: deleting a company removes its artifact rows and their
  files).

## Backend-Authored Content (flagged per pipeline convention)

- **Seed data** (`backend/data/seed.py`): the architecture specified shape and
  quantity (a small set of realistic firms, structured fields only, no
  artifacts) but not the actual records. Six plausible companies across
  industries/locations were authored by this stage. Downstream roles may treat
  this as sample content.
- **Generated PDF filename** uses the company name (`<name>-summary.pdf`); the
  exact on-disk name is a UUID (`stored_filename`).

## Open Questions & Concerns

- **Static mount timing:** `frontend/` is skipped until Stage 7 lands; once it
  exists the backend mounts it at `/` automatically (no backend change needed).
  The verification stage should confirm serving after Stage 7.
- **Unicode PDF font:** generation uses a host font when found (macOS: Arial
  Unicode; Linux candidates listed in `services/pdf.py`), else sanitizes text to
  latin-1. On hosts with neither, non-latin-1 characters are replaced rather
  than crash.
- **Search scope** remains name-only (`?q=`), per the architecture; flag if
  other fields should be searched.
- **Uploads are fully read into memory** before being written to storage —
  acceptable for the lightweight internal backbone, but a streaming path may be
  needed for large files later.

## Status

- [x] Complete
- [ ] Needs review