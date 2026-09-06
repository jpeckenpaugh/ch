# Brief: ORM-Backed Persistence

## Purpose

Persist application data through a maintained ORM (SQLAlchemy) instead of
hand-written SQL, so application code reads and writes via models rather than
manual SQL strings. This is a maintenance foundation for the app's existing data
(companies, locations, references, news, file metadata, users, sessions); it
does not change what the app does, only how it persists data.

## Expected Behavior

1. Application data reads and writes are performed through the ORM's models
   rather than hand-managed SQL strings.
2. All data the app currently persists continues to be stored with the same
   meaning and relationships as today: companies and their locations,
   references, news articles, stored-file metadata, user accounts, and sessions.
3. Every existing API contract, response, and semantic stays exactly as-is:
   the same requests produce the same responses as today.
4. Object storage stays as today — file bytes on disk, metadata in the
   database — and document generation is unchanged.
5. Persistence operations are async-native so the app's responsiveness is not
   blocked; CPU-bound and file-bound work is kept off the request loop.
6. Seed content and seeding rules are unchanged: the same seed content appears
   for a fresh database as it does today.
7. Users, sessions, sign-in, sign-out, and route gating continue to work as
   today (this foundation underpins the auth changes in the other briefs).

## Inputs / Outputs

- **Inputs:** The same data the app stores and retrieves today (companies,
  locations, references, news articles, stored-file metadata, user accounts,
  sessions) plus the requests that operate on them.
- **Outputs:** The same persisted data and API responses as today, now served
  through an ORM data layer.

## User-Visible Behavior

- None. This is an internal persistence foundation; the user experience,
  screens, and API responses are unchanged.

## Constraints

- Non-auth application behavior is preserved exactly: every existing API
  contract, response, and semantic stays as-is; object storage (file bytes on
  disk, metadata in the database) and document generation are unchanged.
- Persistence is async-native; CPU-bound and file-bound work is kept off the
  request loop so it does not block responsiveness.
- No persistence features beyond the ORM/migration foundation; seed content and
  seeding rules are unchanged.
- No non-auth functionality regresses.

## Basic Acceptance Expectations

- Every existing API request returns the same response as before this change.
- Stored-file artifacts remain accessible and document generation still works.
- The app's existing data persists and is retrievable through the ORM data
  layer.
- A fresh database is seeded with the same content as today.
- The existing backend and browser test suites pass, except checks updated for
  the deliberate auth changes.