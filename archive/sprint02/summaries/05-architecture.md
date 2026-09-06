# Summary: Architect (Stage 5)

- **Date:** 2026-09-04
- **Author / Executor:** opencode (Stage 5 role)
- **Instruction file:** `instructions/enhancements/05-architecture.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 05: architecture additions for sprint 02`

## Work Completed

Extended the existing `docs/architecture.md` with a Sprint 02 enhancement
section (§9) defining the technical shape for the backend (Stage 6) and frontend
(Stage 7) engineers. The section covers the move to async SQLAlchemy + Alembic
and the replacement of the hand-rolled Sprint 01 auth with the maintained
fastapi-users library using the stock stateful `DatabaseStrategy` +
`CookieTransport`. The existing v0.1 and Sprint 01 specification (§1–§8) was
left intact; the additions mark precisely what is superseded (the `sessions`
table and §8.2.1 auth) and what remains in force.

## Outputs Produced / Modified

- `docs/architecture.md` — **modified** (extended). Added §9 "Sprint 02
  Enhancements — Architecture Additions" with:
  - §9.1 Data model & schema changes: `users` (IntegerPK + `is_active`/
    `is_superuser`/`is_verified`, pwdlib hashing); new `access_tokens` (replaces
    `sessions`) with `lifetime_seconds`; new schema-only `oauth_accounts`.
  - §9.2 API contract changes: fastapi-users routes under `/api/auth`
    (login/logout/me), new `POST /api/auth/change-password`, and superuser-only
    `POST /api/auth/users`; non-auth contracts explicitly unchanged.
  - §9.3–§9.6 project/file-structure additions, module boundaries, backend/
    frontend responsibility changes, and component/state-flow changes.
  - §9.7 explicitly unchanged / out of scope.
  - §9.8 open design decisions / contract notes for downstream engineers.
- `instructions/enhancements/summaries/05-architecture.md` — new summary.

## Key Decisions

- **Stateful `DatabaseStrategy`, not `JWTStrategy`** (authoritative correction):
  tokens are persisted in an `access_tokens` table keyed to the user; expiry via
  `lifetime_seconds`; logout deletes the token row (immediate server-side
  revocation). This satisfies scope **h** with the stock library — no custom
  session store.
- **Session lifetime:** fixed absolute lifetime, default 7 days, env override
  `COMPANY_HUB_SESSION_TTL`; re-login on expiry; cookie `Max-Age` matches.
- **Integer user id** (`IntegerPK`) for consistency with the app's PKs, not
  fastapi-users' default UUID.
- **Cookie name** preserved as `session` (Sprint 01 continuity) via
  `CookieTransport` config (HttpOnly, SameSite=Lax, not Secure on dev http).
- **`users` schema:** adds `is_active`/`is_superuser`/`is_verified`; the
  bootstrap admin and admin-created accounts are `is_verified = 1`.
- **Stable idempotent admin bootstrap** (supersedes §8 per-startup
  re-randomization); password from `COMPANY_HUB_ADMIN_PASSWORD` or generated once.
- **`me` payload** is `{ id, email, is_superuser }`.
- **Self password change** via `POST /api/auth/change-password` (UserManager);
  superuser resetting others is out of scope.
- **Admin account creation** via superuser-only `POST /api/auth/users`; register
  router not mounted (no self-service signup); no SPA admin UI this sprint.
- **`oauth_accounts`** schema-only, Google-oriented, with
  `UNIQUE(user_id, oauth_name)` and `UNIQUE(oauth_name, account_id)`.
- **Alembic baseline:** the Sprint 01 schema is the initial migration revision;
  the dev DB under `data/` is flushed once (scope **n**) by Stage 6.

## Open Questions & Concerns

- None blocking. All items previously flagged (question 1 on DatabaseStrategy vs
  scope **h**) were resolved by the run's decision-maker; the accepted decisions
  above are recorded in §9.8 for downstream roles.
- Flagged for downstream stages (not blocking): the one-time dev-DB flush
  (scope **n**) is a Stage 6 operator action to establish the migration baseline;
  verification (Stage 8) must account for the auth test-suite updates and new
  checks (password change, multiple users, session expiry) per scope **m**.
- The `PATCH /api/auth/me` route is declared available for fastapi-users
  compatibility but not used by the SPA this sprint; the only self-service field
  update is password via `change-password`.

## Status

- [x] Complete
- [ ] Needs review