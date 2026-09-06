# Plan: Company Hub browser-only SQLite POC

Status: **approved for execution**. Spec source: `poc-browser-only.md` at the repo root.
This document is the consolidated, final implementation plan incorporating all review feedback.

---

## 1. Goal

Build a browser-only version of Company Hub:

1. the existing HTML/JavaScript SPA remains the user interface,
2. the existing FastAPI backend is not used,
3. SQLite runs directly in the browser through WebAssembly,
4. the database is persisted locally in browser storage (OPFS),
5. the SPA reads/writes through a JavaScript data-access layer,
6. changes survive page reloads and browser restarts,
7. the user can export/import the database as a portable workspace snapshot.

The architectural proposition under test:

> **a static browser application operating directly on a persistent local SQLite workspace** — rather than a server application awkwardly emulated in JavaScript.

The most important outcome is not that every existing feature ports perfectly. It is that, after Milestone 5, the system feels naturally like `static SPA + local SQLite workspace`.

## 2. Decisions (locked)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Browser SQLite runtime | **sql.js now**, with an OPFS-ready worker boundary | Cheaply decouples "can Company Hub work browser-only?" from "is the official SQLite OPFS VFS exactly how we persist?" If the first answer is no, nothing is spent on the second. If yes, swapping storage engines behind the worker is a targeted optimization. |
| SPA reuse | **Separate trimmed browser bundle** in `poc-browser/` | Deliberate isolation so the backend-served `frontend/` is never destabilized; the copy explicitly measures how much coupling exists. |
| Seed / artifacts | **Real schema, no logo/artifact rows** | Ship the current real schema; zero artifact/logo rows so no dangling file bytes; browser repo returns `artifacts: []` and `logo_url: null`. |
| Scope | **All 5 milestones** (0–5), incl. the automated CDP smoke test | Persistence regressions are exactly what an automated reload/reset cycle catches well. |
| Persistence | Whole-DB `db.export()` after each mutation, written to OPFS | Accepted, deliberately crude, explicitly measured. Cost scales with total DB size, not changed rows. |

## 3. Repository layout

```
poc-browser/
├── index.html              trimmed shell: nav = Companies + Industries + Workspace controls
├── css/style.css           copied from frontend/
├── vendor/
│   ├── bootstrap/…         copied (css + bundle.js)
│   ├── bootstrap-icons/…   copied
│   └── sql.js/sql-wasm.{js,wasm}
├── data/seed.db            generated: real current schema, zero artifact/logo rows
├── serve.py                tiny static server (correct .wasm MIME, no-cache)
├── scripts/make_seed_db.py one-off seed generator
├── docs/
│   ├── contract.md         Milestone 0 behavioral inventory matrix
│   └── metrics.md          Milestone 3 export/persist measurements
└── js/
    ├── api.js              browser facade — same exported names as frontend/api.js
    ├── app.js              owner-mode boot/router (no login/session) + shared helpers
    ├── list.js  profile.js  form.js  industries.js   copied views
    └── db/
        ├── client.js       promise facade → worker (rpc plumbing)
        ├── worker.js       classic worker: sql.js load + op registry + persistence
        ├── persistence.js  workspace storage engine (OPFS-ready boundary)
        ├── seed.js         first-run: fetch ./data/seed.db → OPFS
        ├── schema.js       expected-table list + schema-revision check (import validation)
        └── repo/
            companies.js locations.js references.js news.js industries.js countries.js
```

The backend-served `frontend/` is left untouched.

## 4. Worker boundary (engine-agnostic)

- `client.js` spawns a worker and exposes high-level promise ops (`companies.get`, `news.add`, …). Messages are `{op, payload}`; the worker runs a **semantic op registry** — never a raw-SQL console.
- `worker.js` loads sql.js and opens the DB with `PRAGMA foreign_keys=ON` (the real schema carries `ON DELETE CASCADE`, the partial one-HQ / one-logo indexes, and the locations `type` CHECK).
- All mutations are **serialized** through the worker — a single in-flight `export()`/write cycle; no overlapping write cycles.
- **Classic worker / `importScripts` is an implementation detail confined to `worker.js`.** Nothing outside that file depends on it. Later, `sql.js/classic worker` can become `SQLite WASM/module worker` without touching `client.js`, `api.js`, or the views.
- `worker.js` resolves assets with explicit URLs (no string-path guessing):
  ```js
  const sqliteJs = new URL("../../vendor/sql.js/sql-wasm.js", self.location.href).href;
  // same pattern for the .wasm via initSqlJs({ locateFile })
  ```

