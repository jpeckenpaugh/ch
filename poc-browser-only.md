# Company Hub Browser-Only SQLite POC

## Background

Company Hub is currently an internal company-intelligence application built around a traditional web architecture:

* a static JavaScript/Bootstrap SPA in the browser,
* a FastAPI backend,
* SQLite for structured application data,
* local filesystem storage for artifacts,
* and, separately, an OpenCode-based agent integration that can research and enrich company records through the application API.

The broader architectural direction under consideration is to make Company Hub increasingly local-first and portable. Rather than assuming that every user connects to a shared application server and shared database, the long-term model may be closer to a personal workspace:

* each user has their own Company Hub,
* each workspace contains that user's clients and related intelligence,
* the workspace can be backed up or moved between devices,
* sharing is explicit rather than implicit,
* and future agents may operate on one or more workspaces without requiring a conventional centralized application server.

That larger idea raises many questions around agents, synchronization, remote storage, sharing, identity, and portability. Before exploring those, this proof of concept deliberately isolates the most fundamental technical question:

> Can the existing Company Hub SPA operate entirely inside the browser against a real, persistent SQLite database, with no application backend at all?

The purpose of this POC is to answer that question as directly as possible.

---

# Objective

Build a browser-only version of Company Hub in which:

1. the existing HTML/JavaScript SPA remains the user interface,
2. the existing FastAPI backend is not used,
3. SQLite runs directly in the browser through WebAssembly,
4. the SQLite database is persisted locally in browser storage,
5. the SPA reads and writes the database through a JavaScript data-access layer,
6. changes survive page reloads and browser restarts,
7. and the user can export and import the SQLite database as a portable workspace snapshot.

The POC is not intended to reproduce the entire current production architecture.

It is intended to prove that Company Hub can be reframed as:

> **a static browser application operating directly on a persistent local SQLite workspace.**

---

# Core architectural hypothesis

The current Company Hub request path is approximately:

```text
Browser SPA
    |
    v
frontend/js/api.js
    |
    v
HTTP requests
    |
    v
FastAPI
    |
    v
SQLAlchemy
    |
    v
SQLite
```

For the browser-only POC, that becomes:

```text
Browser SPA
    |
    v
JavaScript application/data API
    |
    v
Database Worker
    |
    v
SQLite WASM
    |
    v
Origin Private File System
    |
    v
company_hub.db
```

The major architectural change is therefore not a frontend rewrite.

It is the removal of the HTTP/backend layer between the SPA and SQLite.

The browser becomes both the presentation runtime and the application runtime.

---

# Why this is worth testing

Company Hub's backend currently performs several different jobs:

* exposing an HTTP API,
* enforcing authentication and authorization,
* executing domain operations,
* querying SQLite,
* managing migrations and initialization,
* and serving the static frontend.

In the proposed personal-workspace model, several of those responsibilities may no longer be necessary in the same form.

If a user owns their own local Company Hub database, then the browser does not inherently need an HTTP server to access it.

The browser can potentially perform:

```text
UI operation
    |
    v
domain/data operation
    |
    v
SQLite
```

directly.

That would make FastAPI an optional deployment adapter rather than a fundamental requirement of Company Hub.

This POC exists to determine whether that simpler model is practical and pleasant to build against.

---

# POC scope

The POC should be intentionally narrow.

It should prove four things.

## 1. SQLite can run persistently in the browser

A real SQLite database should be opened through SQLite's WebAssembly build and stored using browser-native persistent storage, preferably the Origin Private File System.

The database must survive:

* page reload,
* browser close/reopen,
* normal navigation away from and back to the application.

The browser database should behave like the user's local working file.

---

## 2. The existing SPA can read from browser SQLite

The existing Company Hub UI should render real Company Hub data without FastAPI.

At minimum:

* company list,
* company profile,
* industries,
* locations,
* references,
* and news

should be readable from the local database.

The objective is to preserve as much of the existing SPA as possible.

---

## 3. The existing SPA can write to browser SQLite

Representative mutations should work directly against the browser database.

At minimum, the POC should demonstrate:

* editing a company,
* adding or editing a location,
* adding a reference,
* adding a news item.

After a write, the page should be reloadable and the updated data should still exist.

