# Sprint 03 — Concept

## Scope

This pass builds on the Sprint 02 fastapi-users foundation to add (1) a
role-based access model, (2) a superuser admin interface for managing user
accounts and their roles, and (3) Google sign-in (SSO) as an alternative login.
It also fixes a small sign-in page UX issue (the top navigation bar showing for
unauthenticated users). The application remains an internal lightweight
backbone, not a full CRM.

This document is the single authoritative source for the pass. Items are
lettered and tagged **Feature** / **Constraint** / **Boundary**; nothing here is
dropped by downstream stages. It stays at the product level — no API routes,
schemas, or implementation choices.

## Roles & access

- **a. Feature** — User accounts carry an access level: **guest**,
  **read-only**, **user**, or **admin** (admin = superuser).
- **b. Feature** — The UI and API respect the account's level: guests see an
  empty/blocked view until elevated, read-only users can view but not edit,
  users have the current full view/edit access, and admins additionally get
  account management.
- **c. Constraint** — Auto-provisioned Google SSO accounts start at **guest**
  and see an empty/blocked view until an admin elevates them. Existing
  manually-created accounts keep full user access by default. The bootstrap
  admin is an **admin**.
- **d. Boundary** — Role changes are admin-only; a user cannot change their own
  level (they may still change their own password).

## User management (admin)

- **e. Feature** — An admin can view all user accounts and their access levels.
- **f. Feature** — An admin can create accounts, set an initial password and
  level, and change a level afterward (incl. elevate guest/read-only users).
- **g. Feature** — An admin can activate/deactivate and delete an account.
- **h. Constraint** — Only admins can access user management; it is hidden from
  and denied to non-admins.
- **i. Constraint** — Safeguards protect the system: the last admin cannot be
  demoted or deleted, and the bootstrap admin cannot be locked out.
- **j. Boundary** — No self-service signup or self-service profile editing;
  account creation and role changes remain admin-only.

## Google SSO

- **k. Feature** — Add "Sign in with Google" as an alternative to email/password.
- **l. Constraint** — SSO is config-driven and optional: active only when OAuth
  credentials are provided; the app works fully self-contained otherwise, and
  the SSO option appears on the login screen only when enabled.
- **m. Feature** — A Google sign-in authenticates the user, establishes the
  same cookie session as email/password, links the Google identity to the
  account, and auto-provisions a guest account when the email is unknown.
- **n. Constraint** — Existing cookie-based sessions, route gating, and
  email/password login are unchanged.
- **o. Boundary** — Google is the only external provider this sprint. Local
  development may run SSO over plain HTTP (dev-only relaxation of the OAuth
  secure-cookie default). SSO is verified manually against real Google
  credentials (no automated SSO checks).

## Sign-in UI

- **p. Feature** — Hide the entire top navigation bar (brand, menu links, and
  toggler) when a user is not signed in; it appears only once an authenticated
  session exists.

## Cross-cutting

- **q. Constraint** — No non-auth functionality regresses; existing suites
  pass, with updates only for the deliberate role/access changes; new checks
  cover role gating and user management.
- **r. Constraint** — SSO credentials/secrets come from environment variables,
  never committed; the console-printed bootstrap-admin flow is unchanged.
- **s. Constraint** — Introducing the role field is a deliberate, in-scope data
  change applied through a versioned migration; the `oauth_accounts` table is
  consumed as-is.