## 5. Workspace storage engine (`persistence.js`)

Defined at a **high level** — not a raw `save(Uint8Array)/load()` pair, because with native SQLite+OPFS later there may be no meaningful whole-DB-in-memory operation:

```
openWorkspace()                  // open, or first-run copy seed
replaceWorkspace(bytes)          // atomic replace (single mechanism for import AND reset)
exportWorkspace() -> ArrayBuffer // transferable snapshot
resetWorkspace()                 // == replaceWorkspace(seedBytes)
closeWorkspace()
```

### 5.1 Persistence contract (precise wording)

> **Mutation success is acknowledged only after the replacement OPFS file has been successfully closed/committed.**

Browser storage does not give filesystem-style `fsync` durability; `createWritable()` writes through a temporary file and replaces the target when the stream closes. That is the platform's actual guarantee, and the contract above matches it.

Mutation flow — the RPC is the transaction boundary:

```
BEGIN
  all SQL required by the operation
COMMIT
db.export()
OPFS createWritable → write → close
    → only now resolve the RPC promise
```

Never persist after individual SQL statements — one operation = one `BEGIN…COMMIT` → one export → one persist.

### 5.2 Persistence-failure recovery (explicit invariant)

Because SQL `COMMIT` advances in-memory state before persistence, "failed persistence = failed mutation" is only true from the SPA's perspective if the worker rolls the in-memory DB back to the last persisted OPFS state before rejecting. Failure path:

```
BEGIN
mutation
COMMIT
export
attempt OPFS replace
    ├── success → acknowledge
    └── failure
          ↓
      discard / reopen DB
      from last persisted OPFS state
          ↓
      reject RPC
```

Subsequent reads in the same session must never observe the "failed" write.

### 5.3 OPFS sidecar `workspace.json` (revision metadata)

Do **not** put revision metadata inside the Company Hub SQLite DB. A browser-specific table would make every exported database differ from the canonical server-produced schema. Keep a sidecar in OPFS:

```
/company-hub/
├── company_hub.db
└── workspace.json
```

```json
{
  "revision": 43,
  "lastPersisted": "...",
  "seedVersion": "...",
  "schemaRevision": "..."
}
```

- The exported `.db` remains a **canonical Company Hub database** — no browser-specific tables — so import/schema-version logic never distinguishes "Company Hub schema" from "Company Hub browser schema", and an export could theoretically drop back into the server implementation.
- **`workspace.json` is advisory.** Its update is coupled to successful DB persistence, but if the sidecar write fails after the DB committed, the mutation succeeds and metadata is best-effort (no rollback, no failure propagation).
- **`seedVersion` is deterministic** (build/repo commit or explicit seed version), not just a timestamp, so the sidecar can later distinguish code releases.
- The Workspace UI / debug output shows e.g. `DB revision: 43 · Persistence state: saved`.

### 5.4 Storage diagnostics (main thread)

- `navigator.storage.persist()` is called **on the main thread** during app initialization — `persist()` is **not available in Web Workers** (though `navigator.storage` and `persisted()` are). The result is passed into the Workspace status UI (and to the worker only if needed). Failure is non-blocking.
- Add `navigator.storage.estimate()` for **quota visibility** (approximate usage/quota). OPFS writes can fail with `QuotaExceededError`; this becomes important for the 10/50/100 MB metric runs.

Workspace diagnostics eventually show something like:

```
Storage: persistent
Workspace: 12.4 MB
Browser storage: 84 MB / 25 GB
Revision: 43
State: saved
```

or, when persistence was not granted:

```
Storage: browser-managed — export a backup
```

### 5.5 sql.js hygiene

Every prepared `Statement` is explicitly freed (sql.js documents that prepared statements retain WASM-side resources until `free()` and can leave tables locked). A small repository helper wraps statement use in `try/finally`.

## 6. Milestones

### Milestone 0 — Behavioral inventory

Before writing any repo SQL, build a migration contract matrix for **every `api.js` method the retained views use** (list, profile, form, industries). Output: `poc-browser/docs/contract.md`.

For each method record:
1. request arguments
2. response shape
3. backend implementation location
4. DB constraints involved
5. non-DB business rules
6. classification: **READ / WRITE / PURE DERIVATION / SERVER-ONLY → REMOVE**

Matrix shape:

