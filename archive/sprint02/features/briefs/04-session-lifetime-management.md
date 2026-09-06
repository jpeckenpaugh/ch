# Brief: Session Lifetime Management

## Purpose

Give authenticated sessions a defined server-side lifetime (expiry) while
keeping them stored server-side, so sign-out and revocation continue to work as
today. A session no longer lives forever; when it expires, the user must sign
in again.

## Expected Behavior

1. Each authenticated session has a defined server-side lifetime: it is active
   for that lifetime and is no longer valid once it expires.
2. Sessions are stored server-side as tokens with an expiry, and each session
   token is carried to the browser in an HttpOnly session cookie. Because the
   token is stored server-side with its expiry, both revocation and expiry are
   enforced server-side.
3. During its lifetime, a session authenticates the user exactly as today: the
   user stays signed in across requests and restarts within the lifetime.
4. After a session expires, the user is treated as unauthenticated: gated
   routes refuse the request and the app shows the login screen. The user must
   sign in again to continue.
5. Sign-out and revocation work as today: ending a session (or revoking it)
   invalidates it server-side immediately, not merely on the client.
6. The cookie-based sign-in experience is preserved: an HttpOnly session cookie
   and a login screen for unauthenticated users.

## Inputs / Outputs

- **Inputs:** A sign-in that establishes a session; the session's elapsed time.
- **Outputs:** A session that authenticates the user during its lifetime and an
  unauthenticated state after expiry, with sign-out/revocation effective
  immediately.

## User-Visible Behavior

- The sign-in experience and cookie behavior are unchanged.
- New: an authenticated session ends on its own after its defined lifetime,
  returning the user to the login screen where they must sign in again.
- No other user-visible change.

## Constraints

- Sessions remain stored server-side, so sign-out and revocation work as today.
- The HttpOnly session cookie, login screen for unauthenticated users, and
  gated application routes are preserved.
- The concrete duration and fixed-vs-sliding policy are deferred to the
  architecture stage; this brief fixes only that a defined server-side lifetime
  exists with re-login after expiry.
- An expired session must not be treated as authenticated.

## Basic Acceptance Expectations

- A session authenticates the user within its lifetime and is rejected after
  expiry.
- After expiry, the user is returned to the login screen and must sign in again.
- Sign-out/revocation invalidates a session server-side immediately, as today.
- The existing backend and browser test suites pass (updated for the deliberate
  auth changes), with new checks covering session expiry.