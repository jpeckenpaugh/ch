# Company Hub browser workspace POC

This isolated copy explores Company Hub as a static application with a local
SQLite workspace. The original FastAPI application and OpenCode agents are
unchanged. Agents, authentication and binary artifacts are outside this POC.

## Run

From the repository root:

```sh
python3 poc-browser/serve.py --port 8011
```

Open http://127.0.0.1:8011 in a current Chromium browser. No FastAPI process is
needed. JavaScript, Bootstrap and SQLite WebAssembly are served locally.
The Python script is only a convenient static file server; deployment may use
any static host with correct WebAssembly MIME support. OPFS requires a secure
context (HTTPS or localhost).

The browser origin owns its workspace. Use the same host and port to return to
the same data. Browser storage permission and quota are shown in the app;
export snapshots for backups. Multiple simultaneous tabs are outside scope.

## Development record

- [Contract](docs/contract.md): retained application behavior and adaptations.
- [Ledger](docs/development.md): stage gates and verification evidence.
- [Handoffs](docs/handoffs/): bounded sub-agent work and integration notes.

Automated browser checks use isolated port 8011, Chrome CDP port 9231, and a
temporary browser profile. They refuse occupied ports and clean only their own
processes. Stop your POC static server before running them. Any comparison
against FastAPI must explicitly use port 8001 and temporary data; port 8000 is
reserved for another workflow.

## Verify and regenerate

For development, install the repository's pinned Python dependencies with
`./install.sh` (seed generation only). Browser suites require Node 22+ and
Google Chrome; set `COMPANY_HUB_TEST_CHROME` to another compatible executable
when necessary. Tests currently use `.venv/bin/python` for their static server.

```sh
node poc-browser/tests/run.mjs
node poc-browser/tests/run.mjs --metrics
.venv/bin/python poc-browser/scripts/make_seed_db.py
```

The first command runs domain, import, persistence, read/write UI and portable
workspace suites sequentially. `--metrics` adds the larger save measurements.
Seed generation uses a temporary database and artifacts directory, canonical
migrations and seed logic, and produces a deterministic manifest. It never
bootstraps accounts or includes artifact rows in the browser seed.

## Architecture and boundaries

Views call `js/api.js`; semantic worker operations own validation and SQL.
The worker serializes reads, mutations and workspace replacement. A successful
mutation means the full exported database has been written and its OPFS stream
closed. Failed persistence restores the prior saved database before rejecting.
Revision metadata in `workspace.json` is advisory and is excluded from exports.

Import validates SQLite format, canonical tables/columns, the supported schema
revision, integrity and foreign keys before replacement. The supported revision
is `0003_sprint03_roles`; there is no browser migration engine. Imported artifact
metadata remains in SQLite but files/logos are not displayed or backed up by
this POC. A `.db` export remains a standard database, not an artifact archive.

This is a single-browser, single-tab personal-workspace experiment. Browser
storage can be cleared or evicted; use exports for backups. Large saves copy
the entire database and have increasing latency and memory cost. Native SQLite
OPFS, binary artifacts, synchronization, authentication and agent execution
remain outside scope. The existing OpenCode implementation remains available
in the original server-based app.

See [verification](docs/verification.md) for completion criteria and stage
commits, and [measurements](docs/metrics.md) for observed save costs and memory
measurement limits.

## Local news-ranking benchmark

`#/news-ranking` is an isolated Phase 1 experiment for ranking fixture news
candidates locally with Gemma 4 E2B and WebGPU. It does not read or modify the
browser workspace. See [Gemma news-ranking benchmark](docs/gemma-news-ranking.md)
for its model delivery, evaluation, and Phase 2 boundaries.
