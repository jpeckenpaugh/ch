# Stage 1 independent review

Reviewed `js/db/{worker,persistence,client,seed}.js`, `probe.html`, and `tests/persistence.test.mjs` against the approved Stage 1 contract. No gate-blocking defect found. Review was read-only; implementation and tests belong to the persistence/test agents.

## Checked invariants

- All incoming operations chain through one worker promise queue, including reads and replacement. One mutation performs BEGIN/handler/COMMIT, then one export and OPFS replace before response.
- OPFS replacement awaits writable.close before success; write failure attempts abort. Mutation export/persist failure closes memory DB and reopens persisted bytes before rejection. Recovery failure marks the worker failed, rejecting subsequent requests.
- Sidecar writing happens only after DB close succeeds and catches its own failures. An advisory metadata failure cannot incorrectly reject a successful DB mutation.
- sql.js export restores PRAGMA foreign_keys=ON in finally. Fresh, recovery and replacement openings also enable foreign keys. Query statements and temporary databases close/free in finally.
- Worker alone uses importScripts and explicit URLs for sql.js/WASM. Main thread calls navigator.storage.persist and estimate; unavailable/denied storage persistence is nonblocking diagnostic information.
- Probe has separate company-hub-probe OPFS directory. Test serves 8011 and CDP 9231, uses a temporary Chrome profile, refuses occupied ports, and cleans its own child processes. No use of port 8000 or FastAPI.

## Findings and resolution

Minor robustness observation sent to persistence agent: a synchronous postMessage serialization failure could retain its entry in the client's pending map. Promise rejection already works; recommend catch/delete pending before rethrow/reject. This does not affect the defined serializable operations or Stage 1 behavior.

Asked test agent to strengthen diagnostics assertions beyond object presence. The first recorded browser result confirms persistent=false, numeric usage/quota, revision 11 and saved state; lastSave is legitimately null after a worker reload because timing samples are session-local.

Inspected `tests/stage-1-results.json` recorded at 2026-09-06T17:37:58.032Z: all seven cases passed, covering mutation, reload, full browser process restart, forced OPFS write failure with immediate recovery and subsequent successful write, eight queued mutations without loss, SQLite export header, and diagnostics. This is test-agent evidence, not a second independent runtime run. Advisory-sidecar failure handling is source-reviewed; the browser failure injection targets DB persistence.

## Explicit stage boundaries

Probe replacement currently validates SQLite integrity only. Canonical tables/revision/header/FK import checks remain a required Stage 4 gate, not complete Stage 1 functionality. Probe seedVersion/schemaRevision are intentionally probe metadata and must change for the real seed. Future repository integration must preserve the existing transaction wrapper and statement cleanup rather than persisting inside repository statements.
