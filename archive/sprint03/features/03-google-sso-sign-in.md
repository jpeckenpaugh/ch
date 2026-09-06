# Feature: Google SSO Sign-In

## Capability

Offer "Sign in with Google" as an alternative to email/password login. A Google
sign-in authenticates the user, establishes the same session as email/password,
links the Google identity to the account, and auto-provisions a guest account
when the email is unknown.

## Scope notes

- SSO is config-driven and optional: active only when OAuth credentials are
  provided; the app works fully self-contained otherwise, and the SSO option
  appears on the login screen only when enabled.
- Existing cookie-based sessions, route gating, and email/password login are
  unchanged.
- Google is the only external provider this sprint. Local development may run
  SSO over plain HTTP (dev-only relaxation of the OAuth secure-cookie default).
  SSO is verified manually against real Google credentials (no automated SSO
  checks).