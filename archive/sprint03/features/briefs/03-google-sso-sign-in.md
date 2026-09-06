# Brief: Google SSO Sign-In

## Purpose

Offer **Sign in with Google** as an alternative to email/password login. A
Google sign-in authenticates the user, establishes the same cookie session as
email/password, links the Google identity to the account, and auto-provisions a
guest account when the email is unknown. The capability is config-driven and
optional, so the app remains fully self-contained when OAuth credentials are not
provided.

## Expected Behavior

1. When OAuth credentials are configured, the sign-in screen shows a **Sign in
   with Google** option alongside the email/password form. When they are not
   configured, the option does not appear and the app works fully
   self-contained with email/password login only.
2. Clicking **Sign in with Google** starts the Google sign-in flow; the user
   authenticates with Google and is returned to the app already signed in, with
   the same cookie session as an email/password login.
3. Account resolution on Google sign-in:
   - If the Google identity is already linked to an account (via the stored
     link), sign in as that account with its current access level.
   - Otherwise, if the Google email matches an existing account, link the
     Google identity to that account and sign in as that account with its
     existing access level and active state.
   - Otherwise (an entirely unknown email), auto-provision a new **guest**
     account, link the Google identity to it, and sign in as that guest.
4. The session created by a Google sign-in behaves exactly like an email/password
   session: the same route gating applies, and the existing logout flow ends the
   session.
5. Existing cookie-based sessions, route gating, and email/password login are
   unchanged; a Google sign-in does not disturb other signed-in sessions or
   alter how email/password accounts authenticate.
6. The auto-provisioned guest account follows the role-based access rules (brief
   "Role-Based Access"): it sees the empty/blocked guest view until an admin
   elevates it, and the linked identity is managed through admin user management
   (brief "Admin User Management").
7. Local development may run the SSO flow over plain HTTP as a dev-only
   relaxation of the secure-cookie default; production behavior keeps the
   secure default.
8. SSO is verified manually against real Google credentials; there are no
   automated SSO checks.

## Inputs / Outputs

- **Inputs:** The user's Google account and authorization via the Google sign-in
  flow; optional OAuth configuration (enabled or not).
- **Outputs:** An authenticated cookie session for the resolved account; a
  stored link between the Google identity and the account; a newly
  auto-provisioned guest account when the email was unknown; or a failed/canceled
  sign-in with no session established.

## User-Visible Behavior

- When SSO is enabled, the sign-in screen shows a **Sign in with Google** option
  in addition to the email/password form.
- Clicking the option takes the user to Google, and on success the user returns
  to the app signed in.
- A returning Google user with a linked account signs straight in with their
  current access level.
- A first-time Google user whose email matches an existing account is signed in
  as that account (with its existing role), and the identity is linked.
- A first-time Google user with an unknown email is signed in as a newly created
  guest and sees the empty/blocked guest view until an admin elevates them.
- A canceled or failed Google sign-in returns the user to the sign-in screen
  without a session and with feedback.
- When SSO is disabled, the sign-in screen is unchanged from today (email/password
  only) and the app behaves as before.

## Constraints

- SSO is config-driven and optional: active only when OAuth credentials are
  provided; otherwise the option is absent and the app is fully
  self-contained.
- Google is the only external provider this sprint.
- The Google sign-in establishes the same cookie session as email/password;
  existing cookie-based sessions, route gating, and email/password login are
  unchanged.
- Auto-provisioned accounts start at guest and see the empty/blocked view until
  an admin elevates them (brief "Role-Based Access").
- SSO credentials and secrets come from environment variables and are never
  committed to the repository; the console-printed bootstrap-admin flow is
  unchanged.
- Local development may run SSO over plain HTTP (dev-only relaxation of the
  OAuth secure-cookie default); production keeps the secure default.
- SSO is verified manually against real Google credentials; no automated SSO
  checks are required.

## Basic Acceptance Expectations

- With OAuth credentials configured, the sign-in screen shows the **Sign in with
  Google** option, and a Google sign-in authenticates the user and establishes a
  working session.
- A first-time Google sign-in with a known email signs the user into the
  existing account, preserving its access level, and links the Google identity
  to it.
- A first-time Google sign-in with an unknown email auto-provisions a guest
  account and signs the user in to the empty/blocked guest view.
- A second Google sign-in for an already-linked identity signs the user in
  directly as that account.
- Without OAuth credentials configured, the **Sign in with Google** option does
  not appear and email/password login works as before.
- The existing logout flow and route gating work the same for sessions
  established via Google sign-in.