# Brief: Versioned Schema Migrations

## Purpose

Manage schema changes through versioned migrations (Alembic), so the database
schema evolves through tracked, replayable migrations rather than
destroy-and-reseed. Future schema changes become small, recorded migrations
instead of table drops and rebuilds.

## Expected Behavior

1. Schema changes are applied as versioned migrations rather than by destroying
   and recreating the database.
2. Migration history is tracked, so each migration is applied exactly once and
   the database's current version is known.
3. Bringing a database up to date replays only the migrations it has not yet
   applied; a freshly created database reaches the current schema by applying
   the full migration set in order.
4. The current dev database under `data/` may be flushed once to establish the
   migration baseline; repo-tracked content is not deleted or regressed.
5. After the baseline, existing data is preserved across schema changes: a
   migration does not destroy data the app still needs.
6. Seed-on-empty behavior and seed content are unchanged: a fresh, fully
   migrated database seeds the same content as today.

## Inputs / Outputs

- **Inputs:** The current database schema and the recorded set of versioned
  migrations.
- **Outputs:** A database at the current schema version, with its migration
  history recorded, preserving existing data.

## User-Visible Behavior

- None. Migrations are an operator/engineering mechanism; the user experience
  and API behavior are unchanged.

## Constraints

- Schema changes are versioned migrations, not destroy-and-reseed.
- The dev database under `data/` may be flushed once to establish the migration
  baseline; repo-tracked content is not deleted or regressed.
- Non-auth application behavior is preserved exactly; no functionality regresses.
- Seed content and seeding rules are unchanged.

## Basic Acceptance Expectations

- A fresh database reaches the current schema by replaying the migration set in
  order.
- Existing data survives a migration (no data loss for content the app uses).
- Migration history is tracked and each migration runs once.
- A database already at the current version requires no further action on
  startup.
- The existing backend and browser test suites pass, except checks updated for
  the deliberate auth changes.