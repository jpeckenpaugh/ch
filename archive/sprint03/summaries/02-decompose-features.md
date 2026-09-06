# Summary: Feature Decomposition (Stage 2)

- **Date:** 2026-09-05
- **Author / Executor:** opencode (stage role executor)
- **Instruction file:** `instructions/enhancements/02-decompose-features.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 02: decompose Sprint 03 scope into feature files`

## Work Completed

Decomposed the agreed Sprint 03 scope (`enhancements/scope.md`) into four new
capability-level features covering the role/access model, the admin
user-management UI, Google SSO, and the sign-in page navigation fix. Reviewed
the existing v0.1 features under `archive/build/features/completed/` and
confirmed none of the new capabilities duplicate them (v0.1 covers company
browsing, profiles, maintenance, files/artifacts, and document generation).
Stayed at the capability level — no behavior, workflows, routes, schemas, or
implementation detail.

## Outputs Produced / Modified

- `features/01-role-based-access.md` — new; role/access model plus its scope
  constraints (guest default, admin-only role changes, bootstrap admin).
- `features/02-admin-user-management.md` — new; admin account and access-level
  management with safeguards (last admin, bootstrap admin, no self-service).
- `features/03-google-sso-sign-in.md` — new; Google SSO alternative login with
  config-driven/optional behavior, identity linking, guest auto-provisioning,
  and the plain-HTTP dev relaxation.
- `features/04-sign-in-page-nav-fix.md` — new; hide the top navigation bar for
  unauthenticated users.
- `instructions/enhancements/summaries/02-decompose-features.md` — new; this
  summary.

## Key Decisions

- Grouped the scope into four features matching the scope's four feature areas
  (roles & access, admin user management, Google SSO, sign-in UI), keeping SSO
  as a single feature file (auto-provision and guest default captured as scope
  notes within it) and the nav fix as its own file.
- Cross-cutting constraints (items **q**–**s**: no regression, env-based SSO
  secrets, versioned migration) are constraints/boundaries rather than
  capabilities, so they do not receive feature files; they are expected to
  surface in the Stage 3 briefs and downstream stages.
- Adopted the existing v0.1 feature-file format (`# Feature:` + `## Capability`)
  and added a `## Scope notes` section to carry in-scope constraints where
  needed without drifting into implementation.

## Open Questions & Concerns

None — the four-feature grouping was confirmed by the human before proceeding.
The cross-cutting constraint items (q–s) intentionally have no feature files
and must be surfaced by Stage 3 briefs.

## Status

- [x] Complete
- [ ] Needs review