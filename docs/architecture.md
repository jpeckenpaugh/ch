# Architecture Specification — Company Hub

Stage 5 artifact. Defines the technical shape of the application so that the
Backend (Stage 6) and Frontend (Stage 7) engineers can implement independently
and in parallel. This is reference documentation, not code.

- **Product:** Company Hub (see `concept.md`).
- **Feature briefs:** `features/briefs/01-browse-companies.md` through
  `features/briefs/05-generate-documents-from-profiles.md`.
- **Environment:** `requirements.txt` and `environment-notes.md` (Stage 4).
- **Stack:** FastAPI + SQLite (stdlib `sqlite3`) backend; Bootstrap-based SPA
  frontend served as static files by the backend; local-filesystem object
  storage for files and generated artifacts; `fpdf2` for PDF generation.
- **Entry point contract:** `uvicorn backend.app:app --host 127.0.0.1 --port 8000`
  (`run.sh`). The backend package must be importable as `backend` with the ASGI
  app named `app`. This contract is preserved by every module layout decision
  below.

---

## 1. Project / File Structure

```
.
├── backend/                       # FastAPI application (Stage 6)
│   ├── __init__.py
│   ├── app.py                     # creates FastAPI app, mounts routers + static
│   ├── db.py                      # SQLite connection + schema init + seed
│   ├── models.py                  # row-model helpers / dataclasses
│   ├── schemas.py                 # Pydantic request/response models
│   ├── routers/
│   │   ├── __init__.py
│   │   └── companies.py           # company CRUD + profile payloads
│   │   └── artifacts.py           # artifact upload/list/download/delete
│   │   └── documents.py           # PDF generation
│   ├── services/
│   │   ├── __init__.py
│   │   ├── storage.py             # object storage (file bytes) + path mapping
│   │   └── pdf.py                 # PDF summary generation (fpdf2)
│   └── data/
│       ├── seed.py                # seed content + seed-on-empty logic
│       └── logos/                 # committed raster logo bytes (one per company)
├── frontend/                      # Bootstrap SPA (Stage 7)
│   ├── index.html                 # entry page; mounts the SPA
│   ├── css/style.css              # custom styles over Bootstrap
│   └── js/
│       ├── api.js                 # fetch wrapper for the REST API
│       ├── list.js                # browse/list view + routing
│       ├── profile.js             # profile view + artifact/document actions
│       └── form.js                # add/edit company form
├── data/                          # runtime storage (gitignored, auto-created)
│   ├── company_hub.db             # SQLite database
│   └── artifacts/                 # object storage (files, generated PDFs)
│       └── <company_id>/          # one folder per company
│           └── <stored filename>  # stored bytes, unique per item
├── docs/
│   └── architecture.md            # this file
├── summaries/
│   └── 05-architecture.md         # stage summary
├── requirements.txt               # Stage 4
├── install.sh                     # Stage 4
├── run.sh                         # Stage 4 (backend.app:app contract)
├── environment-notes.md           # Stage 4
└── tmp/                           # scratch/logs (gitignored)
```

### Runtime directory creation

The backend creates runtime directories on startup if absent: `data/` and
`data/artifacts/`. The SQLite file `data/company_hub.db` is created (and the
schema initialized) on first startup. All runtime writes stay under `data/`,
which is gitignored.

---

## 2. Module Boundaries

| Module | Responsibility | Owns |
|--------|----------------|------|
| `backend/app.py` | Wire-up only: build app, mount routers and static frontend, create runtime dirs. No business logic. | app lifecycle |
| `backend/db.py` | Connection, schema DDL, schema initialization, and seed-on-empty. No request logic. | `companies`, `artifacts` tables |
| `backend/schemas.py` | Pydantic models — request/response shapes. | request/response contract |
| `backend/models.py` | Thin row/dataclass helpers mapping DB rows to JSON-friendly values. | row mapping |
| `backend/routers/*` | HTTP routes: parse input, call services/db, return responses. No raw SQL, no file bytes handling. | HTTP surface |
| `backend/services/storage.py` | Object storage: store/retrieve/delete bytes under `data/artifacts/<company_id>/`; metadata passed back. No HTTP. | artifact bytes + paths |
| `backend/services/pdf.py` | Generate the simple clean one-page PDF summary from a company's structured fields. No HTTP, no DB. | PDF bytes |
| `frontend/*` | Bootstrap SPA: list, profile, forms, API calls, artifact/document actions. Consumes only the documented API. | UI |

Backend responsibilities: all API routes, data persistence, schema/seed,
object storage, PDF generation, serving the frontend static files.

Frontend responsibilities: rendering the company list, company profile, add/edit
form, artifact upload/delete UI, document generation action, and surfacing
completeness state. No business data is stored client-side; the SPA is a pure
API client. Routing between views is handled client-side (hash-based or simple
JS show/hide); the backend does not render pages.

---

## 3. Data Model & SQLite Schema

Two tables. Object bytes are **not** stored in the database; the `artifacts`
table stores only the metadata row for a stored object, and the bytes live under
`data/artifacts/<company_id>/`.

### `companies`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `name` | TEXT | `NOT NULL` | required; used for identification |
| `industry` | TEXT | nullable | structured detail |
| `hq_location` | TEXT | nullable | headquarter city / country |
| `website` | TEXT | nullable | company URL |
| `contact_email` | TEXT | nullable | primary contact email |
| `contact_phone` | TEXT | nullable | primary contact phone |
| `description` | TEXT | nullable | free-text summary |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC timestamp |
| `updated_at` | TEXT | `NOT NULL` | ISO-8601 UTC timestamp |

Required fields: `name`. A company is **complete** when `name` is present and
every one of the structured fields (`industry`, `hq_location`, `website`,
`contact_email`, `contact_phone`, `description`) is non-empty. Completeness is
derived, never stored.

### `artifacts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `company_id` | INTEGER | `NOT NULL`, `FOREIGN KEY -> companies.id`, `ON DELETE CASCADE` | owner |
| `original_name` | TEXT | `NOT NULL` | user-visible filename |
| `stored_filename` | TEXT | `NOT NULL` | filesystem name on disk; unique via UUID |
| `content_type` | TEXT | `NOT NULL` | MIME type |
| `size_bytes` | INTEGER | `NOT NULL` | byte size |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC timestamp |
| `source` | TEXT | `NOT NULL` | `upload` or `generated` |

- Every artifact belongs to exactly one company (`company_id`); access control
  is enforced by always querying/listing/scoping through `company_id`.
- `stored_filename` is a server-generated UUID (with original extension), so
  the on-disk name is always unique and never collides across companies or
  re-uploads.
- Deleting a company cascades to its artifact rows; the storage service removes
  the corresponding files under `data/artifacts/<company_id>/`.

### Seed data

On first startup (empty `companies` table), `backend/data/seed.py` inserts the
six real companies plus per-company locations, references, news, and logos (see
§8.1.5). Seed data includes structured fields and committed raster logos copied
into artifact storage — no generated artifacts are seeded.
Seeding happens only when the `companies` table is empty; it never overwrites
user-entered data.

---

## 4. API Contracts

Base path: all routes are served under `/api/`. Frontend static files are
served at `/` by FastAPI's `StaticFiles`.

### Company resources

#### `GET /api/companies`

List all companies. Supports optional search filtering: `?q=<text>` filters by
case-insensitive substring match on `name`.

Response `200` — JSON array, each item:

```json
{
  "id": 1,
  "name": "Acme Corp",
  "industry": "Manufacturing",
  "hq_location": "Berlin, DE",
  "website": "https://acme.example",
  "contact_email": "hello@acme.example",
  "contact_phone": "+49 30 1234 5678",
  "description": "Industrial components.",
  "created_at": "2026-09-01T00:00:00Z",
  "updated_at": "2026-09-01T00:00:00Z",
  "is_complete": true,
  "artifacts_count": 2
}
```

Fields are serialized in snake_case; missing optional fields are `null`.
`is_complete` is derived (see §3). `artifacts_count` is the number of stored
items for the company.

#### `POST /api/companies`

Create a company.

Request body (all optional except `name`):

```json
{
  "name": "Acme Corp",
  "industry": "Manufacturing",
  "hq_location": "Berlin, DE",
  "website": "https://acme.example",
  "contact_email": "hello@acme.example",
  "contact_phone": "+49 30 1234 5678",
  "description": "Industrial components."
}
```

Response `201` — the created company in the same shape as `GET /api/companies`
items (including `id`, timestamps, `is_complete`, `artifacts_count`).

Errors:
- `422` — validation: `name` missing or empty.

#### `GET /api/companies/{id}`

Get one company profile.

Response `200` — company shape above, plus an `artifacts` array:

```json
{
  "id": 1,
  "name": "Acme Corp",
  "industry": "Manufacturing",
  "hq_location": "Berlin, DE",
  "website": "https://acme.example",
  "contact_email": "hello@acme.example",
  "contact_phone": "+49 30 1234 5678",
  "description": "Industrial components.",
  "created_at": "2026-09-01T00:00:00Z",
  "updated_at": "2026-09-01T00:00:00Z",
  "is_complete": true,
  "artifacts_count": 2,
  "artifacts": [
    {
      "id": 3,
      "company_id": 1,
      "original_name": "report.pdf",
      "content_type": "application/pdf",
      "size_bytes": 4096,
      "created_at": "2026-09-01T01:00:00Z",
      "source": "generated",
      "download_url": "/api/artifacts/3/content"
    }
  ]
}
```

Errors:
- `404` — company does not exist.

#### `PUT /api/companies/{id}`

Full update of a company's structured information. Request body has the same
shape as `POST /api/companies` (all fields, including `name`).

Response `200` — the updated company profile shape.
Errors:
- `404` — company does not exist.
- `422` — validation: `name` missing or empty.

Rationale: the SPA always edits the full set of structured fields from the
profile form, so a full replace is simpler and matches the UI. The briefs
require save/cancel and no silent data loss; the form submits the complete
current field set and there is no partial-update path.

#### `DELETE /api/companies/{id}`

Delete a company and its artifacts (DB cascade + storage cleanup).

Response `204` — no body.
Errors:
- `404` — company does not exist.

### Artifact resources

#### `POST /api/companies/{company_id}/artifacts`

Upload a file/artifact and associate it with a company. `multipart/form-data`:
one file part named `file` (the artifact). `python-multipart` (pinned in
`requirements.txt`) is required for this.

Response `201` — the artifact row shape (as in the profile `artifacts` array,
including `source: "upload"` and `download_url`).
Errors:
- `404` — company does not exist.
- `422` — missing file part or empty filename.

#### `GET /api/companies/{company_id}/artifacts`

List a company's stored items. Returns a JSON array of artifact rows (same shape
as the profile `artifacts` array), newest first.
Errors:
- `404` — company does not exist.

#### `GET /api/artifacts/{artifact_id}/content`

