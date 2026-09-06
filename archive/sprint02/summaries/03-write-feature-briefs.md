# Summary: Feature Brief Writer (Stage 3)

- **Date:** 2026-09-04
- **Author / Executor:** opencode (Stage 3 role)
- **Instruction file:** `instructions/enhancements/03-write-feature-briefs.md`
- **Scope reference:** `enhancements/scope.md`
- **Commit:** `stage 03: write feature briefs for sprint 02`

## Work Completed

Wrote one behavioral, unambiguous brief per Sprint 02 feature file under
`features/briefs/`, keeping the numbering and naming in sync with the six
feature files. The briefs describe the new behavior in the context of the
existing application — including how it changes or preserves the current
cookie-based sign-in experience and the existing API contracts — and fold the
decision-maker's resolutions to the five open questions into the relevant
briefs. No feature was skipped or merged, and the archived v0.1 briefs were
read for context but not modified.

## Outputs Produced / Modified

- `features/briefs/` — new folder (Stage 3 output).
- `features/briefs/01-orm-persistence.md` — new brief (feature 01, scope item a).
- `features/briefs/02-versioned-schema-migrations.md` — new brief (feature 02, scope item b).
- `features/briefs/03-maintained-authentication.md` — new brief (feature 03, scope item f).
- `features/briefs/04-session-lifetime-management.md` — new brief (feature 04, scope item h).
- `features/briefs/05-user-account-management.md` — new brief (feature 05, scope items i, j).
- `features/briefs/06-oauth-ready-account-model.md` — new brief (feature 06, scope item k).
- `instructions/enhancements/summaries/03-write-feature-briefs.md` — new summary.

No existing application files, code, or v0.1 artifacts were modified.

## Key Decisions

- Briefs are behavior-level and user-visible, in the style of the existing v0.1
  briefs; no filenames, classes, SQL, or implementation code was written.
- Features 01, 02, and 06 are internal-only by design: their briefs state
  explicitly that there is no user-visible change (per constraint **c**).
- **Resolutions incorporated** (authoritative, from the run's decision-maker):
  - Brief 05 uses fastapi-users' `is_superuser` flag: the bootstrap admin is a
    superuser; only superusers create accounts; non-superusers have no admin
    functions.
  - Brief 05 records admin-created accounts through the application's API
    (library-backed user management), no self-service signup, and no SPA admin
    UI this sprint.
  - Brief 05 records the stable admin credential as idempotent creation with the
    `COMPANY_HUB_ADMIN_PASSWORD` environment override or generated-and-printed
    at creation, persisted in the DB and **not** re-randomized on restart.
  - Brief 04 states "a defined server-side lifetime with re-login after expiry"
    and defers the concrete duration and fixed-vs-sliding policy to
    architecture (Stage 5).
  - Brief 03 records password change as a user-facing form in the SPA; admin
    reset of another user's password is out of scope.
- Brief 04 reflects the resolved session design — server-side stored tokens
  with an expiry (giving both revocation and expiry) carried in an HttpOnly
  cookie — as settled behavior rather than an open tension. The stage-3
  instruction's "no implementation code" rule is respected by describing this
  at the behavior level.

## Open Questions & Concerns

- None blocking. All five questions raised at brief-writing review were resolved
  authoritatively and are reflected in the briefs.
- Two items remain flagged for downstream stages (not blocking Stage 4):
  - The concrete session-lifetime duration and fixed-vs-sliding policy are
    deferred to architecture (Stage 5), per the resolution for brief 04.
  - Per scope items **m**/**n**: verification must update checks for the
    deliberate auth changes and add new checks for password change, multiple
    users, and session expiry; the one-time dev-DB flush under `data/` is an
    operator action to establish the migration baseline, with repo-tracked
    content untouched.

## Status

- [x] Complete
- [ ] Needs review