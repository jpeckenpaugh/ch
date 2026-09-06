# Summary: Architect (Stage 5)

- **Date:** 2026-09-01
- **Author / Executor:** Architect role (agent)
- **Instruction file:** `instructions/build/05-architecture.md`
- **Commit:** `stage 05: define architecture specification`

## Work Completed

Translated the product requirements into a technical specification in
`docs/architecture.md`: the shape of the code without the code itself. Defined
project/file structure, module boundaries, the SQLite data model and schema,
the complete REST API contract, backend/frontend responsibilities, and
component interaction / state flow. The specification is reference
documentation only; no application code was written.

## Outputs Produced

- `docs/architecture.md` — the technical specification.

## Key Decisions

- **Structure:** Backend as a FastAPI package (`backend/app.py` with routers,
  schemas, services, db), frontend as a static Bootstrap SPA under `frontend/`
  served by FastAPI at `/`, runtime data under `data/` (gitignored). Entry
  point `backend.app:app` preserved exactly for `run.sh`.
- **Data model:** Two tables — `companies` and `artifacts`. Object bytes are
  **not** DB content: the `artifacts` table holds only metadata (owner, original
  name, stored UUID filename, MIME type, size, timestamps, source), and bytes
  live under `data/artifacts/<company_id>/`. Every artifact belongs to exactly
  one company; company deletion cascades rows and removes files.
- **Company field set (human-resolved):** fixed, minimal-but-realistic set —
  `name` (required) plus `industry`, `hq_location`, `website`,
  `contact_email`, `contact_phone`, `description` (optional). Completeness is
  derived (all seven non-empty), exposed as `is_complete` — never stored.
- **Seed data:** on first startup when the `companies` table is empty, insert a
  small set of realistic companies (structured fields only; no artifacts).
- **API:** REST under `/api/` — company list/search, get, create, full-replace
  `PUT`, delete; artifact upload/list/download/delete scoped by `company_id`;
  synchronous document generation endpoint returning success/failure JSON.
  Snake_case JSON, `404` for missing entities, `422` for validation/generation
  failure. No auth in initial scope.
- **PDF generation:** `fpdf2`, one-page clean summary derived from the
  structured fields; generation requires a complete company (else `422` with a
  clear message). Re-generation always allowed and produces a fresh artifact;
  old documents remain available and removable.

## Open Questions & Concerns

- **Update semantics:** I fixed full `PUT` replace (no `PATCH`) to match the
  edit-form UI. Backend should implement `PUT` as a full replace of all
  structured fields; flag if partial updates are ever needed.
- **Generation failure rule:** "complete company required" is an architecture
  decision; the frontend must render the failure message. Confirm acceptable if
  generating for an incomplete company should instead be permitted.
- **Search scope:** list search is defined as case-insensitive substring on
  `name` only; flag if other fields should be searched.
- **PDF layout:** exact one-page layout is a backend implementation detail; no
  branding/template requirement beyond "simple and clean".
- **Static fallback:** SPA served at `/` with HTML fallback to `index.html`;
  client-side routing is expected (no backend page rendering).

## Status

- [x] Complete
- [ ] Needs review