Open or download a stored artifact. Streams the stored bytes with
`Content-Disposition: attachment; filename="<original_name>"`.

Response `200` — file bytes (the stored `content_type`).
Errors:
- `404` — artifact does not exist.

#### `DELETE /api/artifacts/{artifact_id}`

Remove a stored artifact (bytes + DB row). Enables the "remove file/artifact"
behavior.
Response `204` — no body.
Errors:
- `404` — artifact does not exist.

### Document generation

#### `POST /api/companies/{company_id}/documents/generate`

Request generation of a derived summary PDF from the company's current
structured information. The endpoint is synchronous (simple, immediate).

Response `201` — a JSON body:

```json
{
  "success": true,
  "message": "Document generated",
  "artifact": { ... artifact row shape, source: "generated" ... }
}
```

On failure (e.g., not enough information to produce a meaningful document),
response `422` with a JSON body:

```json
{
  "success": false,
  "message": "Not enough information to generate a document",
  "artifact": null
}
```

Errors:
- `404` — company does not exist.
- `422` — generation failed due to insufficient data (company not complete).

**Failure rule:** generation requires the company to be **complete** (see §3).
An incomplete company cannot produce a meaningful summary; the frontend
surfaces the failure message to the user. Re-generation is always allowed and
produces a fresh PDF from the current data; each generation creates a new
artifact row, so old documents remain available (and removable).

### Response/error conventions

- JSON, snake_case keys.
- Unknown company/artifact → `404` with a short JSON detail message.
- Validation errors → FastAPI default `422`.
- Success states: `200`/`201`/`204` as noted. There is no auth in the initial
  scope (internal lightweight backbone).

---

## 5. Backend / Frontend Responsibilities

### Backend (Stage 6)

- Implement `backend/app.py` (ASGI app `app`), all routers, schema DDL +
  initialization, and seed-on-empty.
- Persist and query company/artifact metadata via SQLite (stdlib `sqlite3`).
- Own object storage: write/read/delete bytes under
  `data/artifacts/<company_id>/` using `stored_filename` UUIDs.
- Generate PDFs with `fpdf2` (`backend/services/pdf.py`), a single clean,
  one-page summary of the company's structured fields.
- Serve the SPA: mount `frontend/` as `StaticFiles` at `/` (with HTML fallback
  to `index.html`).
- Create `data/` and `data/artifacts/` at startup.

### Frontend (Stage 7)

- Bootstrap-based SPA in `frontend/` (a static bundle served by FastAPI).
- Views: **List** (browse + search + click-through), **Profile** (structured
  details + related content + completeness indicator + actions),
  **Add/Edit form** (save/cancel), **Artifact list/upload/delete**,
  **Generate document** action with success/failure feedback.
- Consumes only the documented API. No data persistence client-side; views are
  refreshed/re-rendered from API responses so the list stays consistent with
  the profile and vice versa.

---

## 6. Component Interactions & State Flow

```
Browser (Bootstrap SPA)
   │  fetch() → /api/...
   ▼
FastAPI routers (companies / artifacts / documents)
   │  ├─→ schemas (validation)
   │  ├─→ services/pdf.py (fpdf2) ──→ bytes → storage
   │  ├─→ services/storage.py ──→ data/artifacts/<company_id>/...
   │  └─→ db.py (sqlite3) ──→ data/company_hub.db
   │
   └─ StaticFiles: / → frontend/index.html + assets
```

**State flow:** The SPA holds no authoritative state; every view change fetches
from the API. Adding/editing a company via the form → `POST`/`PUT` → the list
and profile re-fetch and reflect the change. Uploading/removing an artifact or
generating a document → `POST`/`DELETE` → profile re-fetches and shows the new
set of stored items. Because all reads go through the same API, the list stays
consistent with the company records (Brief 01), and the profile always reflects
current structured info and related content (Brief 02).

**Lifecycle (backend):** startup creates runtime dirs, opens/creates the SQLite
DB, applies schema DDL, and seeds realistic companies when empty. Each request
opens a short-lived DB connection; writes are committed per request.
`updated_at` is refreshed on every company update; `created_at` is set once.
Artifact upload and document generation write bytes to storage first, then
insert the metadata row; on row-insert failure the stored file is removed to
avoid orphans.

---

## 7. Open Design Decisions / Contract Notes (for downstream engineers)

1. **Company field set & completeness (fixed here):** `name` required; the six
   optional fields as in §3. Completeness = all seven fields non-empty, exposed
   as `is_complete`. Brief 03 left the field set to the architecture; this is
   that decision.
2. **Update semantics:** full `PUT` replace only (matches the edit-form UI); no
   `PATCH`. Backend should implement `PUT` as a full replace of all structured
   fields.
3. **PDF format:** one-page, clean summary derived from the structured fields,
   via `fpdf2`. No branding/template requirements. Exact layout is a backend
   implementation detail.
4. **Generation failure rule:** generation is only meaningful for complete
   companies; incomplete → `422` with the JSON body in §4. The frontend must
   render the failure message.
5. **Object storage:** local filesystem under `data/artifacts/<company_id>/`;
   DB holds metadata only. `stored_filename` = UUID + original extension.
6. **Entry point:** honor `backend.app:app` exactly for `run.sh`.
7. **No auth:** out of scope for the initial internal backbone.
8. **IDs/timestamps:** integer autoincrement IDs; ISO-8601 UTC timestamps
   (e.g., `2026-09-01T00:00:00Z`).

---

## 8. Sprint 01 Enhancements — Architecture Additions

This section extends the v0.1 specification above (§1–§7) with the deltas
required by the Sprint 01 scope (`enhancements/scope.md` items a–u; briefs
`features/briefs/01-…-09-…`). It supersedes the earlier "no auth" statements
(§4 "Response/error conventions", §7 item 7), the §3 `companies` schema, the
§3 completeness rule, and the §3 seed definition. Everything else in §1–§7
remains in force and is unchanged by this pass.

### 8.1 Data Model & SQLite Schema Changes

#### 8.1.1 `companies` (modified)

| Column | Change |
|--------|--------|
| `industry` | **Removed.** Replaced by `industry_id` (below). Free-form industry text is no longer stored. |
| `industry_id` | **Added.** INTEGER, nullable, `FOREIGN KEY -> industries(id)`. The controlled industry value; `NULL` = no industry. |
| `hq_location` | **Removed.** The single free-form headquarters field no longer exists; headquarters information now comes from `locations`. |

All other `companies` columns (`id`, `name`, `website`, `contact_email`,
`contact_phone`, `description`, `created_at`, `updated_at`) are unchanged.

#### 8.1.2 New tables

##### `industries`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `name` | TEXT | `NOT NULL UNIQUE` | controlled label; unique so renaming to an existing name is rejected |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC |

- No delete operation exists (scope/brief: add and rename only).
- Renaming an industry = `UPDATE industries SET name = ...`; every company
  referencing it resolves the new label automatically (companies store
  `industry_id`, never the label), so no company is left with a stale name.
- Add and rename reject a name that already exists (`409`, see §8.2.2).

##### `countries`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `code` | TEXT | `NOT NULL UNIQUE` | ISO 3166-1 alpha-2 code (e.g. `GB`, `JP`) |
| `name` | TEXT | `NOT NULL UNIQUE` | English country name |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC |

- Fixed, seeded standard list; **no runtime country-management UI** this sprint
  (unlike industries).
- Content: a curated ~50–100 entry list of major economies (including all G20
  members) plus the seed countries, each with an ISO alpha-2 `code` and an
  English `name`, sorted by name. The exact entry set is a Stage 6 seed detail;
  it **must include** `JP`, `KR`, `GB`, `CH`, `FR` (the seed companies'
  countries).
- **Note on "UK":** the scope/briefs refer to the United Kingdom as "UK". Its
  ISO 3166-1 alpha-2 code is `GB`; the standard list therefore stores
  `code = "GB"`, `name = "United Kingdom"`. Seed/UI references to "UK" map to
  this record.

##### `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `email` | TEXT | `NOT NULL UNIQUE` | login identity; the only user is `admin@localhost` |
| `password_hash` | TEXT | `NOT NULL` | PBKDF2-HMAC-SHA256 hash string (see §8.2.1) |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC |

##### `sessions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `token` | TEXT | `NOT NULL UNIQUE` | opaque random token; the cookie value |
| `user_id` | INTEGER | `NOT NULL`, `FOREIGN KEY -> users.id`, `ON DELETE CASCADE` | owner |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC |

- DB-backed sessions survive a server restart; a session ends on logout or when
  its row is removed. No expiry this sprint.
- The bootstrap admin is **not** seed-on-empty: on **every** startup the app
  generates a fresh complex password (`secrets.token_urlsafe`), overwrites the
  stored hash for `admin@localhost`, and prints the current password to the
  console (scope item b). Any previously displayed password becomes invalid
  after a restart.

##### `locations`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `company_id` | INTEGER | `NOT NULL`, `FOREIGN KEY -> companies.id`, `ON DELETE CASCADE` | owner |
| `label` | TEXT | `NOT NULL` | e.g. "Global HQ" |
| `address` | TEXT | nullable | optional address/region |
| `city` | TEXT | `NOT NULL` | |
| `country_code` | TEXT | `NOT NULL`, `FOREIGN KEY -> countries.code` | from the standard list |
| `type` | TEXT | `NOT NULL`, `CHECK (type IN ('Headquarters','Office','Plant','Other'))` | exactly one of the four |

- A company has zero or more locations; the free-form `companies.hq_location`
  is replaced entirely.
- **At most one Headquarters per company**, enforced by application-level
  validation returning a clear `422` (the existing Headquarters is left
  unchanged — no auto-demotion) and, for defense in depth, a partial unique
  index: `CREATE UNIQUE INDEX idx_locations_one_hq ON locations(company_id)
  WHERE type = 'Headquarters'`.
- A company may end up with zero locations; removing an HQ is allowed.
- No timestamps: locations are ordered by `id` for display.

##### `references`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `company_id` | INTEGER | `NOT NULL`, `FOREIGN KEY -> companies.id`, `ON DELETE CASCADE` | owner |
| `title` | TEXT | `NOT NULL` | |
| `url` | TEXT | `NOT NULL` | openable link |
| `description` | TEXT | nullable | |
| `added_by` | TEXT | `NOT NULL` | email snapshot of the signed-in user who added it |
| `created_at` | TEXT | `NOT NULL` | immutable once set |
| `updated_at` | TEXT | `NOT NULL` | refreshed on edit |

- `added_by` and `created_at` are immutable; edits update only `title`, `url`,
  `description`, and `updated_at`.
- Every reference belongs to exactly one company and is shown only there.