This proves that browser SQLite is functioning as durable application state rather than merely as an in-memory cache.

---

## 4. The database can be exported and restored

The user should be able to export the current Company Hub database as a normal SQLite file.

For example:

```text
company-hub-2026-09-06.db
```

The user should then be able to:

1. clear/reset the local browser workspace,
2. import the exported database,
3. reopen Company Hub,
4. and recover the same data.

This proves the core "portable workspace" concept.

---

# Explicitly out of scope

The following should not be part of the initial POC:

* FastAPI
* Python
* SQLAlchemy
* Alembic execution
* authentication
* user management
* Google OAuth
* OpenCode
* AI agents
* remote model APIs
* GitHub synchronization
* Google Drive synchronization
* multi-user collaboration
* cross-database sharing
* automatic conflict resolution
* multiple simultaneous browser tabs
* service workers/PWA behavior
* automatic remote backups
* artifact/file storage beyond metadata
* production hardening

These may become relevant later.

For the POC, they would obscure the central question.

---

# Proposed browser architecture

A clean initial design would look like this:

```text
+------------------------------------------------------+
| Browser                                              |
|                                                      |
|  Existing Company Hub SPA                            |
|  - index.html                                        |
|  - app.js                                            |
|  - list.js                                           |
|  - profile.js                                        |
|  - form.js                                           |
|  - industries.js                                     |
|  - etc.                                              |
|                |                                     |
|                v                                     |
|  Company Hub JS API / Repository                     |
|                |                                     |
|                v                                     |
|  Database Web Worker                                 |
|                |                                     |
|                v                                     |
|  SQLite WASM                                         |
|                |                                     |
|                v                                     |
|  OPFS                                                |
|     company_hub.db                                   |
|                                                      |
|  Export / Import                                     |
|     <------ portable SQLite file ------>             |
+------------------------------------------------------+
```

The database should ideally run inside a dedicated Web Worker.

This keeps database operations away from the main rendering thread and establishes a useful architectural boundary.

The main SPA should not execute raw SQL directly.

Instead, it should call structured JavaScript operations.

---

# Preserving the existing SPA

The strongest version of this POC avoids rewriting Company Hub's interface.

The existing frontend already contains a natural abstraction point:

```text
frontend/js/api.js
```

Today, higher-level modules conceptually do something like:

```javascript
await api.getCompanies();
await api.getCompany(id);
await api.updateCompany(id, data);
```

The current implementation eventually performs HTTP requests.

The browser-only implementation should preserve those high-level operations while changing what happens underneath.

Current:

```text
list.js
   |
   v
api.js
   |
   v
fetch("/api/companies")
```

POC:

```text
list.js
   |
   v
api.js
   |
   v
BrowserRepository
   |
   v
DB Worker
```

This provides two benefits.

First, the POC remains small.

Second, Company Hub gains a reusable application boundary that could later support multiple execution modes.

For example:

```text
CompanyHub API
       |
       +---- HTTP adapter ------> FastAPI
       |
       +---- Browser adapter ---> SQLite WASM
```

The rest of the application does not need to know which adapter is active.

---

# Database worker interface

The browser worker should not expose an unrestricted SQL console to the rest of the SPA.

Instead, it should expose semantic operations.

For example:

```javascript
await db.call("companies.list", {
  q: "shell",
  countries: ["GB"]
});

await db.call("companies.get", {
  id: 5
});

await db.call("companies.update", {
  id: 5,
  data: {
    name: "Shell",
    description: "..."
  }
});

await db.call("news.add", {
  companyId: 5,
  article: {
    title: "...",
    source: "...",
    url: "..."
  }
});
```

Internally, the worker maps those operations to SQL.

Conceptually:

```text
message from SPA
      |
      v
operation registry
      |
      v
parameter validation
      |
      v
SQL statement / transaction
      |
      v
SQLite
      |
      v
structured JSON response
```

This mirrors some of the role currently performed by FastAPI routers without preserving HTTP merely for architectural familiarity.

---

# Database persistence model

The live SQLite database should be stored in browser-local persistent storage.

The preferred model is:

```text
OPFS
└── company_hub.db
```

This file is the active workspace.

The important distinction is:

> OPFS persistence and database snapshots are separate concerns.

Every normal SQLite transaction persists directly into the working database.

