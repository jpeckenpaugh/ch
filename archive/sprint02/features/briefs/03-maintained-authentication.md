# Brief: Maintained Authentication

## Purpose

Replace the hand-rolled login with a maintained authentication library
(fastapi-users) that provides sign-in, sign-out, current-user, and password
change, while preserving the existing cookie-based sign-in experience. Users
sign in the same way they do today, but the auth plumbing is now maintained and
supports stable accounts, session expiry, and future ecosystem additions.

## Expected Behavior

1. **Sign-in:** An unauthenticated user is shown the login screen. Entering a
   valid email and password establishes an authenticated session carried in an
   HttpOnly session cookie. Invalid credentials are rejected without
   authenticating.
2. **Sign-out:** A signed-in user can end their session. The session is
   invalidated server-side and the cookie is cleared; the user is returned to
   the unauthenticated state. Sign-out remains idempotent (as today).
3. **Current user:** The app can identify the signed-in user and uses that to
   gate routes and render the appropriate view.
4. **Password change:** A signed-in user can change their own password through
   a small password-change form in the SPA. After the change, the user can sign
   in with the new password and the old password no longer works.
5. **Route gating:** All application routes are gated by an authenticated
   session; unauthenticated users are shown the login screen (as today).
6. **Session storage:** Sessions are stored server-side with a defined lifetime
   (see brief "Session Lifetime Management"), so sign-out and revocation work
   as today.
7. **Credential storage:** Passwords are stored through the maintained library's
   hashing; the current per-startup password regeneration is removed and
   replaced by a stable admin account (see brief "User Account Management").
8. **Multiple accounts:** More than one user can sign in, each with their own
   stable credentials (see brief "User Account Management").

## Inputs / Outputs

- **Inputs:** Email and password at sign-in; the current password and a new
  password at password change.
- **Outputs:** An authenticated session (HttpOnly session cookie) on successful
  sign-in; a cleared/invalidated session on sign-out; the signed-in user's
  identity via current-user; an updated credential after password change.

## User-Visible Behavior

- The login screen and cookie-based sign-in experience are unchanged.
- New: a signed-in user can open a small password-change form and update their
  own password.
- All other screens and behaviors are unchanged; unauthenticated users still see
  the login screen and cannot access the app.

## Constraints

- The cookie-based sign-in experience is preserved: an HttpOnly session cookie,
  a login screen for unauthenticated users, and all application routes gated by
  an authenticated session.
- Sign-in, sign-out, and current-user behave as today; no other API contract
  changes except the deliberate auth changes.
- No self-service signup; additional accounts are admin-created (see brief
  "User Account Management").
- Sessions have a defined server-side lifetime with working sign-out and
  revocation (see brief "Session Lifetime Management").
- Admin resetting another user's password is out of scope this sprint.

## Basic Acceptance Expectations

- A user can sign in with valid credentials and access the app.
- An unauthenticated user sees the login screen and cannot access gated routes.
- Sign-out ends the session and clears the cookie; a signed-out user must sign
  in again.
- A signed-in user can change their own password; the new password signs in and
  the old password no longer does.
- The existing backend and browser test suites pass (updated for the deliberate
  auth changes), with new checks covering password change.