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
