# Environment Notes (Stage 4 — System Engineer)

## Target runtime

- **Python 3.12** (3.11+ acceptable). The environment assumes a 3.11+
  interpreter is already installed (`python3.12` preferred, falls back to
  `python3.11`); it is not bootstrapped by the scripts.
- **OS:** macOS / Linux, POSIX shells. `install.sh` and `run.sh` are Bash and
  are not expected to work on Windows.

## Provisioning

- `./install.sh` creates a project-local virtual environment at `.venv/`,
  upgrades pip, and installs the exact-pinned dependencies from
  `requirements.txt`.
- `./run.sh` starts the application with the provisioned environment:
  `uvicorn backend.app:app --host 127.0.0.1 --port 8000`.
- This entry-point contract (`backend.app:app`) is handed to the Architect
  (Stage 5) and Backend (Stage 6) stages; they must provide it.

## Dependencies and their role

| Package                        | Role                                                                    |
|--------------------------------|-------------------------------------------------------------------------|
| `fastapi`                      | Web/API framework for the backend                                       |
| `uvicorn`                      | ASGI server used to run the app                                         |
| `python-multipart`             | Required by FastAPI for multipart file uploads (Brief 04)               |
| `fpdf2`                        | Simple, clean PDF generation for derived documents (Brief 05)           |
| `sqlalchemy[asyncio]`          | Maintained ORM (Sprint 02, scope **a**); async-native persistence       |
| `alembic`                      | Versioned schema migrations (Sprint 02, scope **b**)                    |
| `aiosqlite`                    | Async SQLite driver backing async SQLAlchemy (scope **d**)              |
| `fastapi-users[sqlalchemy,oauth]` | Maintained auth library (Sprint 02, scope **f**); `[oauth]` extra enabled in Sprint 03 for Google SSO (Brief 03) |
| `fastapi-users-db-sqlalchemy`  | SQLAlchemy adapter pulled by the `fastapi-users[sqlalchemy]` extra      |
| `httpx-oauth`                  | Google OAuth2 client flow used by the `[oauth]` extra (Sprint 03, Brief 03) |
| `httpx`                        | HTTP client required by `httpx-oauth`; also the client used by FastAPI's `TestClient` (runtime since Sprint 03; was dev-only before) |
| `pwdlib[argon2,bcrypt]`        | Password hashing backend used by fastapi-users (replaces hand-rolled PBKDF2) |
| `email-validator`              | Required by fastapi-users for email validation                         |
| `makefun`                      | Required by fastapi-users (route generation)                           |
| `pyjwt[crypto]`                | Required by fastapi-users (JWT signing)                                |

## Storage

- **Database:** SQLite, now accessed through async SQLAlchemy via `aiosqlite`
  (Sprint 02). No external database server or driver beyond `aiosqlite`.
- **Object storage:** local filesystem. The local database and stored
  file/artifact objects live under `data/` (or wherever the Architect places
  them). `data/` is gitignored; nothing runtime-written should be committed.
- No external services (S3, database servers) are provisioned.

### Environment overrides

Two environment variables make the storage root and the admin bootstrap
deterministic, which the persistent test suites rely on:

- `COMPANY_HUB_DB` — if set, the SQLite database is created at that exact path
  and stored artifact bytes co-locate under `<dir of DB>/artifacts/`. When
  unset, the app uses the default `data/company_hub.db` + `data/artifacts/`.
- `COMPANY_HUB_ADMIN_PASSWORD` — if set, `bootstrap_admin` uses this as the
  admin password instead of generating a fresh random one on every startup.
  When unset, behavior is unchanged (a new random password is printed at boot).

## Testing

Dev-only test dependencies (nothing in `requirements.txt` is a test dependency):

```
.venv/bin/pip install -r requirements-dev.txt
```

The pinned dev deps are `pytest` (runner) and `httpx` (needed by FastAPI's
`TestClient`).

- **Backend suite** — persistent in-process pytest tests against throwaway
  temp databases (never touches `data/`):
  `.venv/bin/python -m pytest tests/backend -q`
