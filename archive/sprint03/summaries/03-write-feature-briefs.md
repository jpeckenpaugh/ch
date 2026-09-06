# Summary: Feature Brief Writer (Stage 3)

- **Date:** 2026-09-05
- **Author / Executor:** opencode (stage role executor)
- **Instruction file:** `instructions/enhancements/03-write-feature-briefs.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 03: write Sprint 03 feature briefs`

## Work Completed

Wrote one behavioral brief per Sprint 03 feature file, describing each feature
in the context of the existing v0.1/Sprint 02 app (auth sessions, role-less
accounts, superuser-only account creation, and the current partial nav hiding)
rather than as a brand-new product. Each brief covers purpose, expected
behavior, inputs/outputs, user-visible behavior, constraints, and basic
acceptance expectations, and stays behavioral (no filenames, classes, SQL,
routes, or implementation detail). Seven behavior-level clarifications from the
scope were confirmed by the human and are reflected in the briefs.

## Outputs Produced / Modified

- `features/briefs/01-role-based-access.md` — new; four-level access model
  (guest/read-only/user/admin), per-level UI/API behavior, defaults (existing
  accounts user, bootstrap admin admin, SSO-provisioned guest), admin-only role
  changes, self password change preserved.
- `features/briefs/02-admin-user-management.md` — new; admin-only **Users** view
  (no invented search/pagination), create/change-level/activate-deactivate/
  delete, permanent bootstrap-admin protection, last-admin rule, no
  self-service signup/profile editing.
- `features/briefs/03-google-sso-sign-in.md` — new; config-driven optional
  **Sign in with Google**, same cookie session, identity linking by
  `oauth_accounts` then email, guest auto-provisioning for unknown emails, env-based
  secrets, dev-only plain-HTTP relaxation, manual verification only.
- `features/briefs/04-sign-in-page-nav-fix.md` — new; hide the entire top
  navigation bar (brand, links, toggler) when unauthenticated, show it only with
  a valid session.
- `instructions/enhancements/summaries/03-write-feature-briefs.md` — new; this
  summary.

## Key Decisions

- Adopted the existing v0.1 brief structure and tone so downstream engineers
  read the new briefs consistently with the archived ones.
- Confirmed with the human seven scope interpretations before writing:
  guests keep the nav plus an empty/blocked main view and can log out/change
  their own password; read-only denies all writes including document
  generation (generation is a write); the bootstrap admin can never be
  deactivated/demoted/deleted, with the last-admin rule applying to other
  admins; SSO links by `oauth_accounts` then by email, auto-provisioning a guest
  only for fully unknown emails; admin = today's superuser with the four-level
  role replacing `is_superuser` while keeping the user-management gate
  behaviorally identical; hide the entire top `<nav>` when unauthenticated; an
  admin-only **Users** nav entry leads to the management view with no invented
  search/pagination.
- Cross-cutting scope constraints (items **q**–**s**: no non-auth regression,
  env-based SSO secrets, versioned role migration) are captured as constraints
  within the relevant briefs rather than as separate features.

## Open Questions & Concerns

None — the seven clarifications above were reviewed and approved by the human
before the briefs were written. Downstream engineering stages should note that
the role field is a deliberate in-scope data change applied via a versioned
migration (scope **s**) and that the `oauth_accounts` table is consumed as-is
(scope **s**).

## Status

- [x] Complete
- [ ] Needs review