| SPA operation | Browser op | DB tables | Hidden logic |
| --- | --- | --- | --- |
| listCompanies | companies.list | companies, locations… | completeness / HQ |
| updateCompany | companies.update | companies | validation / timestamps |
| addLocation | locations.add | locations | one-HQ rule |
| renameIndustry | industries.update | industries | uniqueness |
| generatePDF | — | — | removed |

Known classifications (verify against routers during this milestone):
- **DB-enforced:** FK cascade deletes; `industries.name` / `countries.code` / `countries.name` UNIQUE; one-HQ partial index (`locations WHERE type='Headquarters'`); one-logo partial index; locations `type` CHECK.
- **Application-enforced (reimplement in JS repos):** completeness derivation (`is_complete` = name + industry_id + all of website/contact_email/contact_phone/description), `hq_location` string (`"City, CC"`), nested `industry {id,name}` / `country_name`, list filter/ordering (`q` name `LIKE`, `countries` any-location, `id ASC`), `created_at`/`updated_at` generation (ISO-8601 UTC `Z`), full-replace company `PUT` semantics, reference/news/location update payloads.
- **SERVER-ONLY / REMOVE:** `generatePDF`, `uploadArtifact`, `uploadLogo`, `download_url`, auth ops, `users`. No browser op; controls trimmed from the copied `profile.js`.

### Milestone 1 — sql.js persistence (smallest probe)

1. Vendor `sql-wasm.js`/`.wasm` into `poc-browser/vendor/sql.js/`; add `serve.py` (serves `.wasm` as `application/wasm`, no-cache, **no** SAB/COOP-COEP magic — native OPFS can add headers later).
2. Implement `persistence.js`, `seed.js`, `worker.js` (open-or-copy-seed, op registry), `client.js`, and a throwaway `probe.html`.
3. Enforce the persistence contract (5.1), serialized mutations, the failure-recovery path (5.2), the sidecar (5.3), main-thread `persist()` + `estimate()` diagnostics (5.4), and `try/finally` statement freeing (5.5).
4. **Forced-persistence-failure test** (injectable failing persistence adapter) proving:
   ```
   mutation committed in sql.js
     → OPFS persistence fails
     → worker discards/reopens DB from last persisted OPFS state
     → RPC rejects
     → reload returns previous persisted state
   ```
5. **Success:** probe DB opens in OPFS; an insert survives a full page reload and a browser close/reopen; persist status + quota are observable.

### Milestone 2 — Read path

1. `scripts/make_seed_db.py`: set `COMPANY_HUB_DB` to a throwaway file, run the real `run_migrations()` + `seed_if_empty()` (no bootstrap users), delete all `artifacts` rows (so no logo bytes dangle), copy → `data/seed.db`. The file includes the real schema **and the `alembic_version` table** (import validation reads it). Validate counts against `tests/backend/test_seed.py` invariants (6 companies, 83 countries, 6 industries, ≥2 refs + ≥3 news + 1 HQ each).
2. **`api.js` preserves the frontend-facing Company Hub data contract** required by the existing views. This is explicitly *not* a clone of `serializers.py` — `serializers.py` contains FastAPI-architecture implementation decisions. For the POC, compare outputs heavily, but the contract belongs to `SPA ↔ CompanyHub API facade`.
   - Company scalars: `id, name, industry{id,name}|null, hq_location("City, CC"), website, contact_email, contact_phone, description, created_at, updated_at, is_complete, artifacts_count(0), logo_url(null)`.
   - Profile adds nested arrays with documented field names and ordering: `locations` id ASC (with `country_name`); `references`/`news` id DESC.
   - List semantics: `q` = case-insensitive `name LIKE %q%`; `countries` = any location in set; order `id ASC`. Timestamps ISO-8601 UTC `Z`.
3. Copy `list.js`, `profile.js`, `form.js`, `industries.js`; write browser `api.js` + `app.js` (owner-mode, no login; boots by `db.init()`, always full-access). Trim `profile.js` artifact/generate/logo controls.
4. **Success:** list, search/filter, industries, and company profile render from browser SQLite with no backend.

### Milestone 3 — Write path

