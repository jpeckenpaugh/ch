# Company Hub

A simple internal web app for a small, globally distributed firm to view and
maintain information about the companies it works with. Company Hub is intended
as a lightweight backbone for other internal workflows — a consistent place to
browse company information, view and edit company profiles, and store or
generate documents associated with a company — rather than a comprehensive CRM
or firm-wide system of record.

The application distinguishes between structured company information (stored in
a relational database) and files or generated artifacts associated with those
companies (handled through a simple object-storage capability). As an initial
example, it can generate a simple, clean PDF summary of a company's profile and
make that document available from the profile.

## Stack

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) with [SQLite](https://www.sqlite.org/)
  persisted through **async [SQLAlchemy](https://www.sqlalchemy.org/) 2.0**
  (`aiosqlite`) with versioned **[Alembic](https://alembic.sqlalchemy.org/)**
  migrations — serves the REST API and the frontend.
- **Frontend:** a static, client-side [Bootstrap](https://getbootstrap.com/) SPA
  (no build step) served by the FastAPI app at `/`.
- **Authentication:** the maintained [fastapi-users](https://fastapi-users.github.io/)
  library — email/password login with the stateful `DatabaseStrategy` (server-side
  session tokens with a defined lifetime) and an HttpOnly `session` cookie
  (`CookieTransport`).
- **Object storage:** local filesystem under `data/artifacts/` — file bytes are
  kept on disk; the database stores artifact metadata only.
- **Document generation:** [fpdf2](https://py-pdf.github.io/fpdf2/) for the
  one-page PDF company summary.

Target Python 3.11+ (developed on 3.12).

## Features

- **Browse companies** — a single, central list with searchable names, compact
  scannable details, and click-through to a company profile.
- **View company profiles** — all structured information for one company plus
  its related files and generated documents in one place.
- **Maintain company information** — add and edit a company's structured
  details with save/cancel; incomplete records are flagged as such.
- **Manage files and artifacts** — upload, list, download, and remove files or
  artifacts associated with a company.
- **Generate documents** — generate a simple, clean PDF summary from a company
  profile; it is stored as an artifact and exposed from the profile.

Sprint 01 added:

- **Sign-in required** — email/password login; the whole app requires an
  authenticated session. A bootstrap `admin@localhost` user is created on
  startup with a fresh, complex auto-generated password printed to the console
  (no signup flow).
- **Standardized industries** — industry is a controlled value chosen from a
  seeded six-item standard list (added in Sprint 01, replacing the free-form
  field). A management view can add and rename industries; renames propagate to
  companies automatically.
- **Standardized countries and locations** — a company can have zero or more
  locations (label, city, optional address/region, country from a standard
  83-entry country list, type), replacing the single free-form headquarters
  field. A company may have at most one Headquarters; the derived HQ is shown as
  "City, CC" (e.g. Shell's is "London, GB").
- **Country filter** — the companies list can be filtered by country
  (multi-select), combined with the existing name search.
- **References** — a per-company place for curated resource links (title, URL,
  description, who added it and when).
- **News** — a per-company place for news articles (title, source, URL,
  publication date, summary) with a scraped-status flag for automated
  workflows.
- **Logos** — a company can have one designated logo, uploaded from the UI,
  shown on the profile and as a list thumbnail, and embedded in generated PDFs
  when possible.

Company completeness was redefined in Sprint 01: name + industry + the four
contact/description fields (locations and logos do not count).

Sprint 02 added:

- **Async ORM persistence** — the database layer was rebuilt on async
  SQLAlchemy 2.0 (`aiosqlite`); application code reads and writes through ORM
  models rather than hand-managed SQL. All existing non-auth API contracts and
  behaviors are unchanged.
- **Versioned schema migrations** — the schema is applied through Alembic
  versioned migrations (the Sprint 01 schema is the baseline; a Sprint 02
  revision adds the auth/schema deltas). Fresh databases reach the current
  schema by replaying the migration set in order.
- **Maintained authentication** — the hand-rolled Sprint 01 auth was replaced by
  fastapi-users. Sign-in/sign-out and the current-user endpoint use the same
  cookie-based experience as before, but login now returns `{access_token,
  token_type}` and `me` returns `{id, email, is_superuser}`.
- **Stable bootstrap admin** — the `admin@localhost` account now has a stable,
  persisted credential (created once, **not** re-randomized on every restart).
- **Self-service change-password** — a user can change their own password from a
  new `#/password` UI view (`POST /api/auth/change-password`).
- **Multiple user accounts** — additional accounts are created by a superuser
  through `POST /api/auth/users`; there is no self-service signup.
- **Defined session lifetime** — sessions have a fixed server-side lifetime
  (default 7 days, `COMPANY_HUB_SESSION_TTL` to override) enforced by the
  fastapi-users stateful `DatabaseStrategy`, with immediate server-side
  revocation on sign-out.
- **OAuth-ready account model (schema-only)** — an `oauth_accounts` table exists
  (Google-oriented) so external-identity-provider login can be added in a later
  sprint without a data-model change; no OAuth login routes exist yet.

Sprint 03 added:

- **Role-based access** — each account carries one of four access levels:
  **guest**, **read-only**, **user**, or **admin** (admin = superuser),
  replacing the single `is_superuser` boolean (applied via a versioned Alembic
  migration; the `oauth_accounts` table is consumed as-is). `me` now returns
  `{id, email, access_level}`. The UI and API respect the level: guests are
  authenticated but see a blocked "Access pending" view (no data access); read-only
  users can view and download but not create/edit/delete; users have the current
  full view/edit access; admins additionally get account management. Denials are
  `403 {"detail":"Insufficient access level"}` and keep the session.
- **Admin user management** — an admin can list all accounts with their level and
  active state, create accounts (email + initial password + level), change a
  level, activate/deactivate, and delete. It is admin-only (hidden from and denied
  to non-admins). Safeguards protect the system: the bootstrap admin is immutable
  (cannot be demoted, deactivated, or deleted), an admin cannot change its own
  level, and a last-remaining-admin backstop is enforced.
- **Google sign-in (SSO)** — an optional "Sign in with Google" alternative to
  email/password. SSO is config-driven (active only when OAuth credentials are
  provided via environment variables; the app works fully self-contained
  otherwise and the button appears on the login screen only when enabled). A
  Google sign-in authenticates the user, establishes the same cookie session as
  email/password, links the Google identity to the account, and auto-provisions a
  **guest** account when the email is unknown (an admin then elevates it). Google
  is the only external provider; local dev may run SSO over plain HTTP.
  End-to-end sign-in is verified **manually** against real Google credentials
  (not automated).
- **Sign-in page navigation fix** — the entire top navigation bar (brand, menu
  links, and toggler) is hidden when no user is signed in and appears only once an
  authenticated session exists.

## Requirements

- A Python 3.11+ interpreter named `python3.12` or `python3.11` on `PATH`
  (the install script does not bootstrap a runtime).
- No external database or object-storage service is required.

## Setup

```sh
./install.sh
```

`install.sh` creates a project-local virtual environment (`.venv/`) and installs
the pinned dependencies from `requirements.txt`.

## Run

```sh
./run.sh
```

`run.sh` starts the app with `uvicorn backend.app:app` on
`http://127.0.0.1:8000`. Open that URL in a browser.

**Login is required.** On first startup the backend creates the bootstrap admin
`admin@localhost` with a fresh, complex auto-generated password that is
**printed to the console**. Sign in with `admin@localhost` and that printed
password. The password is created once and **persisted** — it is **not**
re-randomized on subsequent restarts (the `COMPANY_HUB_ADMIN_PASSWORD`
environment override, used by the test suites, sets it deterministically
instead). The bootstrap admin is an **admin** (full access, including user
management). The whole application (all `/api` routes) requires an authenticated
session, so you will be asked to log in on first use; what an authenticated
account can then see and do depends on its `access_level` (see Features).

On first start the backend creates the SQLite database under `data/` and seeds
it with the standard data: six industries, the standard 83-entry country list,
and exactly six real companies — one of the biggest players in each seeded
industry. Each company is seeded with a Headquarters location, one or two
further real locations, two curated references (a Wikipedia article and its
official about/company-profile page), several genuine recent news articles
(hand-authored, not scraped), and a logo:

| Industry | Company | HQ |
|---|---|---|
| Manufacturing | Toyota Motor | Toyota City, JP |
| Technology | Samsung Electronics | Seoul, KR |
| Finance | HSBC | London, GB |
| Healthcare | Novartis | Basel, CH |
| Energy | Shell | London, GB |
| Retail | Carrefour | Paris, FR |

Seeded references use `added_by = admin@localhost` to mark them as
backend-seeded rather than user-added.

Seeding happens only when the `companies` table is empty; it never overwrites
user data. Runtime data (the database and stored artifact bytes) live under
`data/`, which is gitignored and never committed.

**If you are holding a database seeded before this build**, flush the gitignored
dev runtime state once so the richer seed (references, news, logos, and extra
locations) is created on the next start (seeding never runs on a non-empty
`companies` table):

```sh
./flush.sh
```

`flush.sh` removes `data/company_hub.db` and `data/artifacts`; the next
`./run.sh` seeds a fresh database from scratch. **Sprint 02** established the
Alembic migration baseline with a one-time flush of the dev state (scope item
n); from then on the current schema is reached by replaying the migration set in
order, and seeding still runs only on an empty `companies` table.

## API

The REST API lives under `/api`. Every route requires an authenticated session
except `POST /api/auth/login` and `GET /api/auth/providers` (unauthenticated
`/api` calls return `401`). Beyond authentication, most data routes are
role-gated: reads require **read-only** or higher, writes and document
generation require **user** or higher, and user management requires **admin**
(out-of-level calls return `403 {"detail":"Insufficient access level"}`). It
includes:

- `POST /api/auth/login` — sign in with `{email, password}`; returns
  `200 {access_token, token_type:"bearer"}` plus an HttpOnly `session` cookie
- `GET /api/auth/providers` — public; `{google:bool}` reflecting whether SSO is
  enabled
- `GET /api/auth/authorize`, `GET /api/auth/callback` — Google SSO flow
  (mounted only when Google credentials are configured); `/callback` establishes
  the same cookie session and redirects to `/`
- `GET /api/auth/me` — the current user `{id, email, access_level}`
- `POST /api/auth/logout` — sign out; revokes the session server-side (idempotent
  `204`)
- `POST /api/auth/change-password` — change the current user's own password
  (`{old_password, new_password}`, new password ≥ 8 chars)
- `GET /api/auth/users` — **admin-only** list of all accounts
  `{id, email, access_level, is_active}`
- `POST /api/auth/users` — **admin-only** account creation (email + initial
  password + access level); no self-service signup route
- `PATCH /api/auth/users/{id}` — **admin-only** change an account's level and/or
  active state (guardrails protect the bootstrap admin and the last admin)
- `DELETE /api/auth/users/{id}` — **admin-only** delete an account
- `GET /api/companies` — list (with optional `?q=` name search and `?countries=`
  multi-country filter)
- `POST /api/companies` — create a company
- `GET /api/companies/{id}` — company profile (with its locations, references,
  news, and artifacts)
- `PUT /api/companies/{id}` — full-replace update
- `DELETE /api/companies/{id}` — delete a company (cascades to its artifacts)
- `POST /api/companies/{id}/locations`, `PUT /api/companies/{id}/locations/{location_id}`,
  `DELETE` — manage a company's locations; the company profile supplies the
  current location list
- `POST /api/companies/{id}/references`, `PUT`/`DELETE` per reference — manage
  references; the company profile supplies the current reference list
- `POST /api/companies/{id}/news`, `PUT`/`DELETE` per article — manage news;
  the company profile supplies the current news list
- `POST /api/companies/{id}/logo`, `DELETE /api/companies/{id}/logo` — set/remove
  the company logo
- `GET /api/industries`, `POST`, `PUT /api/industries/{id}` — manage the
  industry list (add/rename)
- `GET /api/countries` — the standard country list (read-only)
- `POST /api/companies/{id}/artifacts` — upload an artifact
- `GET /api/companies/{id}/artifacts` — list a company's artifacts (logos excluded)
- `GET /api/artifacts/{id}/content` — download an artifact
- `DELETE /api/artifacts/{id}` — remove an artifact
- `POST /api/companies/{id}/documents/generate` — generate a PDF summary

Interactive API docs are available at `/docs` (OpenAPI).

## OpenCode automation

The repository includes OpenCode tools in `opencode/.opencode/tools/` and
task-specific agents in `opencode/.opencode/agents/`. They use the same
authenticated Company Hub API as the SPA.

The backend creates an `agent@localhost` account with **user** access. Set
`COMPANY_HUB_AGENT_PASSWORD` for its credential; the tools use that account by
default and authenticate with `get_token`. `COMPANY_HUB_AGENT_EMAIL` may select
another account, and `COMPANY_HUB_API_URL` may override the default API base of
`http://localhost:8000`.

### Tools

- **Authenticate and discover:** `get_token`, `get_companies`, and
  `get_industries`.
- **Read a profile:** `get_company_details`, `get_company_locations`,
  `get_company_references`, `get_company_news`, `get_company_logo`, and
  `get_company_files`.
- **Create or enrich a profile:** `add_company`, `add_company_details`,
  `add_company_location`, `add_company_reference`, `add_company_news`,
  `add_company_logo`, and `add_company_file`.

`add_company_details` is merge-safe: it reads the current profile first and
updates only the supplied structured fields, retaining existing values for all
other fields. `add_company_logo` takes a direct image URL, downloads the image,
and uploads it through the existing Company Hub logo endpoint. `add_company_file`
uploads a file from a local path.

### Agents

- `source_news` takes `company_id` and `number_of_new_items` (1–5). It checks
  current news, finds credible recent coverage, skips duplicates, and adds each
  verified article separately.
- `source_company` takes `company_name`. It finds or creates the company,
  researches and enriches its profile, locations, references, and official logo,
  then adds up to five verified, non-duplicate news items.

## Implementation summary

The backend (`backend/`) is a FastAPI application assembled in `backend/app.py`,
with async SQLAlchemy persistence (`backend/db/` — engine, per-request session,
and seed), ORM models (`backend/models/`), Pydantic request schemas
(`backend/schemas.py`), row-to-JSON serializers (`backend/serializers.py`), and
routers for companies, artifacts, and document generation. A local-filesystem
object-storage service (`backend/services/storage.py`) stores bytes under
`data/artifacts/<company_id>/`, and a one-page PDF service
(`backend/services/pdf.py`) builds the company summary. The database stores
artifact metadata only; file bytes live on disk.

The frontend (`frontend/`) is a static Bootstrap SPA — an `index.html` shell, a
custom stylesheet, and nine ES-module JavaScript files (`app.js`, `api.js`,
`list.js`, `profile.js`, `form.js`, `login.js`, `industries.js`, `password.js`,
`users.js`) implementing hash-based routing, the list, profile, add/edit,
artifact, generate, login, industry-management, change-password, and admin
user-management views. Bootstrap and Bootstrap Icons are vendored locally, so
the app has no runtime network/CDN dependency. It is a strict API client with no
client-side persistence: every view re-fetches from the backend, so the UI
always reflects current state.

**Sprint 01** extended both sides. The backend gained auth (`backend/routers/auth.py`:
PBKDF2 hashing, DB-backed HttpOnly session cookie, `login`/`me`/`logout`, every
`/api` route gated), controlled industries (`industries.py`), the standard
country list (`reference.py`), locations (`locations.py`), references
(`references.py`), news (`news.py`), and logo upload/remove on the companies
router. The companies contract now exposes a nested `industry`, a derived
`hq_location` ("City, CC"), `logo_url`, a logo-exclusive `artifacts_count`, and
the multi-country filter; completeness was redefined; the seed was replaced
with the six real companies (one HQ each); and PDF generation embeds the logo
when its bytes are embeddable. The frontend gained `login.js` and
`industries.js` plus updates to `app.js`, `api.js`, `list.js`, `profile.js`,
and `form.js` for the login gate, industry management, the country multi-select
filter, locations/references/news editors on the profile, logo
upload/replace/remove, and the new payload rendering.

The seed was later enriched with real content (`backend/data/seed.py`): each
seeded company now also carries one or two further real locations, two curated
references (Wikipedia + official about page, `added_by = admin@localhost`),
several genuine recent news articles (`is_scraped = 0`), and a committed raster
logo (`backend/data/logos/`) copied into artifact storage at seed time.

**Sprint 02** rebuilt the persistence layer on async SQLAlchemy 2.0 and replaced
the hand-rolled auth with fastapi-users. The backend now has a config module
(`backend/config.py`), an ORM model set (`backend/models/`, incl. `user`,
`access_token`, and the schema-only `oauth_account`), an async DB layer
(`backend/db/` — engine, per-request session, and seed), an auth package
(`backend/auth/` — DB adapters, `DatabaseStrategy` + `CookieTransport`, user
manager with the idempotent bootstrap-admin, and a custom auth-router assembly
for the JSON-login / idempotent-logout / `{id, email, is_superuser}`-`me`
contract), and a serializer layer (`backend/serializers.py`). Versioned Alembic
migrations (`backend/alembic/` — Sprint 01 schema baseline + a Sprint 02 auth
revision) run to `head` on startup. Routers are now async ORM calls; file I/O
and PDF generation run via `asyncio.to_thread` so they stay off the request
loop. The hand-rolled `backend/routers/auth.py` and `backend/db.py` were
removed (superseded). The frontend gained a `password.js` view and a `#/password`
route (self-service change-password) and re-fetches the current user via `me`
after login, since the login response is now `{access_token, token_type}`.

**Sprint 03** extended both sides with the role model, admin user management,
optional Google SSO, and the sign-in nav fix. The backend gained a role module
(`backend/auth/roles.py` — level ordering and the `require_access` / admin
dependencies), the four-level `access_level` field (Alembic migration
`0003_sprint03_roles`, replacing `is_superuser`), an SSO package
(`backend/auth/providers.py` for the always-mounted `GET /api/auth/providers`
plus a Google client, and `backend/auth/oauth.py` for the config-driven
`authorize`/`callback` flow), and admin user-management routes with guardrails
(immutable bootstrap admin, no self role-change, last-admin backstop). Session
cookies honor `COMPANY_HUB_SECURE_COOKIES`, and `backend/config.py` exposes the
SSO/state-secret env helpers. The frontend gained a `users.js` view and `#/users`
route (admin-only), a whole-`<nav>` hide/show fix (`#nav-bar` hidden when
unauthenticated), a blocked guest view, role-aware hiding of mutating controls
for read-only users, friendly `403` handling in `api.js`, and a "Sign in with
Google" button on the login view when SSO is enabled.

## Testing

Dev-only test dependencies (nothing in `requirements.txt` is a test dependency):

```sh
.venv/bin/pip install -r requirements-dev.txt
```

- **Backend suite** — persistent in-process pytest tests against throwaway
  temp databases (never touches `data/`):
  `python -m pytest tests/backend -q`
- **Everything (backend + browser)** — `./tests/run.sh` launches uvicorn with a
  throwaway DB and headless Chrome, runs the CDP browser tests, then tears both
  down. Logs land under `tmp/` (gitignored).

See `environment-notes.md` for the full environment details, including the
`COMPANY_HUB_DB` / `COMPANY_HUB_ADMIN_PASSWORD` overrides the test suites rely
on.

## Current status

**Complete and verified.** The v0.1 application (Stage 6 backend + Stage 7
frontend) passed verification with zero failures. The only Stage 7 blocker — the
backend's company responses initially omitting the `id` field — was fixed in a
follow-up patch and confirmed across every company endpoint.

The **Sprint 01** enhancement pass (authentication, standardized industries,
standardized countries and locations, country filter, references, news, logos,
and the real-company seed) is likewise **complete and verified**: PASS with 0
failures across 93 live `curl` checks, 51 backend `pytest` checks, and 34 CDP
browser-automation checks. See `COMPARISON.md` for the v0.1 → Sprint 01
feature-set change summary.

The **Sprint 02** enhancement pass (persistence rebuilt on async SQLAlchemy
with Alembic versioned migrations, and hand-rolled auth replaced by the
maintained fastapi-users library) is **complete and verified**: PASS with 0
failures across 64 backend `pytest` checks, 36 CDP browser-automation checks
(incl. a self-service change-password UI flow), and 28 live `curl` checks
exercising the fastapi-users auth contract (login/me/logout, change-password,
superuser-only account creation, session expiry + server-side revocation, and a
non-auth API regression pass).

The **Sprint 03** enhancement pass (role-based access, admin user management,
optional Google SSO, and the sign-in navigation fix) is likewise **complete and
verified**: PASS with 0 failures across 81 backend `pytest` checks, 36 CDP
browser-automation checks, and 46 live `curl` checks, with two manual items
recorded as delivered (the end-to-end Google SSO sign-in, verified manually per
scope, and the last-admin guardrail, present but unreachable by design). The
working tree is clean on `main` and up to date with `origin`. See
`COMPARISON.md` for the feature-set change summaries.

## Verification results

Verification (Stage 8) ran the app via `./run.sh` and exercised the full API
surface live, plus static review of the frontend rendering logic. See
`docs/verification-report.md` for the full evidence-backed report.

- **v0.1 (2026-09-02): PASS — 0 failures** across 34 checks in five groups
  (environment and stack, company API, artifact API / object storage, document
  generation, and frontend static review).
- **Sprint 01 (2026-09-04): PASS — 0 failures** — 93 live `curl` checks
  (auth-gated API incl. industries/countries/locations/references/news/logos/
  documents, run against a throwaway DB using the real printed-password login),
  51 backend `pytest` checks, and 34 CDP headless-Chrome browser checks, plus
  static frontend review (all seven JS modules pass `node --check`).
- **Sprint 02 (2026-09-05): PASS — 0 failures** — 64 backend `pytest` checks
  (16 auth: route gating, login/logout/me, change-password, multiple users,
  session expiry; plus all non-auth resources), 36 CDP headless-Chrome browser
  checks (incl. the new change-password UI flow), and 28 live `curl` checks
  against a running app exercising the fastapi-users auth contract
  (login/me/logout, change-password, superuser-only account creation, session
  expiry via a short-TTL throwaway server, server-side revocation, and a
  non-auth API regression pass), run against throwaway DBs so `data/` was
  untouched.
- **Sprint 03 (2026-09-05): PASS — 0 failures** — 81 backend `pytest` checks
  (roles, admin user management incl. guardrails, SSO wiring, plus all non-auth
  routes/seed), 36 CDP headless-Chrome browser checks (incl. the re-pointed
  whole-nav hide/show assertions and the admin Users view), and 46 live `curl`
  checks against two throwaway-DB servers (SSO disabled and enabled) covering
  the role matrix, user-management guardrails, and the SSO `providers` /
  `authorize` wiring. The end-to-end Google sign-in is recorded as a **manual**
  item (scope o, not automated), as is the last-admin guardrail (present but
  unreachable by design).

Three v0.1 checks pass with notes; these are documented human resolutions from
earlier stages, not defects (see Known issues below).

## Known issues and limitations

These are documented limitations and previously resolved human decisions,
recorded as delivered and **not** treated as defects. Two v0.1 items are
superseded by Sprint 01 and retained as supersession notes:

- **No automated browser interaction (superseded).** v0.1's frontend was
  verified by static review of its rendering logic plus live exercise (via
  `curl`) of every API call the SPA makes, and by confirming all assets serve
  with correct MIME types and all JS passes a syntax check. Click-through, form
  fill, and toast rendering were not exercised by a browser-automation tool.
  **Added in Sprint 01:** the repo now ships a persistent CDP browser suite
  (`tests/browser`, run via `tests/run.sh`) that drives real headless Chrome
  through login, country filtering, industry management, location/reference/news
  add/edit/remove, and logo flows.
- **No authentication (superseded).** There was no auth in the v0.1 scope; the
  app was intended as an internal lightweight backbone. **Added in Sprint 01:**
  email/password login with a bootstrap admin; the whole app now requires an
  authenticated session.

Remaining items:

- **Search is name-only.** List search is a case-insensitive substring match on
  the company `name` field only (an architecture decision).
- **Generated PDF text is CID-encoded on hosts with a Unicode font.** On macOS
  the summary is rendered with Arial Unicode, so the text is embedded in a way
  that is not human-greppable as plaintext; the file is still a valid `%PDF-1.3`
  and reflects current company data.
- **No delete-company UI in the SPA.** Company deletion is available through the
  API (and intended for automated workflows) but the SPA does not expose a
  delete button. Artifact delete is available from the profile.
- **`PUT` returns the list-item shape.** The update endpoint returns the same
  shape as `POST` (without the `artifacts` array), per an explicit human
  resolution; the SPA only consumes the fields it needs from the response.
- **Generate is enabled for incomplete companies.** The button is always active;
  generating for an incomplete company returns a `422` and the frontend renders
  the backend's failure message inline.
- **Uploads are read fully into memory** before being written to storage —
  acceptable for the lightweight backbone, but a streaming path may be needed for
  larger files.
- **SQLite autoincrement sequence is not reset when the seeded database is
  restored**; new ids continue after the highest ever used. Ids remain stable and
  monotonic, so this is cosmetic.
- **Sessions have no expiry (superseded).** Previously sessions persisted until
  logout or a database flush. **Added in Sprint 02:** sessions now have a
  defined server-side lifetime (default 7 days, `COMPANY_HUB_SESSION_TTL` to
  override) enforced by the fastapi-users stateful `DatabaseStrategy`, with
  immediate server-side revocation on sign-out.
- **No visual/pixel assertions.** Browser automation asserts behavior (DOM,
  rendering, flows) but not visual styling or PDF pixel rendering; screenshot/
  visual checks are a candidate future pass.
- **Admin-password test override is a documented seam.** The
  `COMPANY_HUB_ADMIN_PASSWORD` env override (used by the test suites) and
  `COMPANY_HUB_DB` are documented in `environment-notes.md`; the app's documented
  runtime path is the console-printed admin password, now created once and
  persisted (not re-randomized per restart). Documenting the override seam in
  `docs/architecture.md` is a candidate future pass.

**Sprint 02 additions:**

- **Fastapi-users contract deviations.** Login uses a JSON body
  (`{email, password}`) and returns `200 {access_token, token_type}` rather than
  the stock form-encoded flow; logout returns `204` even with no session
  (idempotent); `me` returns `{id, email, is_superuser}`. These are documented,
  deliberate deviations recorded by the Backend Engineer and verified as
  delivered.
- **`PATCH /api/auth/me` is declared but unused.** It is exposed for
  fastapi-users compatibility (password-only self-service); the SPA uses the
  dedicated `POST /api/auth/change-password` route instead, and no other profile
  fields are self-editable this sprint.
- **`oauth_accounts` is schema-only (superseded).** The OAuth-ready account table
  existed with zero rows and no OAuth login routes/SSO behavior. **Added in
  Sprint 03:** Google SSO consumes the `oauth_accounts` table as-is to link
  Google identities to accounts and auto-provision guest accounts (no data-model
  change was needed).
- **Stable admin credential.** The bootstrap admin password is now created once
  and persisted across restarts (not re-randomized per startup as in Sprint 01);
  it is only re-generated if the admin account is deleted.

**Sprint 03 additions:**

- **`me` returns `access_level`, not `is_superuser`.** The four-level
  `access_level` replaced the `is_superuser` boolean (versioned migration
  `0003_sprint03_roles`); the `me` payload is `{id, email, access_level}`. This
  is a deliberate, in-scope contract change (scope item s).
- **Role-gated data access.** Beyond session authentication, data routes are
  gated by `access_level`: reads require read-only+, writes and document
  generation require user+, and user management requires admin. Denials return
  `403 {"detail":"Insufficient access level"}` and keep the session.
- **SSO is not automated end-to-end.** The full Google sign-in is verified
  **manually** against real credentials (scope item o); automated checks cover
  the `providers` endpoint, the config-driven mounting of `authorize`/`callback`,
  and the `authorize`-issued signed-state URL. Until a human completes a real
  Google sign-in, SSO should be considered enabled-with-manual-verification.
- **Last-admin guardrail is present but unreachable.** Because the bootstrap
  admin is always `admin` and immutable, the last-remaining-admin backstop cannot
  be triggered through normal operations; the guard code is defensive and not
  covered by a dedicated test.
- **`/callback` returns `500` on fabricated input.** Probing the mounted callback
  with a bogus `code`/`state` under dummy credentials makes the OAuth token
  exchange fail before the state-validation `400` path runs; only reachable by
  fabricating input, so it is not a defect for the real flow.

## Recommended next actions

- **Multi-field search.** Broaden company search beyond name-only (industry,
  location, etc.).
- **Streaming uploads.** Stream larger uploads to storage instead of reading them
  fully into memory.
- **PDF plaintext embedding.** Investigate embedding PDF text so it is
  greppable as plaintext regardless of host font availability.
- **Visual / screenshot checks.** Extend the browser suite to assert visual
  styling and PDF pixel rendering.
- **Automated scraping workflows.** Reference, news, and logo scraping per scope
  boundaries n/q are out of scope; the storage and application interfaces
  already exist, so automated workflows can write these records later.
- **Document the admin-password seam in `docs/architecture.md`.** Record the
  `COMPANY_HUB_ADMIN_PASSWORD` test override alongside the documented
  printed-password flow.

Sprint 03 / future:

- **Complete a real Google sign-in end-to-end.** Per scope **o**, the SSO wiring
  is verified but the full Google flow is only manually confirmed; a human should
  exercise a real sign-in (including the guest auto-provision → admin elevation
  path) before production enablement.
- **Synthetic coverage for the last-admin guardrail.** Add a test that
  temporarily demotes the bootstrap admin to provoke the last-remaining-admin
  backstop, if that defensive path needs direct coverage.
- **Make the SSO callback fail cleanly on fabricated input.** The mounted
  `/callback` returns `500` on a bogus `code`/`state` (token exchange runs before
  state validation); validating state before the exchange would yield a clean
  `400`.
- **Document the `PATCH /api/auth/me` seam.** The route is implemented (password
  only) but unused by the SPA; record its availability/limits in
  `docs/architecture.md` for future use.
- **OAuth account-profile management.** Google SSO links identities and
  auto-provisions guest accounts, but there is no UI to manage linked OAuth
  identities or OAuth-created accounts beyond the admin user view; a future pass
  could surface these.

Completed since v0.1 (no longer open): **browser-automation verification** (now
a persistent CDP suite), **authentication** (added in Sprint 01, rebuilt on
fastapi-users in Sprint 02), **session expiry / server-side session lifetime**
(added in Sprint 02), **Google SSO login** (added in Sprint 03), and **superuser
admin UI** for account/role management (added in Sprint 03).
