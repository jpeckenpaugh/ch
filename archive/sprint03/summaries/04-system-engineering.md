# Summary: System Engineer (Stage 4)

- **Date:** 2026-09-05
- **Author / Executor:** opencode (deepseek-v4-flash)
- **Instruction file:** `instructions/enhancements/04-system-engineering.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 04: enable Google SSO dependencies and document OAuth env`

## Work Completed

Reassessed the Sprint 03 environment against the four feature briefs. Only
Brief 03 (Google SSO) touches the environment: it reverses the Sprint 02
decision to keep `fastapi-users` on the `[sqlalchemy]` extra only, and it
introduces config-driven OAuth credentials. The other three briefs (role-based
access, admin user management, sign-in nav fix) are pure application behavior
and required no environment change.

## Outputs Produced / Modified

- `requirements.txt` — modified: `fastapi-users[sqlalchemy]` → `fastapi-users[sqlalchemy,oauth]` and added pinned transitive deps `httpx-oauth==0.17.0` and `httpx==0.28.1`, reversing the "no [oauth] this sprint" note.
- `requirements-dev.txt` — modified: removed the dev-only `httpx==0.28.1` pin (now a runtime dependency via the `[oauth]` extra); `pytest==9.1.1` retained.
- `environment-notes.md` — modified: updated the dependency table for the new auth extra and added a Sprint 03 section documenting the OAuth env vars and redirect URI, plus a no-flush note.
- `install.sh`, `run.sh`, `.gitignore` — unchanged (no edits needed; `.env` already gitignored, external env injection suffices for OAuth config).

## Key Decisions

- **Dependency form:** enabled Google SSO through the maintained library's own
  `[oauth]` extra (`httpx-oauth>=0.13`) rather than hand-rolling an OAuth
  client, and pinned the transitives (`httpx-oauth==0.17.0`, `httpx==0.28.1`)
  for reproducibility per the file's existing convention. Verified resolution:
  only `httpx-oauth` is newly installed; no version conflicts.
- **httpx pin ownership:** `httpx` is now a runtime dependency, so the runtime
  pin (`==0.28.1`, satisfying `httpx-oauth`'s `httpx>=0.18`) wins; the
  dev-only duplicate in `requirements-dev.txt` was removed to avoid dual-source
  drift. `httpx` also remains the client used by FastAPI's `TestClient`.
- **OAuth env contract:** named `COMPANY_HUB_GOOGLE_CLIENT_ID` and
  `COMPANY_HUB_GOOGLE_CLIENT_SECRET` and documented the dev redirect URI
  `http://127.0.0.1:8000/api/auth/callback` (matches fastapi-users'
  `get_oauth_router` mounting `/callback` under the existing `/api/auth`
  prefix). Secrets stay out of the repo via the already-gitignored `.env`.
- **No script changes:** `run.sh` unchanged — OAuth credentials are supplied
  externally (exported vars or `.env` sourced by the shell); `install.sh`
  unchanged since the new deps install through the same `pip -r` step.

## Open Questions & Concerns

- The exact callback path is an Architect/Backend (Stages 5/6) decision; the
  documented redirect URI assumes fastapi-users' `get_oauth_router` is mounted
  at `/api/auth` with the default `/callback` route. If Stages 5/6 mount it
  elsewhere, the Google console redirect URI must be updated to match.
- Stages 5/6 should confirm the Google client is configured in the console with
  that redirect URI and that the dev-only plain-HTTP relaxation (Brief 03
  item 7) is applied at the cookie/OAuth layer only.
- No DB flush is required for Sprint 03 (`oauth_accounts` exists from Sprint 02;
  the users access-level column lands via a normal Alembic migration).

## Status

- [x] Complete
- [ ] Needs review