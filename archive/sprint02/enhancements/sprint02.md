# Sprint 02 — Concept

## Scope

This pass rebuilds the application's persistence on a maintained ORM
(SQLAlchemy) with a versioned migration story (Alembic) and replaces the
hand-rolled authentication with the maintained fastapi-users library, keeping
the existing cookie-based sign-in experience. The goals are code maintainability
(no hand-managed SQL), an auth foundation that supports the ecosystem libraries,
and a data model that a future Google-SSO sprint can extend without rework. This
pass is delivered in a single sprint.

Stack choices here are deliberate and recorded; this document stays at the
product level and does not specify routes, schemas, or implementation detail.
The application remains an internal lightweight backbone, not a full CRM.

## Persistence foundation

- **a. Feature** — Persist through a maintained ORM (SQLAlchemy) instead of
  hand-written SQL, so application code reads and writes via models rather than
  manual SQL strings.
- **b. Feature** — Add a schema migration mechanism (Alembic) so model changes
  are versioned migrations rather than destroy-and-reseed.
- **c. Constraint** — Non-auth application behavior is preserved exactly: every
  existing API contract, response, and semantic stays as-is; object storage
  (file bytes on disk, metadata in the database) and document generation are
  unchanged.
- **d. Constraint** — Persistence becomes async-native to satisfy the auth
  library's requirements; CPU-bound and file-bound work is kept off the request
  loop so it does not block responsiveness.
- **e. Boundary** — No persistence features beyond the ORM/migration foundation;
  seed content and seeding rules are unchanged.

## Authentication

- **f. Feature** — Replace the hand-rolled login with a maintained auth library
  (fastapi-users): sign-in, sign-out, current-user, and password change.
- **g. Constraint** — The cookie-based sign-in experience is preserved: an
  HttpOnly session cookie, a login screen for unauthenticated users, and all
  application routes gated by an authenticated session.
- **h. Feature** — Sessions have a defined lifetime (expiry) while remaining
  stored server-side, so sign-out and revocation work as today.
- **i. Feature** — Multiple user accounts with stable credentials are supported.
- **j. Constraint** — The development environment boots a stable admin account
  (replacing per-startup password regeneration); additional accounts are
  admin-created, not self-service signup (preserving the earlier no-signup
  boundary).
- **k. Feature (schema-only)** — The account model includes the fields needed
  for external identity providers (an OAuth accounts table) so Google SSO can be
  added in a later sprint without a data-model change; no OAuth login routes are
  added this sprint.

## Cross-cutting

- **l. Constraint** — No non-auth functionality regresses; deliberate changes
  are limited to authentication and the persistence layer underpinning it.
- **m. Constraint** — The existing backend and browser test suites pass, except
  checks updated for the deliberate auth changes; new checks cover password
  change, multiple users, and session expiry.
- **n. Constraint** — The current dev database under `data/` may be flushed once
  to establish the migration baseline (mirrors Sprint 01 item u); repo-tracked
  content is not deleted or regressed.
- **o. Constraint** — The development runtime remains on the current modern
  Python 3.12 interpreter; no interpreter change is in scope for this pass (the
  deprecated system Python 3.9 is not used).