##### `news_articles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `company_id` | INTEGER | `NOT NULL`, `FOREIGN KEY -> companies.id`, `ON DELETE CASCADE` | owner |
| `title` | TEXT | `NOT NULL` | |
| `source` | TEXT | `NOT NULL` | |
| `url` | TEXT | `NOT NULL` | openable link |
| `published_at` | TEXT | `NOT NULL` | publication date, date-only `YYYY-MM-DD` |
| `summary` | TEXT | nullable | summary/snippet |
| `is_scraped` | INTEGER | `NOT NULL DEFAULT 0` | `0`/`1`; `true` only for records written by automated workflows |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC |
| `updated_at` | TEXT | `NOT NULL` | refreshed on edit |

- UI-created records always have `is_scraped = false`; the API accepts the flag
  so automated workflows can set `true` later (scope item n).

#### 8.1.3 `artifacts` (modified)

- `source` now accepts three values: `upload` and `generated` (v0.1) plus
  `logo` (new). Logos are stored objects like any other artifact: bytes under
  `data/artifacts/<company_id>/`, a metadata row in `artifacts`, and a
  `download_url` via the existing content endpoint.
- At most one logo per company, enforced by a partial unique index:
  `CREATE UNIQUE INDEX idx_artifacts_one_logo ON artifacts(company_id)
  WHERE source = 'logo'`. Replacing a logo deletes the previous `logo` row (and
  its bytes) then inserts the new one within a single transaction.
- The generic "Files & artifacts" list (`GET /api/companies/{id}` `artifacts`
  array, `GET /api/companies/{company_id}/artifacts`, and `artifacts_count`)
  **excludes** `source = 'logo'` rows; the logo is surfaced separately via
  `logo_url` on company payloads.

#### 8.1.4 Completeness (redefined)

A company is **complete** when `name` is present and non-empty, `industry_id`
is not null, and every one of `website`, `contact_email`, `contact_phone`,
`description` is non-empty. **Locations are not counted** (zero-location
companies are legitimate) and **a logo is not counted** (scope item p).
Completeness remains derived, never stored.

#### 8.1.5 Seed data (redefined)

On a fresh/empty database the app seeds:

- The six standard industries: Manufacturing, Technology, Finance, Healthcare,
  Energy, Retail (the complete seeded list; only the industry-management UI
  extends it).
