# Brief: OAuth-Ready Account Model

## Purpose

Include the account model fields needed for external identity providers (an
OAuth accounts table), so Google SSO can be added in a later sprint without a
data-model change. This sprint adds the schema support only; no OAuth login
routes or SSO behavior are added.

## Expected Behavior

1. The account model can represent a link between a user account and an
   external identity provider (for example, Google), so a future SSO sprint can
   associate a user with an external provider identity without changing the
   data model.
2. The external-identity link is part of the data model only; this sprint
   adds no OAuth login routes, provider screens, or SSO flows.
3. Existing auth behavior — sign-in, sign-out, current-user, and password
   change — is unchanged by this capability.
4. Regular email/password accounts continue to work as described in the other
   auth briefs; the external-identity capacity is additive and does not replace
   them.

## Inputs / Outputs

- **Inputs:** (None user-facing this sprint.) The data model can store an
  external identity provider's identifier for an account.
- **Outputs:** A data model that can record which external provider an account
  is linked to, ready for a future SSO sprint.

## User-Visible Behavior

- None this sprint. The account model gains the capacity to link external
  identity providers; no login flow, screen, or API behavior changes.

## Constraints

- Schema-only: an OAuth accounts table exists, but no OAuth login routes are
  added this sprint.
- The model must support adding Google SSO in a later sprint without a
  data-model change.
- Existing auth behavior and the no-signup boundary are preserved; the
  external-identity link is schema support, not a self-service path this sprint.
- No non-auth functionality regresses.

## Basic Acceptance Expectations

- The data model can represent an account's external-provider identity without
  requiring a future schema change.
- No OAuth routes or SSO behavior exist after this sprint.
- All existing sign-in, sign-out, current-user, and password-change behavior
  works unchanged.