1. Write-invariant check first: for each write, classify DB-enforced vs application-enforced; browser repo functions implement the latter explicitly (uniqueness, one-HQ, completeness, timestamps, full-replace update, industry rename propagation via join).
2. Implement create/update/delete ops for companies, locations, references, news; create/rename industry — each returning the exact per-entity shapes the views re-render against (views re-fetch after every mutation).
3. Aggregate ops are single transaction boundaries (5.1); after each successful mutation the revision sidecar increments (`42 → 43`).
4. **Metrics:** record **elapsed save time** and **peak-ish heap growth / exported byte size** at ~10 MB, 50 MB, and 100 MB DB sizes in `docs/metrics.md` (`db.export()` builds a second full in-memory representation, so byte size matters). Use quota visibility to interpret. Decision point: is whole-DB-save harmless enough to keep, or should native OPFS become the target?
5. **Success:** edit a company, add/edit/delete a location, add/delete a reference and a news item; each survives a full reload.

### Milestone 4 — Portable workspace

Wire **Export / Import / Reset** controls into the nav + `index.html`. These are **worker-exclusive** ops that block the RPC queue for their duration.

- **Export:** block queue → `exportWorkspace()` → transferable `ArrayBuffer` → resume queue → download as `company-hub-YYYY-MM-DD.db` (standard SQLite, inspectable with external tools).
- **Import:** block queue → validate candidate in a **temporary** sql.js Database → on success, close active DB → `replaceWorkspace(bytes)` → reopen → `PRAGMA foreign_keys=ON` → resume queue. **Validate before destroying the currently open workspace** — a failed import leaves the current Company Hub untouched.
  Validation chain:
  ```
  SQLite header ("SQLite format 3\0")
    → opens successfully
    → expected core tables (schema.js)
    → recognized schema revision (read alembic_version)
    → PRAGMA integrity_check          ← import only, never on startup
    → PRAGMA foreign_key_check
  ```
  Unsupported schema → `This Company Hub database uses an unsupported schema version.`
- **Reset:** single `workspace.replace(seedBytes)` — **one mechanism, two sources** (import bytes / seed bytes). Seed bytes are cached after first init (no refetch per reset).
- **Success:** modify → export → reset (changes gone) → import (changes restored).

### Milestone 5 — CDP smoke test (in scope)

Tiny lifecycle test reusing `tests/browser/cdp.mjs` against the static origin (no login). The export/import steps call the underlying workspace `exportWorkspace()`/`replaceWorkspace()` API directly (browser download/file-picker automation is awkward); the visible Export/Import controls get one manual UI test.

```
load
→ verify 6 companies
→ mutate one known company
→ reload → verify mutation persisted
→ export
→ reset → verify original
→ import → verify mutation restored
```

This single scenario covers almost the entire thesis of the POC.

## 7. Cross-cutting implementation requirements

- **Worker path resolution:** explicit `new URL(..., self.location.href)` for sql.js and `.wasm`; no string-path guessing.
- **Classic worker confined to `worker.js`;** RPC client/views engine-agnostic.
- **Copying the four views is intentional** (deliberate isolation, no main-app destabilization).
- **Before finalizing `app.js`/`api.js`:** read the exact imports of the four copied views (helpers like `esc`, `canMutate`, `completenessBadge`, `formatDate`, plus `listCountries`, `listIndustries`, …) and export every name they touch.
- **`profile.js` artifacts UI:** renders a files card from `artifacts: []` (empty state) once trimmed; confirm no dangling `download_url`/`logo_url`.

## 8. Verification gates

- **M1:** probe survives reload/restart; persist grant + quota surfaced; forced-persistence-failure invariant holds.
- **M2–M3:** read/write parity against the frontend data contract; reload persistence.
- **M3 metrics:** 10/50/100 MB export+persist time + exported byte size / heap growth recorded.
- **M4:** full export → reset → import cycle; failed import leaves state intact.
- **M5:** CDP lifecycle smoke test green + manual UI pass on the Export/Import controls.
- **Final:** all 12 completion criteria from `poc-browser-only.md`.

## 9. Explicitly out of scope (unchanged from spec)

FastAPI, Python, SQLAlchemy, Alembic execution, authentication, user management, Google OAuth, OpenCode, AI agents, remote model APIs, GitHub/Drive sync, multi-user collaboration, cross-database sharing, conflict resolution, multiple simultaneous tabs, service workers/PWA, remote backups, artifact/file storage beyond metadata, production hardening. Also deferred: official SQLite OPFS VFS, real browser download automation.

## 10. Suggested execution order

Milestone 0 (inventory) → M1 (probe + persistence engine + failure invariant) → seed generator → M2 (read path) → M3 (write path + metrics) → M4 (workspace controls) → M5 (CDP smoke test + manual pass) → final completion-criteria review.