- **Browser suite** — persistent CDP tests that drive a real headless Chrome:
  `node --test --test-concurrency=1 "tests/browser/*.test.mjs"` (requires a
  running uvicorn and Chrome on `--remote-debugging-port=9222`).
- **Everything** — `./tests/run.sh` runs both suites: it launches uvicorn with
  a throwaway DB under `tmp/` and headless Chrome, runs the browser tests, then
  tears both down. Logs land under `tmp/` (gitignored); the real `data/` is
  never touched.

The browser tests read `COMPANY_HUB_URL` (default `http://127.0.0.1:8000`) and
`COMPANY_HUB_ADMIN_PASSWORD` (default `test-admin-password`).

## Caveats

- `python-multipart` is required for FastAPI file uploads; do not remove it
  while Brief 04 is in scope.
- `fpdf2` was selected for PDF generation because it is lightweight,
  pure-Python, and has no system-level dependencies. Its role is limited to
  producing derived documents; exact format/contents remain an architecture
  (Stage 5) decision.
- `run.sh` currently expects the backend entry point to exist; running it
  before Stage 6 will fail at import time.

## Sprint 01 — manual dev-data flush (Stage 5 note)

This sprint rebuilds the data model (new tables: industries, countries, users,
sessions, locations, references, news_articles; `companies` drops `hq_location`
and the free-form `industry`). The v0.1 SQLite database is **not** migrated.
Per scope item u, flush the gitignored dev runtime state once before the first
run of the new build (performed by Stage 6):

```
rm -f data/company_hub.db && rm -rf data/artifacts
```

The app seeds only when the `companies` table is empty and never destroys data
on a normal restart. `data/` is gitignored, so no repository history is
affected.

## Sprint 02 — migration baseline flush (Stage 6 note)

Sprint 02 rebuilds persistence on SQLAlchemy (async) with versioned Alembic
migrations, and replaces the auth model with fastapi-users (new users/sessions
tables and an OAuth-accounts table per scope item **k**). Per scope item **n**,
the v0.1 SQLite database is **not** migrated; it may be flushed once to
establish the migration baseline. Mirroring the Sprint 01 flush (performed by
Stage 6), flush the gitignored dev runtime state once before the first run of
the new build:

```
rm -f data/company_hub.db && rm -rf data/artifacts
```

After this baseline, schema changes are applied as versioned migrations, not
destroy-and-reseed (scope **b**). `data/` is gitignored, so no repository
history is affected.

## Sprint 03 — Google SSO environment (Stage 5/6 note)

Sprint 03 adds an optional **Sign in with Google** flow (Brief 03). SSO is
config-driven: it is active only when the credentials below are present, and
otherwise the app is fully self-contained (email/password only). The feature
uses the `[oauth]` extra of `fastapi-users` (`httpx-oauth`), which makes `httpx`
a runtime dependency.

OAuth configuration is read from environment variables. Secrets are never
committed (`.env` is gitignored):

| Variable                             | Purpose                                                 |
|--------------------------------------|---------------------------------------------------------|
| `COMPANY_HUB_GOOGLE_CLIENT_ID`       | Google OAuth client ID; presence enables the SSO option |
| `COMPANY_HUB_GOOGLE_CLIENT_SECRET`   | Google OAuth client secret                               |

Dev redirect URI to register in the Google OAuth console ("Authorized redirect
URIs"): `http://127.0.0.1:8000/api/auth/callback`. Local development may run
the SSO flow over plain HTTP (dev-only relaxation of the secure-cookie default,
Brief 03 item 7); production keeps the secure default. The exact callback path
is finalized by the Architect/Backend stages and must match the console entry.

No DB flush is needed for Sprint 03: the `oauth_accounts` table already exists
from Sprint 02 (schema-only), and the users access-level column is added by a
normal Alembic migration. Schema changes continue to be applied as versioned
migrations, not destroy-and-reseed.