- The standard country list (§8.1.2).
- Exactly six companies, each with `name`, `industry_id`, `website`,
  `contact_email`, `contact_phone`, `description`, and exactly one Headquarters
  location (label, city, `country_code` from the list, type `Headquarters`):

  | Company | Industry | HQ city | Country |
  |---------|----------|---------|---------|
  | Toyota Motor | Manufacturing | Toyota City | JP |
  | Samsung Electronics | Technology | Seoul | KR |
  | HSBC | Finance | London | GB |
  | Novartis | Healthcare | Basel | CH |
  | Shell | Energy | London | GB |
  | Carrefour | Retail | Paris | FR |

  (Shell's HQ is London, UK → `GB`, per the §8.1.2 note.)

- Real supporting content per company, keyed by name in `seed.py`:
  - One or two further real locations (Office/Plant; deliberately no GB/FR
    offices on non-GB/FR companies so the country filter stays stable).
  - Two references each: a Wikipedia article and an official
    about/company-profile page, with `added_by = admin@localhost`.
  - Three to five genuine recent news articles with `is_scraped = 0`
    (hand-authored, not scraped).
  - One logo each: raster PNG bytes committed under `backend/data/logos/` and
    copied into artifact storage at seed time as an artifacts row with
    `source = 'logo'` (so the seeded logos render in the UI and embed in
    generated PDFs).
- Seeding happens only when the `companies` table is empty; it never overwrites
  user-entered data. The bootstrap admin user is the one exception to
  seed-on-empty: it is upserted with a fresh password on **every** startup
  (§8.1.2 `users`).

**Manual dev-data flush (Sprint 01).** This sprint changes the schema
(`companies` loses `industry` and `hq_location`; new tables are added), and the
v0.1 SQLite database is **not** migrated. Per scope item u, the operator flushes
the gitignored dev runtime state **once** before the first run of the new build
(performed by Stage 6), then the app seeds from scratch:

```
rm -f data/company_hub.db && rm -rf data/artifacts
```

A later pass enriched the seed with references, news, locations, and logos; any
database seeded before that pass must be flushed the same way to pick up the new
seed content (seeding never runs on a non-empty `companies` table). `./flush.sh`
wraps the flush.

The app never deletes data on a normal restart and seeds only when empty.

---

### 8.2 API Contract Changes

Base path and static-file serving are unchanged (§4). **All `/api/` routes now
require an authenticated session** (scope item a) except `POST /api/auth/login`.
An unauthenticated request to any other `/api/` route returns `401`
`{"detail": "Not authenticated"}`. The frontend is served without auth; the SPA
itself renders the login view when unauthenticated (§8.5, §8.6).

#### 8.2.1 Authentication

- **Credential storage:** `users.password_hash` holds
  `pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>` using
  `hashlib.pbkdf2_hmac("sha256", ...)`, a 16-byte random salt, and 600,000
  iterations.
- **Session cookie:** on successful login the backend creates a `sessions` row
  with an opaque `secrets.token_urlsafe` token and sets an HttpOnly cookie
  `session=<token>` (`Path=/`, `SameSite=Lax`; not `Secure`, because the dev
  server is plain http on localhost). Sessions are DB-backed and survive
  restarts.
- **Auth dependency:** every protected route reads the `session` cookie, looks
  up the session row and its user, and returns `401` when absent/invalid.

##### `POST /api/auth/login`

Public. Request body:

```json
{ "email": "admin@localhost", "password": "<printed at startup>" }
```

- `200` — on success: `{ "id": 1, "email": "admin@localhost" }`; sets the
  `session` cookie.
- `401` — unknown email or wrong password: `{ "detail": "Invalid email or password" }`.

##### `GET /api/auth/me`

- `200` — current session user: `{ "id": 1, "email": "admin@localhost" }`.
- `401` — no valid session.

##### `POST /api/auth/logout`

- `204` — deletes the session row and clears the cookie. Idempotent: a missing
  session still returns `204`.

#### 8.2.2 Reference data

##### `GET /api/industries`

- `200` — array of `{ "id": 1, "name": "Manufacturing" }`, sorted by name. Used
  by the company add/edit form and the industry-management view.

##### `POST /api/industries`

Request: `{ "name": "Aerospace" }` (required, non-empty).
- `201` — `{ "id": 7, "name": "Aerospace" }`.
- `422` — empty/blank name.
- `409` — name already exists: `{ "detail": "Industry already exists" }`.

##### `PUT /api/industries/{id}`

Rename. Request: `{ "name": "Aerospace & Defense" }`.
- `200` — `{ "id": 7, "name": "Aerospace & Defense" }`. Companies using this
  industry resolve the new label automatically (they store `industry_id`).
- `404` — industry does not exist.
- `409` — the new name is already used by another industry.
- No `DELETE` exists (out of scope).

##### `GET /api/countries`

- `200` — array of `{ "code": "GB", "name": "United Kingdom" }`, sorted by name.
  Used by the location editor and the list country filter.

#### 8.2.3 Companies (modified)

Company payload shape (list items and profile):

```json
{
  "id": 1,
  "name": "Toyota Motor",
  "industry": { "id": 1, "name": "Manufacturing" },
  "hq_location": "Toyota City, JP",
  "website": "https://...",
  "contact_email": "...",
  "contact_phone": "...",
  "description": "...",
  "created_at": "2026-09-04T00:00:00Z",
  "updated_at": "2026-09-04T00:00:00Z",
  "is_complete": true,
  "artifacts_count": 0,
  "logo_url": null
}
```

- `industry`: nested `{ id, name }`, or `null` when unset. Renames propagate
  automatically (the label is resolved at read time).
- `hq_location`: **derived**, never stored — `"<city>, <country_code>"` of the
  company's Headquarters location, or `null` when it has none. Replaces the
  v0.1 free-form `hq_location` field in all payloads.
- `logo_url`: URL of the logo object (`/api/artifacts/<id>/content`), or `null`
  when none. Listed to enable logo display in the list/profile.
- `artifacts_count`: counts non-logo artifacts only (`upload` + `generated`).

##### `GET /api/companies`

List, now with optional multi-country filtering in addition to the existing
name search:

- `?q=<text>` — unchanged (§4): case-insensitive name substring match.
- `?countries=GB,FR` — comma-separated ISO alpha-2 codes. **OR** semantics: the
  company is included when **any** of its locations has a `country_code` in the
  selected set; each company appears once (DISTINCT). Companies with no
  locations are excluded whenever this filter is active.
- Both filters combine with AND (`?q=shell&countries=GB,FR`).
- Unknown/empty codes in `countries` simply match nothing.
- Response `200` — array of company list items (shape above, no `locations`
  array). Ordered by `id` ascending as before.

##### `POST /api/companies` and `PUT /api/companies/{id}`

Request body (all optional except `name`):

```json
{
  "name": "Acme Corp",
  "industry_id": 1,
  "website": "https://acme.example",
  "contact_email": "hello@acme.example",
  "contact_phone": "+49 30 1234 5678",
  "description": "Industrial components."
}
```

- `industry_id`: optional integer; must reference an existing industry (`422`
  otherwise). `null`/absent = no industry.
- **Locations are not part of these payloads.** They are managed exclusively
  through the locations sub-resource (§8.2.4). `PUT` remains a full replace of
  the structured fields above only.
- Responses `201` / `200` with the company shape. Errors: `404` (PUT of an
  unknown company), `422` (`name` missing/empty, unknown `industry_id`).

##### `GET /api/companies/{id}`

Profile. Returns the company shape plus:

```json
{
  "...company fields (incl. logo_url)...",
  "locations": [
    { "id": 1, "company_id": 1, "label": "Global HQ", "address": "1 Motomachi",
      "city": "Toyota City", "country_code": "JP", "country_name": "Japan", "type": "Headquarters" }
  ],
  "references": [
    { "id": 1, "company_id": 1, "title": "...", "url": "https://...",
      "description": "...", "added_by": "admin@localhost",
      "created_at": "...", "updated_at": "..." }
  ],
  "news": [
    { "id": 1, "company_id": 1, "title": "...", "source": "...", "url": "https://...",
      "published_at": "2026-08-01", "summary": "...", "is_scraped": false,
      "created_at": "...", "updated_at": "..." }
  ],
  "artifacts": [ "...non-logo artifact rows (§4), source 'upload' or 'generated'..." ]
}
```

- `locations` ordered by `id` ascending; `references` and `news` ordered by
  `id` descending (newest first); `artifacts` as in §4 except logos are
  excluded.
- Errors: `404` — company does not exist.

##### `DELETE /api/companies/{id}`

Unchanged (§4): deletes the company and cascades to its locations, references,
news, and artifact rows; the storage service removes the company's
`data/artifacts/<company_id>/` directory (including any logo bytes).

#### 8.2.4 Locations sub-resource

##### `POST /api/companies/{company_id}/locations`

Request:

```json
{ "label": "Global HQ", "address": "1 Main St", "city": "London", "country_code": "GB", "type": "Headquarters" }
```

(`address` optional; `label`, `city`, `country_code`, `type` required.)

- `201` — location payload (see §8.2.3 shape, with `country_name`).
- `404` — company does not exist.
- `422` — missing/empty required field; unknown `country_code`; invalid `type`;
  or adding a second Headquarters (the existing Headquarters is left unchanged).

##### `PUT /api/companies/{company_id}/locations/{location_id}`

Full replace of `label`, `address`, `city`, `country_code`, `type`.
- `200` — updated location payload.
- `404` — company or location not found (a location never belongs to a company
  other than the path's `company_id`).
- `422` — same validation as `POST`, including "second Headquarters" if this
  edit would make it a Headquarters while another location already is one.

##### `DELETE /api/companies/{company_id}/locations/{location_id}`

- `204` — removed (removing the Headquarters is allowed; the company may end up
  with zero locations).
- `404` — company or location not found.

#### 8.2.5 References sub-resource

##### `POST /api/companies/{company_id}/references`

Request: `{ "title": "...", "url": "https://...", "description": "..." }`
(`title` and `url` required; `description` optional). `added_by` is set from
the signed-in session user's email; `created_at`/`updated_at` are set
server-side.

- `201` — reference payload (§8.2.3 shape).
- `404` — company does not exist.
- `422` — missing/empty `title` or `url`.

##### `PUT /api/companies/{company_id}/references/{reference_id}`

Request: `{ "title", "url", "description" }` (full replace of editable fields).
Preserves `added_by` and `created_at`; refreshes `updated_at`.
- `200` — updated reference payload.
- `404` — company or reference not found.

##### `DELETE /api/companies/{company_id}/references/{reference_id}`

- `204` — removed.
- `404` — company or reference not found.

#### 8.2.6 News sub-resource

##### `POST /api/companies/{company_id}/news`

Request:

```json
{
  "title": "...", "source": "...", "url": "https://...",
  "published_at": "2026-08-01", "summary": "...", "is_scraped": false
}
```

(`title`, `source`, `url`, `published_at` required; `summary` optional;
`is_scraped` optional, defaults `false` — the UI never sets it, automated
workflows may set `true`.)

- `201` — news payload (§8.2.3 shape).
- `404` — company does not exist.
- `422` — missing/empty required field or malformed `published_at`.

##### `PUT /api/companies/{company_id}/news/{news_id}`

Request: same fields as `POST`; `is_scraped` optional — when omitted, the
current value is preserved.
- `200` — updated news payload (`updated_at` refreshed; `created_at` and
  `is_scraped` semantics preserved per brief).
- `404` — company or news record not found.
- `422` — invalid fields.

##### `DELETE /api/companies/{company_id}/news/{news_id}`

- `204` — removed.
- `404` — company or news record not found.

#### 8.2.7 Logos

##### `POST /api/companies/{company_id}/logo`

`multipart/form-data`, one file part named `file` (same upload mechanism as the
§4 artifact upload).
- Replaces any existing logo: the previous `source = 'logo'` artifact row and
  its bytes are deleted, then the new bytes are stored and a new logo row is
  inserted (single transaction).
- `201` — the logo artifact row (§4 artifact-row shape, `source: "logo"`,
  `download_url`). The company's `logo_url` points here.
- `404` — company does not exist.
- `415` — uploaded content-type is not an image (`image/*`):
  `{ "detail": "Logo must be an image" }`.
- `422` — missing file part or empty filename.

##### `DELETE /api/companies/{company_id}/logo`

- `204` — logo removed (row + bytes).
- `404` — no logo is set for the company.

##### Generic artifact endpoints

`GET /api/companies/{company_id}/artifacts`, `GET /api/artifacts/{id}/content`,
and `DELETE /api/artifacts/{id}` are unchanged (§4) except that the list
endpoint excludes `source = 'logo'` rows. The generic `DELETE` on a logo row is
equivalent to removing the logo.

#### 8.2.8 Document generation (modified)

`POST /api/companies/{company_id}/documents/generate` — unchanged contract
(synchronous, `201`/`422`, response body shape per §4), with these content
changes:

- **Completeness gate:** uses the new completeness rule (§8.1.4).
- **Content:** the summary now presents `name`, `industry` (label), locations
  (Headquarters first, then the rest, e.g. "Global HQ — Toyota City, JP"),
  `website`, `contact_email`, `contact_phone`, `description` — replacing the
  removed free-form `hq_location`.
- **Logo:** when the company has a logo, its bytes are embedded in the PDF
  (fpdf2 image). A missing logo is simply omitted; generation must not fail on
  its absence.

---

### 8.3 Project / File Structure Additions

New/changed files beyond the §1 tree:

```
backend/
├── routers/
│   ├── auth.py            # login / logout / me + session dependency (new)
│   ├── industries.py      # industry list/add/rename (new)
│   ├── reference.py       # GET /api/countries (new)
│   ├── locations.py       # locations sub-resource CRUD (new)
│   ├── references.py      # references sub-resource CRUD (new)
│   ├── news.py            # news sub-resource CRUD (new)
│   └── artifacts.py       # extended: POST/DELETE /api/companies/{id}/logo
├── db.py                  # extended schema (new tables), seed calls
├── schemas.py             # new Pydantic request models
├── models.py              # new row→dict helpers, new completeness rule
├── data/seed.py           # redefined seed (real companies + industries + countries)
└── services/pdf.py        # updated summary fields + logo embedding
frontend/
├── js/
│   ├── login.js           # login view + session gate (new)
│   ├── industries.js      # industry-management view (new)
│   ├── api.js             # extended endpoints (extended)
│   ├── app.js             # auth bootstrapping, logout, nav (extended)
│   ├── list.js            # country filter, logo thumbnails (extended)
│   ├── profile.js         # locations, references, news, logo sections (extended)
│   └── form.js            # industry dropdown, locations editor (extended)
└── index.html             # nav: Industries, logout (extended)
```

### 8.4 Module Boundary Changes

| Module | Change |
|--------|--------|
| `backend/routers/auth.py` | Owns login/logout/me and the `get_current_user` dependency. No business data. |
| `backend/routers/industries.py` | Owns industry list/add/rename (no delete) over the `industries` table. |
| `backend/routers/reference.py` | Owns the countries reference list (read-only). |
| `backend/routers/locations.py` | Owns location CRUD incl. HQ-uniqueness validation. |
| `backend/routers/references.py`, `news.py` | Own their sub-resource CRUD; `added_by` comes from the session. |
| `backend/routers/artifacts.py` | Adds the logo upload/replace/remove endpoints (reuses storage). |
| `backend/services/pdf.py` | Reads the locations/logos it is given; still no HTTP/DB. |
| `backend/data/seed.py` | Seeds industries + countries + six real companies with one HQ each, plus per-company locations, references, news, and logos. |
| `frontend/*` | Adds login gate, industry management, locations editor, references/news sections, logo UI, country filter. |

Ownership rules from §2 (routers do no raw SQL/file-bytes handling; storage owns
bytes; schemas own the contract) are unchanged.

### 8.5 Backend / Frontend Responsibility Changes

**Backend (new):** implement authentication (bootstrap admin, PBKDF2 hashing,
DB-backed session cookie, 401-gating every `/api/` route except login);
industries and countries reference data; locations, references, and news
sub-resource CRUD; logo upload/replace/remove via the existing storage; the
redefined seed; the redefined completeness rule; and the updated PDF generation
(new fields + logo).

**Frontend (new):** on load call `GET /api/auth/me`; when `401`, render the
login view and gate all other views behind an authenticated session. Treat a
`401` from any API call as a return to the login view. Add a logout action. Add:
an industry-management view (add/rename); an industry dropdown (not free-text)
and a locations editor in the add/edit form; a multi-select country filter on
the list; locations/references/news sections with add/edit/remove on the
profile; and logo upload/replace/remove controls plus logo display on the list
and profile. Replace all free-form `hq_location` display with the derived
`hq_location` / locations data. The SPA remains a pure API client with no
authoritative client-side state.

### 8.6 Component Interactions & State Flow

```
Browser (SPA)
   │  boot → GET /api/auth/me
   │    401 ────────────────► login view
   │    200 ─► main views (all data via authenticated /api calls)
   │  any /api call → 401  ─► return to login view
   ▼
FastAPI routers (auth / industries / reference / locations / references / news
                / artifacts(+logo) / companies / documents)
   │  ├─ auth dependency: session cookie → sessions → users (else 401)
   │  ├─ services/pdf.py (fpdf2) ──► bytes (+ logo bytes when set) → storage
   │  ├─ services/storage.py ──► data/artifacts/<company_id>/...
   │  └─ db.py (sqlite3) ──► data/company_hub.db
```

**State flow additions:** The SPA holds no session state itself; on boot it asks
`/api/auth/me` and renders the login view or the app accordingly. Editing a
company's industry or a location's country re-fetches the list/profile, which
resolve the controlled labels (`industry.name`, `country_name`) at read time — a
rename in the industry-management view is reflected everywhere on the next
fetch. The country filter re-issues `GET /api/companies?countries=...`; clearing
it restores the full list. The add/edit form manages locations through the
locations sub-resource; profile edits to references/news/logos hit their
sub-resources and re-fetch the profile. Generation embeds the current logo
bytes; regenerating after a logo change reflects the new logo.

### 8.7 Explicitly Unchanged / Out of Scope

- v0.1 browse/search-by-name, profile view, artifact upload/list/download/delete
  (non-logo), and the document-generation flow (except the content/completeness/
  logo changes above) are unchanged.
- No signup, roles/permissions, password reset, or multi-user administration
  (scope item c). `admin@localhost` is the only user.
- No country-management UI (fixed list only). No industry delete (add/rename only).
- No scraping of news, references, or logos (items n, q).
- No JWT/OAuth/external auth; cookie sessions only.
- Entry point `backend.app:app`, `run.sh`, Python version, dependency set, and
  the `data/` storage layout are unchanged (Stage 4: no environment changes).
- The completeness rule and seed definition are intentionally changed per
  §8.1.4/§8.1.5 (items s, t, u) — in-scope, not regressions.

### 8.8 Open Design Decisions / Contract Notes (Sprint 01)

1. **UK vs GB:** scope/briefs say "UK"; the standard list uses the ISO code
   `GB` (name "United Kingdom"). All references to the seed country map to `GB`.
2. **Admin password regeneration:** a fresh complex password is generated,
   hashed, and printed on **every** startup; previously displayed passwords
   become invalid after a restart.
3. **Session lifetime:** sessions have no expiry this sprint and survive
   restarts; they end on logout (or the DB flush).
4. **Logo exclusivity:** the generic Files/artifacts list and `artifacts_count`
   exclude `source = 'logo'` rows; logos are surfaced via `logo_url`.
5. **Country filter:** comma-separated `?countries=` codes, OR semantics,
   DISTINCT results, companies with no locations excluded while active.
6. **Company payloads:** `hq_location` is now derived from the Headquarters
   location and is never stored; locations live only in the `locations` table.
7. **Manual dev-DB flush** (scope item u) is a documented operator action, not
   app startup behavior (§8.1.5).

---

## 9. Sprint 02 Enhancements — Architecture Additions

This section extends the specification above (§1–§8) with the deltas required
by the Sprint 02 scope (`enhancements/scope.md` items a–o; briefs
`features/briefs/01-…-06-…`). It **supersedes** the hand-rolled authentication
specified in §8 (the `sessions` table and its login/logout/me plumbing) with the
maintained `fastapi-users` library, and moves persistence from the Sprint 01
hand-managed SQL / stdlib `sqlite3` layer to async SQLAlchemy with versioned
Alembic migrations. Everything in §1–§8 not explicitly superseded or modified
here remains in force and is unchanged by this pass.

**Stack (authoritative):** SQLAlchemy 2.0 (async, via `aiosqlite`),
Alembic migrations, and fastapi-users with the **stock stateful
`DatabaseStrategy`** + `CookieTransport` on Python 3.12. The `DatabaseStrategy`
is stateful, not the stateless `JWTStrategy`: session tokens are persisted in an
`access_tokens` database table keyed to the user, enforce a lifetime via
`lifetime_seconds`, and logout deletes the token row — satisfying scope item **h**
(server-side stored sessions, expiry, and immediate server-side revocation)
without a custom session store.

### 9.1 Data Model & Schema Changes

All changes below are captured as versioned Alembic migrations. Per scope item
**n**, the existing dev database under `data/` is **not** migrated; it is flushed
once by Stage 6 to establish the migration baseline, after which schema changes
are applied only as migrations (scope **b**). Repo-tracked content is not
deleted or regressed.

#### 9.1.1 `users` (modified)

The Sprint 01 `users` table becomes the fastapi-users User model, keyed by an
**integer** `id` (`IntegerPK`, not fastapi-users' default UUID), consistent with
the rest of the app's integer PKs.

| Column | Change |
|--------|--------|
| `id` | INTEGER `PRIMARY KEY AUTOINCREMENT` — unchanged, now the fastapi-users integer PK. |
| `email` | TEXT `NOT NULL UNIQUE` — unchanged; email is normalized to lowercase by fastapi-users (sign-in is case-insensitive). |
| `password_hash` | **Changed.** Now holds a `pwdlib`-generated hash (argon2/bcrypt) produced by fastapi-users, replacing the hand-rolled PBKDF2 string of §8.2.1. Column type stays TEXT `NOT NULL`. |
| `is_active` | **Added.** INTEGER `NOT NULL DEFAULT 1` (bool). Controls whether the account can authenticate. |
| `is_superuser` | **Added.** INTEGER `NOT NULL DEFAULT 0` (bool). The superuser flag authorizes account creation / admin functions (scope item **j**). |
| `is_verified` | **Added.** INTEGER `NOT NULL DEFAULT 0` (bool). No email-verification flow exists this sprint; the bootstrap admin and admin-created accounts are created with `is_verified = 1`. |
| `created_at` | TEXT `NOT NULL` — unchanged (fastapi-users keeps it; it is not exposed in the `me` payload). |

- The bootstrap admin (`admin@localhost`) is created **idempotently** on
  startup — only when it does not already exist. Its password comes from
  `COMPANY_HUB_ADMIN_PASSWORD` if set, else a fresh complex password is
  generated and printed once at creation. Thereafter the credential persists in
  the database and is **not** re-randomized on later restarts (supersedes the
  §8.1.2 per-startup regeneration). It is created with `is_superuser = 1`,
  `is_verified = 1`, `is_active = 1`.

#### 9.1.2 `access_tokens` (new) — replaces `sessions`

FastAPI-users' stateful `DatabaseStrategy` persists each session token in an
`access_tokens` table. This **replaces** the Sprint 01 `sessions` table, which is
dropped.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `token` | TEXT | `NOT NULL UNIQUE` | the server-side session token; the value referenced by the `session` cookie. |
| `user_id` | INTEGER | `NOT NULL`, `FOREIGN KEY -> users.id`, `ON DELETE CASCADE` | owner |
| `created_at` | TEXT | `NOT NULL` | ISO-8601 UTC |
| `lifetime_seconds` | INTEGER | nullable | the session's remaining lifetime; when `NULL` the token does not expire. |

- A session token is **persisted** (server-side) and keyed to its user; both
  expiry (via `lifetime_seconds`) and revocation (deleting the row) are enforced
  server-side.
- **Sign-out** (`POST /api/auth/logout`) deletes the token row immediately —
  server-side revocation that takes effect at once (scope **h**).
- **Expiry:** a token older than its `lifetime_seconds` is treated as invalid;
  the user is unauthenticated and must sign in again.
- **Lifetime policy (fixed):** a **fixed absolute lifetime** (not sliding), so a
  session is valid for exactly its configured duration and then expires. Default
  is **7 days**. The duration is configurable via the environment variable
  `COMPANY_HUB_SESSION_TTL` (integer seconds); the cookie `Max-Age` matches it.
  On expiry the user is returned to the login screen and must sign in again.

#### 9.1.3 `oauth_accounts` (new) — schema-only (scope item **k**)

The account model gains the capacity to link a user to an external identity
provider. **Schema only this sprint** — no OAuth login routes, provider screens,
or SSO flows are added.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` | stable identifier |
| `user_id` | INTEGER | `NOT NULL`, `FOREIGN KEY -> users.id`, `ON DELETE CASCADE` | the linked local account |
| `oauth_name` | TEXT | `NOT NULL` | provider name, e.g. `google`. |
| `access_token` | TEXT | nullable | provider access token (reserved for future SSO use). |
| `refresh_token` | TEXT | nullable | provider refresh token (reserved). |
| `expires_at` | INTEGER | nullable | provider token expiry (epoch seconds, reserved). |
| `account_id` | TEXT | `NOT NULL` | the provider's identifier for the account (e.g. Google `sub`). |
| `account_email` | TEXT | nullable | email known to the provider. |

- Uniqueness: a user may have **at most one link per provider** —
  `UNIQUE(user_id, oauth_name)`; and an external identity maps to at most one
  local account — `UNIQUE(oauth_name, account_id)`.
- The columns beyond the link identity (`oauth_name`, `account_id`) are the
  standard fastapi-users OAuth account shape, so a future Google-SSO sprint can
  consume them without a data-model change (scope item **k**).
- No rows are created this sprint; regular email/password accounts (§9.1.1) are
  unaffected.

#### 9.1.4 Unchanged data model

The non-auth data model from Sprint 01 is preserved exactly (scope **c**):
`companies`, `industries`, `countries`, `locations`, `references`,
`news_articles`, and `artifacts` (including the `logo` source and the derived
completeness rule of §8.1.4) are unchanged. `references.added_by` continues to
record the signed-in user's email at creation — now sourced from the
fastapi-users current user. Seed content and seeding rules are unchanged
(scope **e**).

### 9.2 API Contract Changes

Base path and static-file serving are unchanged (§4). **All `/api/` routes
remain gated by an authenticated session** (unchanged from §8.2), but the gate
is now enforced by fastapi-users' `current_user` dependency backed by the
`DatabaseStrategy`/`CookieTransport` (reads the `session` cookie → `access_tokens`
→ `users`). An unauthenticated request to any protected `/api/` route returns
`401 {"detail": "Not authenticated"}`. The login screen for unauthenticated
users and the gated SPA are unchanged.

The Sprint 01 hand-rolled auth contract (§8.2.1) is **superseded** by the
fastapi-users routes below. The cookie name `session` is preserved (Sprint 01
continuity), configured on `CookieTransport`:
`cookie_name="session"`, `cookie_httponly=True`, `cookie_samesite="lax"`,
`cookie_secure=False` (dev is plain http on localhost), `cookie_path="/"`,
`cookie_max_age` = the session lifetime (default 7 days).

#### 9.2.1 Authentication (`/api/auth`)

fastapi-users routers are mounted under the `/api/auth` prefix.

##### `POST /api/auth/login`

Public. Request body (fastapi-users login form / JSON):

```json
{ "email": "admin@localhost", "password": "<admin password>" }
```

- `200` — on success: `{ "access_token": "<token>", "token_type": "bearer" }`
  and the `session` cookie is set. A new `access_tokens` row is created and
  persisted server-side.
- `400` — invalid credentials: `{ "detail": "LOGIN_BAD_CREDENTIALS" }` (unknown
  email, wrong password, or inactive/disabled account).

##### `POST /api/auth/logout`

- `204` — deletes the current session's `access_tokens` row (immediate
  server-side revocation) and clears the `session` cookie. Idempotent: a missing
  session still returns `204`.

##### `GET /api/auth/me`

- `200` — the current session user, serialized to the contracted shape:

```json
{ "id": 1, "email": "admin@localhost", "is_superuser": true }
```

- `401` — no valid session.

##### `PATCH /api/auth/me`

fastapi-users' self-service profile update. In scope, the only field a user may
self-update is their **own password** (see `change-password` below); other
profile fields are out of scope this sprint. `PATCH /api/auth/me` is declared
available for compatibility but is **not** used by the SPA this sprint.

##### `POST /api/auth/change-password` (new)

Self-service password change for the signed-in user (scope item **f**, brief 03).

Request body:

```json
{ "old_password": "<current>", "new_password": "<new>" }
```

- `200` — `{ "status": "ok" }` — the user's password is updated through the
  fastapi-users `UserManager` (re-hashed with pwdlib). After the change the new
  password signs in and the old one no longer does.
- `400` — wrong `old_password`: `{ "detail": "INVALID_PASSWORD" }`.
- `422` — missing/empty fields or invalid `new_password` (too short / malformed).
- `401` — no valid session.

Existing session tokens remain valid until expiry; there is no force re-login on
self password change. **Superuser resetting another user's password is out of
scope** (brief 03).

##### `POST /api/auth/users` (new — admin account creation)

Superuser-only account creation (scope item **j**, brief 05). There is **no
self-service signup**; the fastapi-users register router is **not** mounted.

Request body:

```json
{ "email": "alice@example.com", "password": "<initial password>", "is_superuser": false }
```

- `201` — the created user: `{ "id": 2, "email": "alice@example.com", "is_superuser": false }`.
- `400` — email already registered: `{ "detail": "REGISTER_USER_ALREADY_EXISTS" }`.
- `422` — missing/invalid email or password.
- `401` — no valid session.
- `403` — authenticated but not a superuser: `{ "detail": "Not enough permissions" }`.

Created accounts get `is_active = 1`, `is_verified = 1`, and the requested
`is_superuser` (default `false`). Non-superusers have no admin functions and
cannot create accounts. **No SPA admin UI for account creation this sprint**
(brief 05); creation is via the API only.

#### 9.2.2 Other `/api` routes

- **Non-auth routes are unchanged** (scope **c**, **l**): companies, industries,
  countries, locations, references, news, artifacts, logos, and document
  generation keep their exact §8.2 contracts, request/response shapes, and
  status codes. They now read/write through the async SQLAlchemy data layer
  instead of hand-written SQL; responses are byte-for-byte the same.
- **`references.added_by`** is populated from the authenticated session user's
  email (fastapi-users current user), supporting multiple user accounts.

### 9.3 Project / File Structure Additions

New/changed files beyond the §1 and §8.3 trees:

```
backend/
├── models/                      # SQLAlchemy ORM models (new)
│   ├── __init__.py              #   re-exports all models for metadata
│   ├── user.py                  #   User (fastapi-users IntegerPK + is_* flags)
│   ├── access_token.py          #   AccessToken (DatabaseStrategy store)
│   ├── oauth_account.py         #   OAuthAccount (schema-only, brief 06)
│   ├── company.py               #   Company + locations/references/news_articles
│   ├── industry.py              #   Industry
│   ├── country.py               #   Country
│   ├── artifact.py              #   Artifact (incl. logo source)
│   └── reference.py / news_article.py
├── db/
│   ├── engine.py                # async engine + session factory (aiosqlite) (new)
│   ├── session.py               #   get_session dependency (new)
│   ├── base.py                  #   DeclarativeBase (new)
│   └── seed.py                  # seed-on-empty (re-homed from backend/data/seed.py)
├── auth/
│   ├── __init__.py
│   ├── db.py                    # get_user_db / get_access_token_db (new)
│   ├── strategies.py            # DatabaseStrategy + CookieTransport config (new)
│   ├── managers.py              # UserManager (password change, admin create) (new)
│   ├── schemas.py               # UserRead/UserUpdate/user-create serializers (new)
│   └── routers.py               # auth/users router assembly + change-password (new)
├── routers/
│   ├── auth.py                  # superseded by backend/auth/routers.py (removed/changed)
│   └── ...                      # existing routers unchanged in contract, now ORM-backed
├── app.py                       # wire-up: DB session, auth backend, migrations, seed
├── db.py                        # superseded by backend/db/ (removed)
├── models.py / schemas.py       # superseded / re-homed (removed)
├── data/seed.py                 # re-homed to backend/db/seed.py
└── alembic/
    ├── alembic.ini              # Alembic config (new)
    ├── env.py                   # async engine wiring (new)
    └── versions/                # versioned migrations; baseline = Sprint 01 schema (new)
frontend/
└── js/
    ├── api.js                   # auth endpoints re-pointed (login/me/logout unchanged paths)
    ├── login.js                 # sign-in/sign-out (paths unchanged)
    ├── password.js              # self-service change-password form (new)
    └── app.js                   # boot gate via GET /api/auth/me (unchanged behavior)
```

### 9.4 Module Boundary Changes

| Module | Change |
|--------|--------|
| `backend/models/*` | Own the SQLAlchemy ORM models and relationship metadata. Replaces the §1/§8 row-helper approach. |
| `backend/db/engine.py` | Owns the async engine (aiosqlite) and session factory. No request logic. |
| `backend/db/session.py` | Provides the per-request async session dependency. |
| `backend/auth/*` | Owns fastapi-users wiring: user/access-token DB adapters, `DatabaseStrategy` + `CookieTransport`, `UserManager`, serializers, and the auth/users/change-password routers. |
| `backend/routers/*` | Unchanged responsibilities and contracts; now call the ORM data layer instead of raw SQL. Routers still do no raw SQL and no file-bytes handling. |
| `backend/services/storage.py`, `pdf.py` | Unchanged (§2). |
| `backend/alembic/` | Owns versioned schema migrations; the Sprint 01 schema is the initial baseline revision. |
| `frontend/*` | Sign-in/sign-out/me flows re-point to the fastapi-users paths (same `/api/auth/*` paths); a new self-service change-password view is added. No other UI changes. |

Ownership rules from §2 (routers do no raw SQL/file-bytes handling; storage owns
bytes; schemas own the contract) are unchanged.

### 9.5 Backend / Frontend Responsibility Changes

**Backend (new):** replace hand-rolled auth with fastapi-users (`DatabaseStrategy`
+ `CookieTransport`), the stateful `access_tokens` session store, the `User` model
with `is_active`/`is_superuser`/`is_verified`, idempotent stable-admin bootstrap,
superuser-only `POST /api/auth/users`, and self-service `POST /api/auth/change-password`.
Move all persistence to async SQLAlchemy models and a per-request async session;
introduce Alembic with the Sprint 01 schema as the initial migration baseline;
perform the one-time dev-DB flush (scope **n**); add the `oauth_accounts` table
(schema-only). Non-auth behavior and API contracts are unchanged.

**Frontend (new):** continue to boot by calling `GET /api/auth/me` (paths
unchanged); treat a `401` from any API call as a return to the login view; add a
small self-service change-password form for the signed-in user. Sign-in/sign-out
re-point to the same `/api/auth/login` and `/api/auth/logout` paths. No SPA admin
UI for account creation this sprint. All other views and behaviors are unchanged.
The SPA remains a pure API client with no authoritative client-side state.

### 9.6 Component Interactions & State Flow

```
Browser (SPA)
   │  boot → GET /api/auth/me  (session cookie)
   │    401 ────────────────► login view
   │    200 ─► main views (all data via authenticated /api calls)
   │  any /api call → 401  ─► return to login view
   │  POST /api/auth/change-password ──► self-service password update
   ▼
FastAPI
   ├─ fastapi-users auth backend (DatabaseStrategy + CookieTransport)
   │     session cookie → access_tokens → users (else 401)
   │     login: verify via UserManager → create access_tokens row → set cookie
   │     logout: delete access_tokens row → clear cookie
   │     change-password: UserManager re-hash (pwdlib)
   │     admin create: superuser-gated UserManager.create
   ├─ routers (companies / industries / reference / locations / references / news
   │            / artifacts(+logo) / documents) ── async SQLAlchemy session
   ├─ services/pdf.py (fpdf2) ──► bytes (+ logo bytes when set) → storage
   ├─ services/storage.py ──► data/artifacts/<company_id>/...
   └─ db/engine.py (SQLAlchemy async + aiosqlite) ──► data/company_hub.db
      (schema applied via Alembic migrations)
```

**State flow additions:** the SPA holds no session state itself; on boot it asks
`/api/auth/me` and renders the login view or the app accordingly. A session is
active for its fixed lifetime (default 7 days, `COMPANY_HUB_SESSION_TTL` to
override) and then expires, returning the user to the login view. Sign-out
deletes the server-side token immediately. A superuser can create accounts via
`POST /api/auth/users`; the new account can sign in with its own credentials.
After a self password change the new password authenticates and the old one no
longer does. Non-auth state flows from §8.6 (industry/country label resolution,
country filter, locations/references/news sub-resources, logo, PDF regeneration)
are unchanged.

### 9.7 Explicitly Unchanged / Out of Scope

- All non-auth behavior and API contracts are unchanged (scope **c**, **l**):
  companies, industries, countries, locations, references, news, artifacts
  (incl. logos), document generation, completeness rule, and seed content/rules.
- The cookie-based sign-in experience is preserved: HttpOnly `session` cookie, a
  login screen for unauthenticated users, all application routes gated by an
  authenticated session (scope **g**).
- No self-service signup (register router not mounted); accounts are
  superuser-created (scope **j**). No SPA admin UI for account creation this
  sprint (brief 05). No superuser password reset of others.
- No OAuth login routes, provider screens, or SSO flows; `oauth_accounts` is
  schema-only (scope **k**, brief 06).
- No email-verification flow; created accounts are `is_verified = 1`.
- Entry point `backend.app:app`, `run.sh`, Python 3.12, dependency set, and the
  `data/` storage layout are unchanged (Stage 4: environment additions only,
  no removals). Object storage stays file-bytes-on-disk + metadata-in-DB.
- The one-time dev-DB flush (scope **n**) is a documented operator action Stage 6
  performs to establish the migration baseline, not app startup behavior.

### 9.8 Open Design Decisions / Contract Notes (Sprint 02)

1. **Stateful `DatabaseStrategy` (resolved):** tokens are persisted in
   `access_tokens` keyed to the user; expiry via `lifetime_seconds`; logout
   deletes the token row (immediate server-side revocation). This is NOT the
   stateless `JWTStrategy`. Satisfies scope **h** without a custom session store.
2. **Session lifetime:** fixed absolute lifetime (not sliding), default **7 days**
   (604800 s), overridable via `COMPANY_HUB_SESSION_TTL` (integer seconds).
   `cookie_max_age` matches. Re-login on expiry.
3. **Cookie name** preserved as `session` (Sprint 01 continuity), configured on
   `CookieTransport` (`HttpOnly`, `SameSite=Lax`, not `Secure` on dev http).
4. **Integer user id** (`IntegerPK`), not fastapi-users' default UUID, to stay
   consistent with the app's integer PKs.
5. **`users` schema:** adds `is_active`/`is_superuser`/`is_verified`;
   `password_hash` now uses pwdlib (argon2/bcrypt). Admin and admin-created
   accounts are `is_verified = 1`.
6. **Stable admin bootstrap:** idempotent (create only if absent), password from
   `COMPANY_HUB_ADMIN_PASSWORD` or generated+printed once; credential persists
   and is never re-randomized. Supersedes the §8 per-startup regeneration.
7. **`me` payload:** `{ id, email, is_superuser }` (no verification/active flags
   surfaced, no non-auth fields).
8. **Self password change:** `POST /api/auth/change-password`
   (`{ old_password, new_password }`) through the `UserManager`; old password
   verified, new one re-hashed. Existing tokens stay valid until expiry.
9. **Admin account creation:** superuser-only `POST /api/auth/users`; register
   router not mounted; no self-service signup.
10. **`oauth_accounts` (schema-only):** `UNIQUE(user_id, oauth_name)` and
    `UNIQUE(oauth_name, account_id)`; Google-oriented; no rows written this
    sprint and no OAuth routes.
11. **Alembic baseline:** the Sprint 01 schema is the initial migration revision;
    the dev DB under `data/` is flushed once (scope **n**) by Stage 6 before the
    first run of the new build. After that, changes are versioned migrations
    only (scope **b**).

---

## 10. Sprint 03 Enhancements — Architecture Additions

This section extends the specification above (§1–§9) with the deltas required by
the Sprint 03 scope (`enhancements/scope.md` items a–s; briefs
`features/briefs/01-role-based-access.md` through `04-sign-in-page-nav-fix.md`).
It **supersedes** the Sprint 02 `users` schema (§9.1.1), the `me` payload and the
superuser gate (§9.2.1), replacing the single `is_superuser` boolean with a
four-level access model, and adds an admin user-management API, an optional
Google SSO flow, and a sign-in-page navigation fix. Everything in §1–§9 not
explicitly superseded or modified here remains in force and is unchanged by this
pass.

### 10.1 Data Model & Schema Changes

#### 10.1.1 `users` (modified)

| Column | Change |
|--------|--------|
| `access_level` | **Added.** TEXT `NOT NULL` with `CHECK (access_level IN ('guest','read-only','user','admin'))`. Model-level default `'guest'`, so a row created without an explicit level (e.g. the fastapi-users SSO auto-provision path) lands at guest. |
| `is_superuser` | **Removed.** Replaced by `access_level`; `admin` **is** the superuser tier. Every Sprint 01/02 superuser check becomes an admin-level check. |

All other `users` columns (`id`, `email`, `password_hash`, `is_active`,
`is_verified`, `created_at`) are unchanged.

**Migration `0003_sprint03_roles` (versioned; no dev-DB flush):** adds
`access_level`, backfills the existing rows, then drops `is_superuser`:

- `is_superuser = 1` → `access_level = 'admin'`
- `is_superuser = 0` → `access_level = 'user'`
- the bootstrap admin (`admin@localhost`, `ADMIN_EMAIL`) is forced to `'admin'`
  regardless (defense in depth).
- After the backfill, the column keeps its `CHECK` constraint; the app model
  default is `'guest'` for new rows.

No flush is required this sprint: `oauth_accounts` already exists from Sprint 02
(scope **s**), and `access_level` is a normal additive migration. `oauth_accounts`
is consumed as-is (fastapi-users shape; no schema change).

**Bootstrap admin:** created at startup with `access_level = 'admin'` (in addition
to the existing `is_active`/`is_verified`); the create-if-absent,
env-password-or-generated behavior of §9.1.1 is unchanged.

#### 10.1.2 Level ordering

The four levels are ordered `guest < read-only < user < admin`. A single module
(`backend/auth/roles.py`) owns the ordered constants and the
`require_access(min_level)` dependency so the ordering is defined once and
enforced consistently (see §10.2.1). No other table changes.

### 10.2 API Contract Changes

Base path and static-file serving are unchanged (§4). The session/session-gating
rules from §8.2/§9.2 are unchanged, with the additions below.

#### 10.2.1 Role gating (applies to every existing data route)

Every `/api/` route keeps the session gate (`get_current_user`, `401` when
absent/invalid). On top of it, the data routes now carry a per-route
minimum-level dependency `require_access(min_level)` that returns
`403 {"detail": "Insufficient access level"}` when the signed-in account's level
is below the route's minimum. **Denials are `403`, never `401`**: a `401` would
throw the SPA back to the login view, but an out-of-level request is an
authenticated-but-forbidden request.

| Minimum level | Routes |
|---------------|--------|
| `read-only` | All **read** routes: `GET /api/companies`, `GET /api/companies/{id}`, `GET /api/industries`, `GET /api/countries`, `GET /api/companies/{company_id}/artifacts`, `GET /api/artifacts/{id}/content`. |
| `user` | All **mutating** routes: `POST`/`PUT`/`DELETE` for companies, industries, locations, references, news; `POST`/`DELETE` artifacts; `POST`/`DELETE` logo; `POST /api/companies/{id}/documents/generate` (document generation **is a write**). |
| `admin` | User management (§10.2.3): `GET`/`POST`/`PATCH`/`DELETE /api/auth/users*`. |

- **Guest** (`guest`): authenticated but has **no data access** — every data route
  (read or write) returns `403`. Guests may call `GET /api/auth/me`,
  `POST /api/auth/logout`, and `POST /api/auth/change-password`.
- **Read-only** (`read-only`): reads allowed, all writes refused (`403`), including
  document generation.
- **User** (`user`): the full current view/edit access (§8/§9 contracts unchanged).
- **Admin** (`admin`): user access plus user management.

Existing routes, payloads, and status codes are otherwise unchanged; only the
gate gains levels. The §9.2 statement that all `/api/` routes require an
authenticated session remains true.

#### 10.2.2 Authentication endpoints (modified)

##### `GET /api/auth/me`

Payload changes: `is_superuser` is removed and `access_level` is exposed (the SPA
needs it to render the guest/read-only/admin views):

```json
{ "id": 1, "email": "admin@localhost", "access_level": "admin" }
```

- `200` — current session user. `401` — no valid session. Any authenticated level
  can call it.

##### `POST /api/auth/login` and `POST /api/auth/logout`

Unchanged (§9.2.1). A deactivated account cannot sign in
(`400 LOGIN_BAD_CREDENTIALS`); a guest can sign in.

##### `POST /api/auth/change-password`

Unchanged (§9.2.1); available to every authenticated level including guest.
SSO-provisioned accounts hold a generated password the user does not know, so in
practice they cannot pass `old_password`; no password-set flow is added this
sprint (§10.7).

##### `POST /api/auth/users` (admin account creation — modified)

Body replaces `is_superuser` with a required `access_level`:

```json
{ "email": "alice@example.com", "password": "<initial password>", "access_level": "user" }
```

- `201` — `{ "id": 2, "email": "alice@example.com", "access_level": "user" }`.
  Created accounts get `is_active = 1`, `is_verified = 1`, and the requested
  level (any of the four).
- `400` — duplicate email: `{ "detail": "REGISTER_USER_ALREADY_EXISTS" }`.
- `422` — missing/invalid email, password, or `access_level`.
- `401` — no valid session. `403` — authenticated but not admin.

#### 10.2.3 User management (admin — new)

All endpoints are admin-only (`403` for non-admins; the **Users** nav entry is
likewise admin-only). Guardrails (§10.2.4) are enforced by the API; the UI
additionally disables the corresponding controls.

##### `GET /api/auth/users`

List all accounts. No search or pagination (brief 02); ordered by `id` ascending.

Response `200` — JSON array:

```json
[
  { "id": 1, "email": "admin@localhost", "access_level": "admin", "is_active": true },
  { "id": 2, "email": "alice@example.com", "access_level": "user", "is_active": true }
]
```

Errors: `401` (no session), `403` (not admin).

##### `PATCH /api/auth/users/{user_id}`

Change a level and/or active state. Body — at least one field:

```json
{ "access_level": "read-only", "is_active": false }
```

- `200` — the updated user payload (same shape as the list item).
- `404` — unknown user.
- `422` — invalid `access_level` value.
- `400` — a refused safeguard action (see §10.2.4) with a clear detail message;
  the account is left unchanged.
- `401` / `403` — as above.

Changing a level takes effect on the target's **next request** (the level is read
per request); existing sessions are not invalidated by a level change.
Deactivating a user stops its existing sessions immediately (the session gate
rejects inactive users), and reactivation restores them.

##### `DELETE /api/auth/users/{user_id}`

- `204` — the account is permanently removed. Deleting cascades to its
  `access_tokens` and `oauth_accounts` rows (`ON DELETE CASCADE`), so its
  sessions and any linked Google identity cease to exist. `references.added_by`
  is an email snapshot (no foreign key) and persists.
- `404` — unknown user.
- `400` — a refused safeguard action (see §10.2.4).
- `401` / `403` — as above.

#### 10.2.4 Guardrails (enforced by the API on every level/active/delete mutation)

1. **Bootstrap admin** (identified by `ADMIN_EMAIL = "admin@localhost"`): can
   **never** be deactivated, demoted, or deleted, under any circumstance. Any
   `PATCH`/`DELETE` targeting it is refused with
   `400 {"detail": "The bootstrap admin cannot be modified"}`.
2. **Last remaining admin**: cannot be demoted or deleted. "Last" counts accounts
   with `access_level = 'admin'` (regardless of `is_active`). A demote/delete that
   would leave zero admin-role accounts is refused with
   `400 {"detail": "Cannot demote or delete the last remaining admin"}`. Because
   the bootstrap admin is always an admin and immutable, this rule is a defensive
   backstop.
3. **No self role-change**: an admin cannot change **their own** `access_level`
   (refused with `400 {"detail": "Admins cannot change their own level"}`). Role
   changes are admin-only and must be performed by another admin.
   (Self-deactivation is permitted; it immediately ends the actor's own session.)
4. **Deactivating the last non-bootstrap admin is permitted** — the bootstrap
   admin remains the active admin. Deactivation is not covered by the last-admin
   rule (the briefs protect only the bootstrap admin from deactivation).

#### 10.2.5 Google SSO (new — optional)

##### `GET /api/auth/providers` (public, always mounted)

Tells the static SPA whether SSO is available (the SPA cannot read environment
variables):

Response `200`:

```json
{ "google": true }
```

`"google"` is `true` when both `COMPANY_HUB_GOOGLE_CLIENT_ID` and
`COMPANY_HUB_GOOGLE_CLIENT_SECRET` are present, else `false`. When `false`, the
sign-in screen shows no Google option and the app is fully self-contained
(email/password only, scope **l**).

##### `GET /api/auth/authorize` (public — mounted only when SSO is configured)

Starts the Google sign-in flow. Issues a signed state token (signed with the
state secret, §10.8 item 11) and sets the OAuth CSRF cookie, then returns:

```json
{ "authorization_url": "https://accounts.google.com/o/oauth2/...&state=..." }
```

The SPA redirects the browser to `authorization_url`.

##### `GET /api/auth/callback` (public — mounted only when SSO is configured)

The Google redirect target. Custom callback (see §10.6): resolves the account,
establishes the **same cookie session as email/password** (an `access_tokens` row
+ the HttpOnly `session` cookie, same TTL), then responds with a `302` redirect to
`/` (the SPA root). On the SPA's next boot, `GET /api/auth/me` sees the session.

Account resolution (fastapi-users `UserManager.oauth_callback` with
`associate_by_email=True`, `is_verified_by_default=True`):

1. The Google identity is already linked (an `oauth_accounts` row with
   `oauth_name='google'` and the Google `account_id`) → sign in as that account
   with its current level and active state.
2. Otherwise, the Google email matches an existing account → link the Google
   identity to that account and sign in as it with its existing level and active
   state.
3. Otherwise (entirely unknown email) → **auto-provision a new guest account**:
   `email` = Google email, `access_level = 'guest'` (the model default),
   `is_active = 1`, `is_verified = 1`, and a generated password (fastapi-users
   generates and hashes one); link the identity; sign in as that guest.

Errors / failures:

- Invalid or expired state token, or missing/mismatched CSRF cookie → `400`.
- Resolved account is inactive → `400 {"detail": "LOGIN_BAD_CREDENTIALS"}`.
- Canceled/failed Google sign-in → `400`; no session is established and the SPA
  returns the user to the login view with feedback.

**Dev vs production cookies:** the session cookie and the OAuth CSRF cookie are
`Secure` only when `COMPANY_HUB_SECURE_COOKIES=1` is set (production); the default
(`off`) keeps them non-Secure so the SSO flow works over plain HTTP on localhost
(Brief 03 item 7). The CSRF cookie honors the 1-hour state-token lifetime.

Redirect URI to register in the Google OAuth console:
`http://127.0.0.1:8000/api/auth/callback` (unchanged from Stage 4 — the custom
callback keeps the same URL path, so the Stage 4 console registration stands;
§10.8 item 10).

### 10.3 Project / File Structure Additions

New/changed files beyond the §1, §8.3, and §9.3 trees:

```
backend/
├── auth/
│   ├── roles.py               # level constants/ordering + require_access / get_current_admin (new)
│   ├── providers.py           # GET /api/auth/providers + optional GoogleOAuth2 client (new)
│   ├── oauth.py               # custom SSO authorize/callback router (new)
│   ├── routers.py             # extended: /users GET/PATCH/DELETE, me payload (extended)
│   └── schemas.py             # UserRead/UserCreate gain access_level; level/active payloads (extended)
├── models/user.py             # add access_level, drop is_superuser (modified)
├── alembic/versions/0003_sprint03_roles.py   # migration: access_level + drop is_superuser (new)
└── app.py                     # mount providers always; mount oauth router when configured (extended)
frontend/
├── index.html                 # whole top <nav> hidden when unauthenticated (extended)
└── js/
    ├── app.js                 # hide/show whole nav; guest blocked view; Users nav entry (extended)
    ├── login.js               # "Sign in with Google" button when providers.google (extended)
    ├── users.js               # admin user-management view (new)
    ├── api.js                 # providers, users CRUD, me.access_level (extended)
    └── list.js / profile.js / form.js / industries.js   # hide mutating controls for read-only (extended)
```

### 10.4 Module Boundary Changes

| Module | Change |
|--------|--------|
| `backend/auth/roles.py` | Owns the level constants, ordering, and the `require_access(min_level)` / `get_current_admin` dependencies. No business data. |
| `backend/auth/providers.py` | Owns the public providers endpoint and the (optional) Google OAuth client construction. |
| `backend/auth/oauth.py` | Owns the SSO authorize/callback routes incl. the custom session-cookie + redirect callback. |
| `backend/auth/routers.py` | Owns the auth router incl. the user-management CRUD (GET/PATCH/DELETE `/users`) and the guardrails; extends the `me` payload and `POST /api/auth/users`. |
| `backend/routers/*` | Existing contracts unchanged; each route gains its per-route role dependency (`require_access`). Routers still do no raw SQL and no file-bytes handling. |
| `backend/models/user.py` | `access_level` replaces `is_superuser`. |
| `backend/db/seed.py` | Unchanged content/rules; the bootstrap admin is created with `access_level = 'admin'`. |
| `frontend/*` | Session-based nav hiding, guest blocked view, read-only UI gating, admin Users view, and the SSO sign-in button. |

Ownership rules from §2 (routers do no raw SQL/file-bytes handling; storage owns
bytes; schemas own the contract) are unchanged.

### 10.5 Backend / Frontend Responsibility Changes

**Backend (new):** add `access_level` to `users` (migration 0003) and drop
`is_superuser`; expose `access_level` in the `me` and user-management payloads;
apply the per-route `require_access` gates (§10.2.1); implement the admin
user-management API with guardrails (§10.2.3–10.2.4); implement the optional
Google SSO flow (providers endpoint, authorize/callback, session-cookie +
redirect) driven by environment variables with the secure-cookie toggle.
`POST /api/auth/users` takes `access_level` instead of `is_superuser`. Non-auth
data behavior is unchanged.

**Frontend (new):** hide the **entire** top navigation bar (brand, menu links,
toggler — the whole `<nav>`) when there is no authenticated session, and show it
fully once a session exists (Brief 04). Render the **guest blocked view** for
`access_level === 'guest'`: nav visible, empty/blocked main view with an
explanatory message, with logout and change-password available and no data shown.
Hide every mutating control (create/edit/delete/upload/logo/document-generation)
for read-only, and treat a `403` from any API call as "action not permitted"
feedback (never as logout; only `401` returns to the login view). For admins,
show a **Users** nav entry leading to the user-management view (list, create,
change level, activate/deactivate, delete) and disable
bootstrap-admin/last-admin-destabilizing controls in the UI (the API remains
authoritative). On the login view, when `GET /api/auth/providers` returns
`google: true`, show a **Sign in with Google** button that navigates to
`/api/auth/authorize`; after the callback redirects to `/`, the boot `me()` call
sees the session. The SPA remains a pure API client with no authoritative
client-side state.

### 10.6 Component Interactions & State Flow

```
Browser (SPA)
   │  boot → GET /api/auth/me → { access_level }
   │    401 ────────────────► login view (+ GET /api/auth/providers → show/hide Google button)
   │    guest ─────────────► nav visible + blocked main view (logout + change-password only)
   │    read-only/user/admin ► main views; mutating controls hidden below user; Users view for admin
   │  any /api call → 401 ─► return to login view
   │                 → 403 ─► "not permitted" feedback (session kept)
   │  Sign in with Google → /api/auth/authorize → Google → /api/auth/callback → 302 → /
   ▼
FastAPI
   ├─ require_access(read-only | user | admin) dependencies over the data routers
   ├─ fastapi-users auth backend (DatabaseStrategy + CookieTransport)
   │     session cookie → access_tokens → users (else 401)
   │     login/logout/me/change-password as before (any level)
   │     users CRUD (GET/POST/PATCH/DELETE /api/auth/users) gated to admin + guardrails
   ├─ Google OAuth (optional, env-driven)
   │     GET /api/auth/providers          → { google: bool }
   │     GET /api/auth/authorize          → state token + CSRF cookie → Google
   │     GET /api/auth/callback           → UserManager.oauth_callback (link → associate-by-email
   │                                        → auto-provision guest) → access_tokens row
   │                                        → session cookie → 302 → /
   ├─ routers (companies / industries / reference / locations / references / news
   │            / artifacts(+logo) / documents) ── async SQLAlchemy session
   ├─ services/pdf.py (fpdf2) ──► bytes (+ logo bytes when set) → storage
   ├─ services/storage.py ──► data/artifacts/<company_id>/...
   └─ db/engine.py (SQLAlchemy async + aiosqlite) ──► data/company_hub.db
      (schema applied via Alembic migrations; 0003 = roles)
```

**State flow additions:** a guest session renders the blocked view and issues no
data fetches. A role change is read per request, so it takes effect on the
target's next request without session invalidation. Deactivating a user
immediately stops its existing sessions (the session gate rejects inactive
users); reactivation restores them. Deleting a user cascades to its tokens and
OAuth links. For SSO, the first sign-in with an unknown email auto-provisions a
guest who stays on the blocked view until an admin elevates them; elevation takes
effect on their next fetch. The SSO callback establishes the same cookie session
as email/password, so route gating, TTL, and logout behave identically for both
sign-in paths.

### 10.7 Explicitly Unchanged / Out of Scope

- All non-auth data contracts are unchanged: companies, industries, countries,
  locations, references, news, artifacts (incl. logos), document generation,
  completeness rule, and seed content/rules keep their exact §8/§9 shapes and
  status codes; only the auth gate gains levels.
- Email/password login, logout, `change-password`, cookie-session semantics
  (7-day default TTL, `COMPANY_HUB_SESSION_TTL`), and session route-gating are
  unchanged. `401` still means "no/invalid session".
- `oauth_accounts` is consumed as-is (no schema change, scope **s**).
- No self-service signup or self-service profile editing; account creation and
  role changes remain admin-only. No password-set flow for SSO-provisioned
  accounts this sprint (approved).
- Google is the only external provider. SSO is config-driven and optional;
  without credentials the app is fully self-contained. SSO is verified manually
  against real Google credentials (no automated SSO checks, scope **o**).
- No DB flush: `oauth_accounts` exists from Sprint 02; `access_level` lands via
  versioned migration 0003.
- The sign-in nav fix changes only when the bar is hidden; the signed-in
  navigation is identical to today.
- In-scope, deliberate changes (not regressions): the `me`/user-management
  payloads and the user schema (role replaces `is_superuser`), and the role
  gating on existing data routes.

### 10.8 Open Design Decisions / Contract Notes (Sprint 03)

1. **Level values** are stored as TEXT (`guest`, `read-only`, `user`, `admin`)
   with a `CHECK` constraint and a single ordering helper in
   `backend/auth/roles.py`; order is `guest < read-only < user < admin`.
2. **`is_superuser` is dropped**; `admin` is the superuser tier. Every Sprint
   01/02 superuser gate site moves to the admin level.
3. **Denials are `403`** (session preserved); `401` remains session-only. A
   read-only user attempting a write, or a guest attempting any data call, gets
   `403`.
4. **Guests are authenticated but have no data access** (all data endpoints
   `403`); they may use `me`, `logout`, and `change-password`.
5. **Document generation is a write** and is denied for read-only.
6. **Bootstrap admin** is identified by `ADMIN_EMAIL` (`admin@localhost`) and is
   immutable for level/active/delete.
7. **Last-admin rule** counts admin-role accounts (active or not); because the
   bootstrap admin is always an admin, it is a defensive backstop. Deactivation
   of the last non-bootstrap admin is permitted.
8. **Admins cannot change their own level**; self-deactivation is permitted but
   ends the actor's session immediately.
9. **SSO is mounted only when both Google env vars are present**;
   `GET /api/auth/providers` drives the login button.
10. **Custom SSO callback** (approved): reuses `UserManager.oauth_callback` + the
    same `DatabaseStrategy`/`CookieTransport`, sets the session cookie, and
    `302`-redirects to `/`. This deviates from the Stage 4 assumption that the
    stock `get_oauth_router` callback response would be used, but keeps the same
    `/api/auth/callback` path, so the Stage 4 Google-console redirect
    registration stands.
11. **`COMPANY_HUB_OAUTH_STATE_SECRET`** signs the OAuth state token; when absent
    it is derived from the Google client secret.
12. **`COMPANY_HUB_SECURE_COOKIES=1`** (production) makes the session + OAuth
    CSRF cookies `Secure`; default off = the dev plain-HTTP relaxation (Brief 03
    item 7).
13. **Auto-provisioned SSO accounts** are guest/active/verified with a generated
    password; they cannot use `change-password` (they don't know the generated
    password) and no password-set flow exists this sprint.
14. **User-management list** is ordered by `id` ascending; no search or
    pagination (brief 02).
