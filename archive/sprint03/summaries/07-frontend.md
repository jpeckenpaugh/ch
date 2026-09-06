# Summary: Frontend Engineer (Stage 7)

- **Date:** 2026-09-05
- **Author / Executor:** Frontend Engineer (Sprint 03)
- **Instruction file:** `instructions/enhancements/07-frontend.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 07: implement Sprint 03 frontend (roles UI, admin user mgmt, Google SSO, nav fix)`

## Work Completed

Extended the existing SPA (`frontend/`) to implement the Sprint 03 frontend delta
per `docs/architecture.md` §10.3/§10.5 and the four briefs, consuming the Stage 6
backend contract exactly as built (no invented endpoints):

1. **Sign-in page nav fix (`04`).** The whole top `<nav>` (`#nav-bar` — brand,
   menu links, and toggler) is hidden when there is no authenticated session and
   shown in full once a session exists. `updateNav()` now toggles the entire
   `<nav>` instead of only `#mainNav`/`#nav-toggler`.
2. **Role-based UI (`01`).** Rendering is gated on `me().access_level`:
   - *guest* → blocked "Access pending" view; nav shows only Change password +
     Logout; every non-password route renders the blocked view (approved rec. 1).
   - *read-only* → lists, profiles, industries, and file/document download stay
     available; all mutating controls are hidden (list "Add company", profile
     edit/generate/logo-upload/artifact-upload/location/reference/news/
     artifact-delete, industries add/rename). Direct navigation to the company
     create/edit form (`#/companies/new`, `#/companies/{id}/edit`) is hard-blocked
     with a "Not permitted" placeholder (approved rec. 2).
   - *user/admin* → full current view/edit access, unchanged.
   - A `403` from any API call is surfaced as the friendly message "You don't have
     permission to perform this action" and the session is kept; only `401`
     returns to the login view (approved rec. 3).
3. **Admin user management (`02`).** New admin-only **Users** nav entry
   (`#nav-users`, visible only to admins) and new `js/users.js` view: list all
   accounts with level + active state, create an account (email + initial
   password + level), change a level, activate/deactivate, and delete. Bootstrap
   admin (immutable) and the current admin's own level/delete are disabled
   client-side; the API remains authoritative for the guardrails.
4. **Google SSO (`03`).** The login view fetches `GET /api/auth/providers`; when
   `{google:true}` it shows a **Sign in with Google** button that navigates to
   `/api/auth/authorize`. After the callback redirects to `/`, the boot `me()`
   call sees the session. When SSO is disabled, the login view is unchanged
   (email/password only).

## Outputs Produced / Modified

- `frontend/index.html` — `id="nav-bar"` on the whole `<nav>` (initially `d-none`);
  added admin-only `#nav-users` nav entry (modified).
- `frontend/js/app.js` — whole-nav hide/show; `currentUser`/`accessLevel`/
  `isAdmin`/`canMutate` helpers; guest blocked view; `users` route; nav entries
  per level (modified).
- `frontend/js/api.js` — `403`→friendly-message mapping; added `providers`,
  `listUsers`, `createUser`, `updateUser`, `deleteUser` (modified).
- `frontend/js/login.js` — async render + Google SSO button from `providers`
  (modified).
- `frontend/js/users.js` — new admin user-management view.
- `frontend/js/list.js` — hide "Add company" for non-mutators (modified).
- `frontend/js/industries.js` — hide add/rename for non-mutators (modified).
- `frontend/js/form.js` — hard-block non-mutators with "Not permitted"
  placeholder (modified).
- `frontend/js/profile.js` — hide all mutating controls for non-mutators; guard
  wire functions against absent elements; keep downloads (modified).

## Key Decisions

- Applied the three human-approved recommendations (guest nav scope, form
  hard-block, friendly `403` handling).
- Kept the SPA a pure API client: gating derives from `me().access_level`; the
  backend remains authoritative for denials and the user-management guardrails.
- Centralized `403`→friendly message in `api.js` so every inline alert and toast
  reads consistently while the session is preserved.
- Users view disables bootstrap-admin and self level/delete controls client-side
  but still relies on the API's `400` guardrail messages for anything that slips
  through (details like "Cannot demote or delete the last remaining admin" are
  surfaced verbatim).

## Open Questions & Concerns

- **Existing browser smoke tests must be updated by Stage 8.** Two Sprint 02
  assertions in `tests/browser/smoke.test.mjs` check `#mainNav` for the `d-none`
  class. Brief 04/§10.5 deliberately changed the behavior so the *entire*
  `<nav>` (`#nav-bar`) is hidden when unauthenticated; `#mainNav` no longer
  carries `d-none`. The verification stage should re-point those checks at
  `#nav-bar` (and ideally assert brand/toggler absence too).
- **SSO is unverified end-to-end.** Per Brief 03/§10.7, the full Google flow is
  verified manually against real credentials; I wired the providers fetch and the
  `/api/auth/authorize` button but did not exercise a real Google sign-in.
- **Guest/read-only route reachability.** Hard-blocking the create/edit form and
  the blocked guest view covers direct hash navigation, but a read-only user can
  still trigger `403` on a mutating action if they find one; the friendly `403`
  message keeps the session (by design, per §10.2.1).

## Status

- [x] Complete
- [ ] Needs review