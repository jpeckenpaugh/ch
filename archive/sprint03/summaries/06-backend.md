# Summary: Backend Engineer (Stage 6)

- **Date:** 2026-09-05
- **Author / Executor:** Backend Engineer (Sprint 03)
- **Instruction file:** `instructions/enhancements/06-backend.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 06: implement Sprint 03 backend (roles, admin user mgmt, Google SSO)`

## Work Completed

Implemented the Sprint 03 backend delta per `docs/architecture.md` §10 and the
four feature briefs (`01-role-based-access`, `02-admin-user-management`,
`03-google-sso-sign-in`, `04-sign-in-page-nav-fix`):

1. **Role-based access (`01`).** Replaced the single `is_superuser` boolean with
   the four-level `access_level` (`guest`/`read-only`/`user`/`admin`). Added
   `backend/auth/roles.py` with the level ordering and the
   `require_access(min_level)` / `get_current_admin` dependencies, and applied
   per-route gates to every data router (reads = `read-only`, writes + document
   generation = `user`, user management = `admin`). Denials are `403
   {"detail": "Insufficient access level"}`; `401` remains session-only.
2. **Admin user management (`02`).** Added admin-only `GET/PATCH/DELETE
   /api/auth/users{/id}` plus the modified `POST /api/auth/users` (takes
   `access_level`). Implemented the §10.2.4 guardrails: bootstrap admin
   immutable, no self role-change (self-deactivation permitted), and the
   last-remaining-admin backstop.
3. **Google SSO (`03`).** Added the always-mounted public `GET /api/auth/providers`
   and the env-driven `GET /api/auth/authorize` + `GET /api/auth/callback` custom
   flow (mounted only when Google credentials are present). The custom callback
   reuses `UserManager.oauth_callback` (`associate_by_email=True`,
   `is_verified_by_default=True`) and establishes the same cookie session as
   email/password, then `302`-redirects to `/`.
4. **Sign-in page nav fix (`04`).** Frontend-only (Stage 7); the backend's
   session semantics are unchanged, so the fix is unaffected.
5. **Schema.** New Alembic migration `0003_sprint03_roles` adds `access_level`
   (CHECK, temporary `DEFAULT 'guest'`), backfills from `is_superuser`, drops
   `is_superuser`. `models/user.py` updated to match. No dev-DB flush is needed.

## Outputs Produced / Modified

- `backend/alembic/versions/0003_sprint03_roles.py` — new versioned migration.
- `backend/models/user.py` — `access_level` replaces `is_superuser` (modified).
- `backend/auth/roles.py` — new: level constants/ordering + role-gate deps.
- `backend/auth/providers.py` — new: `GET /api/auth/providers` + Google client.
- `backend/auth/oauth.py` — new: custom authorize/callback router.
- `backend/auth/routers.py` — `me` payload, `POST /users`, and the
  `GET/PATCH/DELETE /users` management + guardrails (modified).
- `backend/auth/schemas.py` — `UserRead`/`UserCreate` `access_level`,
  `UserManagementRead`/`UserManagementUpdate` (modified).
- `backend/auth/dependencies.py` — dropped `get_current_superuser` (modified).
- `backend/auth/managers.py` — bootstrap admin created with `access_level='admin'`.
- `backend/auth/strategies.py` — session cookie honors
  `COMPANY_HUB_SECURE_COOKIES` (modified).
- `backend/config.py` — SSO env helpers (`secure_cookies`, `google_sso_configured`,
  `google_sso_state_secret`) (modified).
- `backend/app.py` — mounts providers always, SSO router when configured,
  per-route role gates (modified).
- `backend/routers/*` — every data route gained its `require_access` gate.
- `tests/backend/test_auth.py`, `test_seed.py` — updated to the new contract;
  `tests/backend/test_roles.py` — new (roles, admin user mgmt, guardrails, SSO
  wiring). All 81 backend tests pass.

## Key Decisions

- **Single 403 message.** Both the role gates and the admin gate return `403
  {"detail": "Insufficient access level"}` (`get_current_admin` is implemented
  as `require_access(ADMIN)`), approved by the human.
- **Per-route gating.** Removed the router-level `[Depends(get_current_user)]`
  in `app.py`; each route now depends on `require_access(...)`, which itself
  depends on `get_current_user` (so `401` on no/invalid session, then `403` on
  out-of-level).
- **Migration mechanics (SQLite).** Added `access_level` `NOT NULL` with an
  embedded `CHECK` and a temporary `DEFAULT 'guest'` (SQLite can't `ADD
  CONSTRAINT`), backfilled via `UPDATE` from `is_superuser`, then dropped
  `is_superuser`. Verified the upgrade path on a populated Sprint 02 database.
- **State secret.** `COMPANY_HUB_OAUTH_STATE_SECRET`, else the Google client
  secret (§10.8.11). CSRF cookie uses stock fastapi-users conventions
  (`fastapiusersoauthcsrf`, 1-hour lifetime).
- **Secure cookies.** `COMPANY_HUB_SECURE_COOKIES=1` makes both the session and
  OAuth CSRF cookies `Secure`; default off for dev http (approved).
- **Environment refresh.** Re-ran `pip install -r requirements.txt` to bring
  `httpx-oauth` into the venv so the SSO modules are importable.

## Open Questions & Concerns

- **Last-admin guardrail is unreachable in practice.** Because the bootstrap
  admin is always `admin` and immutable, the §10.2.4 "last remaining admin"
  backstop cannot be triggered through normal operations (there is always at
  least one admin). The guard code is present and defensive; it is not covered
  by a test that provokes it.
- **SSO end-to-end flow is not automated.** Per Brief 03 / §10.7, SSO is
  verified manually against real Google credentials. I tested the providers
  endpoint and the router-mounting/authorize wiring but did not exercise a real
  Google sign-in.
- **Guardrail ordering.** The bootstrap-admin immutability check runs before the
  self-role-change check, so an admin who *is* the bootstrap admin hitting their
  own level gets the "bootstrap admin cannot be modified" `400` (correct, since
  the bootstrap admin is also immutable to itself).
- **`admin@localhost` uses a dot-less domain.** Email validation remains a light
  `@`-contains check (existing behavior) so the bootstrap admin address is
  accepted; this is unchanged from Sprint 02.

## Status

- [x] Complete
- [ ] Needs review