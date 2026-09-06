# Summary: Backend Engineer (Stage 6)

- **Date:** 2026-09-04
- **Author / Executor:** Backend Engineer role (agent)
- **Instruction file:** `instructions/enhancements/06-backend.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 06: implement sprint01 backend enhancements per architecture`

## Work Completed

Extended the existing FastAPI backend per `docs/architecture.md` §8 and the nine
Stage 3 briefs. All v0.1 routes/behavior that is out of scope is preserved
except the sanctioned schema rebuild and dev-data flush (scope item u). The
manual flush (`rm -f data/company_hub.db && rm -rf data/artifacts`) was
performed at the start of the implementation; the app then seeded fresh. The
backend was verified end-to-end against a live `uvicorn` server with a 71-check
smoke suite (see `./tmp/smoke.sh` and `./tmp/server.log`), and dev data was
reset to a pristine 6-company seeded state for downstream stages.

Implemented:

- **Auth (brief 01):** bootstrap `admin@localhost` (fresh `secrets.token_urlsafe`
  password hashed via PBKDF2-HMAC-SHA256, 600k iterations, 16-byte salt,
  overwritten + printed with `flush=True` on every startup); DB-backed cookie
  sessions (`session`, HttpOnly, `Path=/`, `SameSite=Lax`); `POST /api/auth/login`
  (public), `GET /api/auth/me`, `POST /api/auth/logout` (idempotent 204); every
  `/api/` route except login is gated by the `get_current_user` dependency
  returning `401 {"detail":"Not authenticated"}`.
- **Industries (briefs 02/03):** `industries` table; `GET /api/industries`,
  `POST /api/industries`, `PUT /api/industries/{id}` (add/rename only, `409`
  on duplicate).
- **Countries (brief 04):** fixed `countries` table; `GET /api/countries`
  (read-only, sorted by name).
- **Companies (briefs 02/05/09):** `companies` now carries `industry_id`
  (free-form `industry`/`hq_location` removed); payloads expose nested
  `industry {id,name}`, derived `hq_location` (`"<city>, <country_code>"` of the
  Headquarters, never stored), `logo_url`, and a logo-exclusive
  `artifacts_count`; `GET /api/companies` gains the multi-country filter
  (`?countries=GB,FR`, OR semantics, DISTINCT, AND-combined with `?q=`);
  POST/PUT validate `industry_id` (`422`).
- **Locations (brief 04):** `locations` sub-resource CRUD; HQ uniqueness
  (clear `422`, existing HQ left unchanged) plus a partial unique index for
  defense in depth; country codes validated against the standard list; type
  restricted to Headquarters/Office/Plant/Other.
- **References (brief 06):** `"references"` table (quoted — SQLite keyword);
  CRUD; `added_by` from the session user; `added_by`/`created_at` immutable on
  edit.
- **News (brief 07):** `news_articles` table; CRUD; `published_at` validated as
  `YYYY-MM-DD`; UI records default `is_scraped = false`; `PUT` preserves
  `is_scraped` when omitted.
- **Logos (brief 08):** `POST/DELETE /api/companies/{id}/logo`; `image/*`
  content-type gate (`415`); one-logo partial unique index; replace deletes the
  previous row+bytes and inserts the new one in a single transaction;
  logos excluded from the generic Files list and `artifacts_count`, surfaced via
  `logo_url`.
- **Documents (brief 08):** generation uses the new completeness rule
  (name + `industry_id` + the four text fields; locations/logo do not count);
  the PDF presents industry, locations (HQ first), contact fields, and embeds
  the logo when its bytes are embeddable (otherwise skipped — never a failure).
- **Seed (brief 09):** six industries, the curated 83-entry country list (all
  G20 + `JP/KR/GB/CH/FR`, `GB`/"United Kingdom"), and exactly six real companies
  (Toyota/Samsung/HSBC/Novartis/Shell/Carrefour) each with one Headquarters
  location. Seeds only when the `companies` table is empty; the admin user is
  upserted on every startup.

## Outputs Produced / Modified

- Modified: `backend/app.py`, `backend/db.py`, `backend/models.py`,
  `backend/schemas.py`, `backend/routers/companies.py`,
  `backend/routers/artifacts.py`, `backend/routers/documents.py`,
  `backend/data/seed.py`, `backend/services/pdf.py`.
- New: `backend/routers/auth.py`, `backend/routers/industries.py`,
  `backend/routers/reference.py` (countries), `backend/routers/locations.py`,
  `backend/routers/references.py`, `backend/routers/news.py`.

## Key Decisions

- **`references` table is double-quoted in SQL** (`"references"`) because it is
  a SQLite reserved keyword; the table name stays per §8.1.2.
- **Case-insensitive duplicate detection** on industry add/rename (app layer)
  so the controlled vocabulary cannot accumulate case-variant near-duplicates;
  `409` is returned for any existing name regardless of case.
- **Crash-safe logo replacement ordering:** check company → read bytes → write
  new bytes → single DB transaction (delete old logo row + insert new) → delete
  old bytes; on any failure the newly written bytes are removed.
- **Logo content gate is content-type based only** (`image/*`); no magic-byte
  sniffing, per the resolved question. At generation, fpdf2 auto-detects the
  format from bytes; bytes it cannot embed are skipped (`_try_embed_logo`
  swallows errors) so generation never fails because of a logo. Verified: a
  "fake" image upload still yields a `201` generated PDF with zero image
  XObjects.
- **`?countries=` semantics** per resolution: parameter absent → filter
  inactive (full list); present with no valid/unknown codes → active filter
  returning an empty result set.
- **Country list content is backend-authored** (shape/quantity specified,
  content delegated): 83 major economies, sorted by name at read time.
- **Admin password print** uses `flush=True` so the password is visible even
  when stdout is redirected/piped.
- **`auth` dependency is applied at router-mount time** (`include_router(...
  dependencies=[Depends(get_current_user)])`) for every router except `auth`;
  only login is public, `me` and logout are handled individually (logout stays
  idempotent without a session).

## Open Questions & Concerns

- **Frontend contract impact (Stage 7):** company payloads changed shape —
  `industry` is now nested `{id, name}` (was free text), `hq_location` is
  derived (`"<city>, <country_code>"`), `logo_url` is new, and the add/edit form
  must send `industry_id` (not `industry`). Locations are managed only via the
  locations sub-resource; the SPA must render the login view on `401` from any
  `/api` call and re-authenticate after a server restart (fresh admin password
  each startup).
- **Timestamps are second-resolution:** an edit in the same second as creation
  yields equal `created_at`/`updated_at`; downstream tests should not assert
  strict `>` inequality.
- **No automated test/lint tooling** exists in the repo; verification is Stage
  8's remit. The live-server smoke suite (71 checks, all passing) is preserved
  under `./tmp/` (`smoke.sh`, `server.log`, `fresh.log`) as evidence.
- **Seed companies are complete** under the new rule (all six have an industry
  and all text fields), so document generation works out of the box for them.
- The v0.1 DB is intentionally not migrated (scope item u); the app requires the
  fresh schema. `data/` currently holds the pristine freshly-seeded state.

## Status

- [x] Complete
- [ ] Needs review