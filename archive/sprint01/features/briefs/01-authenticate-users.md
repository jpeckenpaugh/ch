# Brief: Authenticate Users

## Purpose

Require every user of the application to sign in with an email address and
password before using any part of it. This keeps the internal firm data behind
an authenticated session. Because there is no signup flow this sprint, the app
boots a single initial user so it is usable immediately on the local
development server.

## Expected Behavior

1. The application starts with a single bootstrapped user account
   (`admin@localhost`) whose password is a complex, auto-generated value.
2. On dev-server startup, the generated password is printed to the console so
   the operator can sign in.
3. Every route/area of the application requires an authenticated session; an
   unauthenticated user cannot view any application content and is redirected
   to the login screen.
4. A user signs in by entering their email address and password.
5. On successful sign-in the user gains a session and can use the application.
6. On failed sign-in (unknown email or wrong password) the user is shown an
   error and remains unauthenticated.
7. A signed-in user can end the session with a logout action, after which the
   application again requires sign-in to be used.

## Inputs / Outputs

- **Inputs:** Email address and password entered on the login screen; a logout
  request from a signed-in user.
- **Outputs:** An authenticated session (or an explicit login error); a
  terminated session on logout.

## User-Visible Behavior

- The user sees a login screen when not authenticated and is not able to reach
  application content otherwise.
- The user enters email and password, and either reaches the application (on
  success) or sees a clear error (on failure).
- The console shows the bootstrapped admin password on dev-server startup.
- The user can log out and is returned to the login screen.

## Constraints

- No self-service signup, roles/permissions, password reset, or multi-user
  administration this sprint; the bootstrap admin is the only user.
- The password is complex and auto-generated; it is surfaced only in the
  console at startup and is not hard-coded in the repository.
- All application routes are protected by the authenticated session; the login
  screen itself is the only accessible entry point for an unauthenticated user.

## Basic Acceptance Expectations

- Starting the dev server prints a complex password for `admin@localhost`.
- With no session, every application route redirects to the login screen.
- Signing in with the printed credentials grants access; signing in with wrong
  credentials is rejected with an error.
- Logging out ends the session and the user is again blocked from application
  routes until they sign in again.

## Assumptions (resolved clarifications)

- A minimal logout (ending the authenticated session) is in scope as part of
  item a's "authenticated session" — it is implied rather than explicitly
  lettered and is flagged in the Stage 3 summary for the human.