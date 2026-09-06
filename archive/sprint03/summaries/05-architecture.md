# Summary: Architect (Stage 5)

- **Date:** 2026-09-05
- **Author / Executor:** opencode (deepseek-v4-flash)
- **Instruction file:** `instructions/enhancements/05-architecture.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 05: extend architecture for roles, admin user management, and Google SSO`

## Work Completed

Appended a Sprint 03 enhancement section (§10) to `docs/architecture.md`,
extending the existing §1–§9 specification with the deltas for the four Sprint 03
briefs: the four-level role/access model, the admin user-management API, the
optional Google SSO flow, and the sign-in navigation fix. The v0.1/Sprint 01/02
specifications are untouched; §10 supersedes only the specific Sprint 02 `users`
schema and auth-payload contracts it names.

## Outputs Produced / Modified

- `docs/architecture.md` — **extended** with `## 10. Sprint 03 Enhancements`:
  - §10.1 data/schema changes — `users.access_level` (TEXT, CHECK, model default
    `guest`), `is_superuser` dropped, versioned migration `0003` backfill
    (superuser→admin, others→user, bootstrap admin forced admin), level ordering
    (guest < read-only < user < admin); `oauth_accounts` consumed as-is; no DB
    flush.
  - §10.2 API contract changes — role gating matrix on every existing data route
    (`403` denials; guest=no data access, read-only=reads only incl. document
    generation denied, user=full, admin=+user management); `me` payload becomes
    `{id, email, access_level}`; `POST /api/auth/users` takes `access_level`;
    new admin user management (`GET`/`PATCH`/`DELETE /api/auth/users`) with
    guardrails; new public `GET /api/auth/providers` and optional
    `GET /api/auth/authorize` + `GET /api/auth/callback`.
  - §10.3/10.4 project structure + module boundary changes (`backend/auth/roles.py`,
    `providers.py`, `oauth.py`, migration `0003`, frontend `users.js` etc.).
  - §10.5/10.6 backend/frontend responsibilities + component/state-flow changes
    (SSO callback → session cookie → `302` to `/`; guest blocked view; nav
    hidden when unauthenticated).
  - §10.7 explicitly unchanged/out of scope; §10.8 design decisions/notes.
- `instructions/enhancements/summaries/05-architecture.md` — **new**; this summary.

## Key Decisions

- **Role replaces `is_superuser`**: a single `access_level` column (guest /
  read-only / user / admin) replaces the boolean, with `admin` as the superuser
  tier; every Sprint 01/02 superuser gate site moves to the admin level, and the
  `me`/user-management payloads expose `access_level`.
- **`403`, not `401`, for out-of-level requests**, so the SPA treats them as
  "action not permitted" rather than logging the user out.
- **Document generation is a write** (denied for read-only); guests are
  authenticated but have no data access at all.
- **Guardrails** are enforced by the API on every level/active/delete mutation:
  bootstrap admin (`admin@localhost`) immutable, last-admin demote/delete
  refused (defensive backstop), admins cannot change their own level,
  deactivation of the last non-bootstrap admin permitted.
- **SSO**: env-driven and optional; custom callback reusing
  `UserManager.oauth_callback` + the existing `DatabaseStrategy`/`CookieTransport`
  that sets the same session cookie and `302`-redirects to `/`; auto-provisioned
  accounts default to guest/active/verified with a generated password. New env
  vars `COMPANY_HUB_OAUTH_STATE_SECRET` and `COMPANY_HUB_SECURE_COOKIES=1`
  (production secure-cookie toggle).
- **Sign-in nav fix** is frontend-only: the whole `<nav>` is hidden when there is
  no session, shown when a session exists.

## Open Questions & Concerns

- **Stage 4 deviation:** §10.8 item 10 notes that the custom SSO callback differs
  from the Stage 4 assumption that the stock `get_oauth_router` callback response
  would be used. The URL path `/api/auth/callback` is unchanged, so the Stage 4
  Google-console redirect registration stands; the Backend (Stage 6) should keep
  that path exactly.
- **SSO-provisioned password gap:** auto-provisioned accounts hold a generated
  password and effectively cannot use `change-password`; no password-set flow
  exists this sprint (approved). Backend should ensure the generated-password
  path is exercised so `password_hash` stays non-null.
- **Cookie security:** `COMPANY_HUB_SECURE_COOKIES=1` must be set in production
  for both the session cookie and the OAuth CSRF cookie; the Backend should apply
  the toggle at both `CookieTransport` and the OAuth CSRF cookie.
- **Migration:** Stage 6 must add `0003_sprint03_roles` and update the bootstrap
  admin creation to set `access_level = 'admin'`; the existing test assertions on
  `me` (`{id, email, is_superuser}`) and `POST /api/auth/users` will need the
  deliberate contract updates Stage 8 expects.

## Status

- [x] Complete
- [ ] Needs review