# Stage 3 domain writes

All 14 mutating operations are registered with `write=true` in `js/db/repo/`. Worker transaction and persistence code remains the single commit boundary; repositories use parameter-bound SQL and query/run closures. Company creation optionally inserts initial locations inside the same operation, so validation/FK/HQ failures roll everything back.

Shared validation covers trimmed required strings, nullable optional strings, UTC second-resolution timestamps, strict real calendar dates (including leap years), structured domain status/detail, parent existence and child ownership. Company/child updates replace editable optional values; reference attribution and creation timestamps remain immutable; news omitted/null is_scraped preserves the previous boolean. Industries enforce trimmed case-insensitive duplicate rules and resolve through company joins. Locations enforce exact country lookup, allowed types and one HQ alongside canonical constraints. No agent-specific research or URL deduplication rules were added.

`worker.status` exposes optional `databaseMemoryBytes` (WASM heap capacity) and `workerJSHeapBytes`; `lastSave` includes before/after export WASM capacity and total save milliseconds. Unsupported measurements are null; these are not total/peak browser process memory. Metrics agent owns measured results and interpretation.

Read-contract regression passed after enabling write registration in its harness. Independent write suite and browser save/reload/metrics checks belong to contract/testing agents; coordinator owns stage gate/commit. No original backend/frontend/OpenCode changes, no raw SQL RPC, no HTTP service started by this agent.