The user should not need to explicitly "save" the application after every edit.

For example:

```text
User edits company
      |
      v
SQLite UPDATE
      |
      v
transaction commits
      |
      v
OPFS contains new state
```

The database is already saved.

Exporting a snapshot is instead a portability/backup operation.

---

# First-run initialization

The application needs a simple bootstrap mechanism.

One approach is to ship a seeded SQLite database with the static application.

For example:

```text
data/
└── seed.db
```

Startup behavior:

```text
Application starts
       |
       v
Does local company_hub.db exist?
       |
   +---+---+
   |       |
  yes      no
   |       |
   v       v
 open    load seed.db
   |       |
   |       v
   |    copy into OPFS
   |       |
   +---+---+
       |
       v
open database
       |
       v
start SPA
```

This lets the POC use realistic Company Hub data immediately.

The seed database should ideally represent the current real schema rather than a simplified toy schema.

---

# Why the POC should use the real Company Hub schema

A toy schema would prove only that SQLite works in WebAssembly.

That question is already answered.

The meaningful question is whether Company Hub works this way.

Therefore the POC should use as much of the actual schema as practical, including relationships between:

* companies,
* industries,
* countries,
* locations,
* references,
* news,
* and artifact metadata.

This exposes real issues involving:

* joins,
* foreign keys,
* cascading behavior,
* uniqueness rules,
* aggregate profile queries,
* filtering,
* sorting,
* and transactional updates.

That makes the POC an architectural test rather than a technology demo.

---

# Artifact handling

The current Company Hub stores artifact metadata in SQLite while keeping file bytes outside the database.

For the first browser-only POC, file storage should be deferred.

The application may retain artifact-related schema if useful, but actual binary artifact support does not need to work.

For example, these can wait:

* logos,
* uploaded PDFs,
* generated documents,
* attachment downloads.

A later browser implementation could store files in OPFS alongside the database:

```text
/company-hub/
├── company_hub.db
└── artifacts/
    ├── ...
    └── ...
```

But that is not required to prove the database architecture.

---

# Export behavior

The POC should provide a simple "Export Workspace" control.

Conceptually:

```text
Current SQLite DB
       |
       v
flush/checkpoint if necessary
       |
       v
obtain consistent DB bytes
       |
       v
Blob
       |
       v
browser file download
```

Result:

```text
company-hub-2026-09-06.db
```

This database should be a standard SQLite file that could also be inspected with normal SQLite tools outside the browser.

That is an important property.

Company Hub's data should remain portable and non-proprietary.

---

# Import behavior

The POC should also provide an "Import Workspace" control.

Flow:

```text
User selects .db
       |
       v
validate file
       |
       v
verify SQLite format
       |
       v
verify expected Company Hub schema
       |
       v
close current DB
       |
       v
replace local OPFS database
       |
       v
reopen DB
       |
       v
refresh application state
```

The import path should reject unrelated or corrupt SQLite databases rather than blindly replacing the working state.

At minimum, validation could check:

* SQLite file signature,
* presence of expected core tables,
* schema/application version metadata.

---

# Reset behavior

For testing, the POC should have a "Reset Workspace" operation.

That would:

```text
close database
   |
   v
delete local company_hub.db
   |
   v
copy seed.db back into OPFS
   |
   v
reload application
```

This will make development and experimentation much easier.

---

# Suggested POC milestones

## Milestone 1: SQLite browser persistence

Build the smallest possible test page.

Requirements:

* SQLite WASM loads.
* A database opens in OPFS.
* A table can be queried.
* A row can be inserted.
* The page can be reloaded.
* The inserted row remains.

Success means the browser runtime and persistence substrate are viable.

---

## Milestone 2: Company Hub read path

Connect the real SPA to the browser database.

Implement only enough data operations to support:

* company list,
* company search/filtering,
* company profile.

The existing frontend should render those screens without FastAPI running.

Success means the SPA can realistically consume browser SQLite.

---

## Milestone 3: Company Hub write path

Implement representative mutations:

* edit company,
* add/edit/delete location,
* add/delete reference,
* add/delete news item.

Reload after each operation and confirm persistence.

Success means browser SQLite can function as the application's real working state.

---

## Milestone 4: portable workspace

Implement:

