# Brief: User Account Management

## Purpose

Support multiple user accounts with stable credentials, replacing the current
single admin whose password is regenerated on every startup. The environment
boots a stable admin (superuser) account whose credentials persist across
restarts; additional accounts are admin-created, not self-service signup.

## Expected Behavior

1. Multiple user accounts can coexist, each with its own stable email and
   password credentials that persist across restarts.
2. The bootstrap admin account is created idempotently — created only when it
   does not already exist. Its password comes from the existing environment
   override (`COMPANY_HUB_ADMIN_PASSWORD`) or is generated and printed at
   creation. Thereafter the credential persists in the database and is **not**
   re-randomized on later restarts.
3. The bootstrap admin is a superuser; the superuser distinction is what
   authorizes account creation and admin functions.
4. Only superusers may create additional accounts. Account creation is done
   through the application's API (library-backed user management); there is no
   self-service signup.
5. Non-superuser accounts have no admin functions: they cannot create accounts
   and have no other administrative capabilities.
6. A created account can sign in with its own credentials and is subject to the
   same session and password-change behavior as any other account.

## Inputs / Outputs

- **Inputs:** Admin (superuser) credentials used to create a new account, and
  the new account's email and password.
- **Outputs:** A new user account with stable credentials that can sign in; a
  stable, persistent admin account available on every boot.

## User-Visible Behavior

- There is no signup UI; account creation is admin-only via the application's
  API. A SPA admin UI for account creation is out of scope this sprint.
- The app always has a stable admin account to sign in with; the admin password
  no longer changes on every restart.
- Multiple users can each sign in with their own stable credentials.

## Constraints

- Additional accounts are admin-created, not self-service signup (preserving
  the existing no-signup boundary).
- Only superusers may create accounts; non-superusers have no admin functions.
- The bootstrap admin is created idempotently; its credential persists and is
  not re-randomized on restart.
- The development environment boots a stable admin account.
- No non-auth functionality regresses.

## Basic Acceptance Expectations

- The bootstrap admin account exists after the first boot, and its credentials
  persist across restarts (no re-randomization).
- A superuser can create another account through the API, and that account can
  sign in with its own credentials.
- A non-superuser cannot create accounts or access admin functions.
- No self-service signup exists.
- The existing backend and browser test suites pass (updated for the deliberate
  auth changes), with new checks covering multiple users.