# Browser workspace development ledger

Coordinator owns stage gates and local Git commits. Sub-agents own bounded files and record handoffs in `docs/handoffs/`. The existing frontend, backend, and OpenCode integration remain intact.

## Isolation

- Repository: `/Users/jarad/git/ch-poc-002` only.
- FastAPI, if needed: `127.0.0.1:8001`, explicit client URLs and temporary database/artifact storage.
- Browser POC static server: reserve `127.0.0.1:8011`; check availability before launch.
- Test Chrome: separate temporary profile and CDP port 9231; check availability.
- Track and stop only processes launched by this workflow. Never use port 8000.

## Stage gates

0. Behavioral inventory: complete retained-view method/shape/validation inventory, coordinator review, commit.
1. Persistence probe: serialized worker, OPFS commit acknowledgement/recovery, restart and forced-failure checks, commit.
2. Seed and reads: canonical seed and adapted views, read contract checks without FastAPI, commit.
3. Writes: domain parity and reload checks; 10/50/100 MB metrics, commit.
4. Portability: validated import/export/reset and preservation on failure, commit.
5. Verification: automated lifecycle, visible controls, twelve completion criteria and final documentation, commit.

## Progress

- Stage 0 underway. Original specification and approved plan were untracked at start; include them in the initial stage commit as governing project artifacts.
- Stage 0 gate PASSED: coordinator reviewed all 18 retained facade operations, exact view imports, response shapes, DB/application invariants and removed features. Approved local reference attribution and atomic company+initial-locations creation.
- Baseline validation: `.venv/bin/python -m pytest tests/backend -q` — 81 passed, 3 dependency deprecation warnings (16.41 s). No HTTP server started.
- Stage 1 gate PASSED: independent review and 8 browser checks, including actual browser process restart, injected OPFS failure recovery, queued writes, foreign keys after export, SQLite signature, and numeric storage diagnostics. Evidence: tests/stage-1-results.json. sql.js 1.13.0 vendored with license/checksums. No FastAPI service used.
- Stage 2 gate PASSED: deterministic canonical seed generated twice with matching SHA-256; coordinator independently reran Node read-contract checks. Eight browser UI checks passed without FastAPI (directory/search/country/profile/industry/forms/diagnostics/no API requests or runtime errors), followed by eight persistence regression checks. Coordinator visually inspected profile screenshot: readable, no clipping. Existing backend/frontend/OpenCode tracked files unchanged. Evidence: tests/stage-2-ui-results.json and stage-2 handoffs.
- Stage 3 underway with three bounded assignments: write repositories; independent domain invariant tests; actual UI write/reload checks and OPFS size measurements. Coordinator reviews integration. Large fixtures must use temporary canonical DB copies and temporary Chrome profiles, never the shipped seed or a user's workspace. Memory reporting distinguishes WASM allocated heap from total browser process memory.
- Stage 3 gate PASSED: seven independent domain-contract groups and six actual browser UI write/reload groups; 15 measured OPFS saves across 10/50/100 MiB. Final medians recorded in docs/metrics.md. Coordinator corrected interrupted metrics harness and added null-object validation, reran read/write domain suites. Sub-agents hit shared usage limit after writing their implementation/tests; remaining integration completed by coordinator. All work retained on disk; no original app changes.
- Stage 4 gate PASSED: canonical import contract plus six browser portability/control/failure groups. Full export→reset→import restores edits through reload; actual downloaded SQLite header verified; native dialogs accepted in test; failed import/replacement preserves state. Workspace screenshot visually reviewed. Implementation/handoff by coordinator following sub-agent usage exhaustion.
- Stage 5 gate PASSED: final `node poc-browser/tests/run.mjs` ran all seven suites successfully. User-level in-app-browser Export/Import chooser/reload pass completed and visually inspected. All twelve criteria mapped in docs/verification.md. Original frontend/backend/OpenCode unchanged relative to 66dc61a. Temporary UI tab and owned static server stopped. Final documentation and local commit complete the POC.