* Export Workspace
* Import Workspace
* Reset Workspace

Test:

```text
modify data
   |
   v
export database
   |
   v
reset application
   |
   v
verify changes gone
   |
   v
import database
   |
   v
verify changes restored
```

Success means the core personal-workspace concept has been proven.

At this point, stop and evaluate the architecture before adding additional capabilities.

---

# Possible repository layout

A POC could preserve most of the current frontend and add a small browser-database layer:

```text
frontend/
├── index.html
├── css/
├── js/
│   ├── app.js
│   ├── api.js
│   ├── list.js
│   ├── profile.js
│   ├── form.js
│   ├── industries.js
│   └── db/
│       ├── client.js
│       ├── worker.js
│       ├── schema.js
│       ├── companies.js
│       ├── locations.js
│       ├── references.js
│       └── news.js
│
├── vendor/
│   └── sqlite/
│       ├── sqlite3.js
│       └── sqlite3.wasm
│
└── data/
    └── seed.db
```

The existing backend directory does not need to be deleted.

The POC can simply run without it.

This leaves open the possibility that Company Hub ultimately supports both:

```text
Browser-only mode
```

and

```text
Traditional FastAPI mode
```

through different data adapters.

---

# Design principles for the POC

## Preserve domain semantics

Avoid scattering SQL throughout frontend components.

Operations should remain domain-oriented:

```text
get company
list companies
update company
add location
add news
```

rather than:

```text
execute arbitrary SQL
```

This becomes especially important if agents return later.

---

## Treat SQLite as the workspace

The SQLite database should not merely be treated as an implementation detail.

For this architecture, it becomes the portable representation of the user's Company Hub state.

That means the DB file itself is valuable:

```text
Alice's Company Hub
      =
company_hub.db
```

with artifacts potentially added alongside it later.

---

## Treat browser storage as working storage

OPFS is the user's local working disk.

It should contain the live database.

Exports are backups or portable copies, not the normal persistence mechanism.

---

## Avoid premature synchronization

Do not add Google Drive, GitHub, or other remote storage until local persistence/export/import is proven.

Those are storage-adapter problems.

They should not influence the core browser database design.

---

## Avoid premature agent integration

OpenCode and agents should remain outside the POC.

Once a clean JavaScript domain API exists, agent integration becomes easier anyway.

A future agent should ideally call:

```javascript
companyHub.companies.get(...)
companyHub.news.add(...)
```

rather than depending on localhost HTTP or direct SQL.

The browser-only POC therefore creates useful groundwork for later agent architecture without needing to include agents now.

---

# What this POC is really testing

The immediate implementation question is:

> Can SQLite WASM and OPFS replace FastAPI as the runtime data path for a personal Company Hub?

But the deeper architectural question is:

> Is Company Hub fundamentally a web service, or can it instead be a portable application workspace that happens to run in the browser?

If the POC succeeds, the resulting model becomes:

```text
Static application
      +
local SQLite workspace
      +
optional external services
```

rather than:

```text
frontend
      +
always-running application server
      +
server-owned database
```

That is a substantial simplification for the longer-term personal-workspace vision.

It would also create a clean foundation for later capabilities such as:

* Google Drive backup,
* GitHub-backed snapshots,
* multi-device restore,
* import/export between users,
* selective workspace sharing,
* AI agents operating on the local workspace,
* cross-workspace agents,
* browser-local document processing,
* and potentially completely serverless deployment.

Those should only be considered after the basic browser/SQLite interaction proves sound.

---

# POC completion criteria

The POC is complete when all of the following are true:

1. Company Hub can be served as static files.
2. FastAPI does not need to be running.
3. SQLite executes in the browser.
4. The database is stored persistently in OPFS.
5. The existing company list renders from that database.
6. A company profile renders correctly.
7. At least several representative record types can be modified.
8. Changes persist after a full page reload.
9. The current database can be exported as a standard `.db` file.
10. The exported database can be re-imported into a clean browser workspace.
11. Imported state reproduces the prior Company Hub state.
12. The majority of the existing SPA remains reusable rather than being rewritten around SQLite.

If those conditions hold, the experiment has answered its main question.

The next architectural decision would then be whether to extend the browser workspace model into artifacts, backup/sync providers, and eventually agent execution.
