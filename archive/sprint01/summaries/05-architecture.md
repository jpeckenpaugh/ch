# Summary: Architect (Stage 5)

- **Date:** 2026-09-04
- **Author / Executor:** opencode (Stage 5 role)
- **Instruction file:** `instructions/enhancements/05-architecture.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 05: extend architecture spec for sprint01`

## Work Completed

Read `enhancements/scope.md`, all nine feature briefs
(`features/briefs/01-…-09-…`), the existing v0.1 `docs/architecture.md`, the
environment definition (`requirements.txt`, `environment-notes.md`), and the
v0.1 backend/frontend code. Appended a clearly-marked Sprint 01 enhancement
section (§8) to `docs/architecture.md` specifying the data-model/schema deltas,
API contract changes, file-structure and module-boundary additions, backend/
frontend responsibility changes, component interaction / state-flow changes,
the explicitly unchanged/out-of-scope surface, and open contract notes. All
human-resolved clarifications from the question-check pass were incorporated,
and all six proposed defaults were adopted as approved. The existing v0.1 spec
(§1–§7) was preserved; §8 explicitly supersedes only the "no auth",
completeness, `companies`-schema, and seed statements it replaces.

## Outputs Produced / Modified

- `docs/architecture.md` — modified (existing v0.1 artifact extended): new §8
  "Sprint 01 Enhancements — Architecture Additions" (schema changes incl.
  `users`/`sessions`/`industries`/`countries`/`locations`/`references`/
  `news_articles`; completeness redefinition; real-company seed; full API
  contract deltas for auth, industries, countries, locations, references, news,
  logos, and document generation; manual dev-DB flush procedure).
- `environment-notes.md` — modified (existing Stage 4 artifact extended) with a
  "Sprint 01 — manual dev-data flush" note documenting the reproducible
  `rm -f data/company_hub.db && rm -rf data/artifacts` procedure (scope item u),
  per the human's explicit direction.
- `instructions/enhancements/summaries/05-architecture.md` — new artifact; this
  summary.

## Key Decisions

- **Auth:** `users` + `sessions` tables; PBKDF2-HMAC-SHA256 (600k iterations,
  16-byte salt) hashes; opaque token in an HttpOnly `session` cookie
  (SameSite=Lax, not Secure on localhost http); DB-backed sessions survive
  restart; all `/api/` routes return `401` except `POST /api/auth/login`; the
  SPA renders the login view (static frontend is served without auth).
  Bootstrap admin `admin@localhost` is upserted with a fresh generated password
  on **every** startup, printed to the console.
- **Industries:** `industries` table (name UNIQUE) + nullable
  `companies.industry_id` FK; rename propagates automatically; add/rename only,
  no delete; duplicate names → `409`.
- **Countries:** `countries` table (ISO alpha-2 `code` + English `name`),
  curated ~50–100 entries including the seed countries; no management UI;
  exposed via `GET /api/countries`. Scope's "UK" maps to ISO code `GB`.
- **Locations:** `locations` table with `country_code` FK to `countries.code`
  and a CHECK on the four types; at most one Headquarters (app validation → 422,
  plus a partial unique index); managed via sub-resource CRUD under
  `/api/companies/{id}/locations`; no timestamps.
- **Logos:** stored via the existing artifacts storage with `source='logo'`
  (partial unique index: one logo per company); excluded from the generic Files
  list and `artifacts_count`; surfaced via nullable `logo_url`; image-only
  upload (415 on non-image); embedded in generated PDFs.
- **References / News:** sub-resource CRUD; `references.added_by` stored as an
  email snapshot from the session; `news_articles.is_scraped` false for UI,
  settable by automated workflows; `published_at` date-only.
- **Completeness redefined:** name + `industry_id` + website/contact_email/
  contact_phone/description; locations and logo are not counted.
- **Company payloads:** `hq_location` is derived from the HQ location
  (`"<city>, <code>"`), never stored; profile embeds `locations`, `references`,
  `news`, and non-logo `artifacts`.
- **Country filter:** `?countries=GB,FR` (comma-separated), OR semantics,
  DISTINCT, companies without locations excluded while active; combines with the
  existing `?q=` name search.
- **Manual dev-DB flush** is documented as an operator action (not app startup
  behavior); seeding remains seed-on-empty only.

## Open Questions & Concerns

- **Country list contents:** §8.1.2 requires a curated ~50–100 entry ISO
  alpha-2 list (major economies + G20) including the seed countries; the exact
  entry set is left to Stage 6. Confirm the list breadth when implemented.
- **UK vs GB mapping:** briefs/scope say "UK"; the standard list uses ISO code
  `GB` (name "United Kingdom"). Flagged so Stage 6 (seed) and Stage 7 (UI) keep
  the display consistent.
- **Session lifetime:** no expiry this sprint (sessions persist until logout or
  the DB flush); acceptable for a single-user dev tool. A timeout is a small
  follow-up if wanted later.
- **Logo embedding in PDF:** exact layout (e.g. corner placement, sizing) is a
  Stage 6 implementation detail via fpdf2 image support; generation must not
  fail when no logo is set.
- No other blocking ambiguities remain for Stages 6 and 7.

## Status

- [x] Complete
- [ ] Needs review