# Stage 1 persistence handoff

Implemented isolated probe and browser DB transport/storage at `poc-browser/js/db/`. Probe uses `company-hub-probe` OPFS directory; app default uses `company-hub`. No backend HTTP requests or original-app changes.

## Contract and design

`client.js` exports `db` and `createClient({probe})`. The promise API is `init`, `call(op,payload)`, `status`, `exportWorkspace`, `replaceWorkspace(bytes)`, `resetWorkspace`, `closeWorkspace`. RPC errors preserve message/name/status/detail/body. Storage persist grant and quota estimate are requested on the main thread and returned in status. Probe exposes `window.probe` and `window.probeReady`.

All requests, including reads, initialization, exports and replacements, run in one worker promise queue. Writes wrap the semantic handler in BEGIN/COMMIT, export once, close the OPFS replacement stream, then resolve. On persistence error the worker closes its advanced database and reopens the committed OPFS file before rejecting. Recovery failure leaves it unavailable until reload. Failed sidecar writes produce metadataWarning but never fail an already committed mutation. sql.js export resets connection pragmas; every active snapshot restores foreign_keys in finally.

The OPFS `WorkspaceStorage` provides openWorkspace, replaceWorkspace, exportWorkspace (persisted snapshot for recovery), resetWorkspace, closeWorkspace. sql.js live-snapshot production belongs to the worker adapter; future native OPFS can change that adapter without altering client or views. Sidecar revision is advisory across metadata-write failures. Probe seedVersion is probe-v1; canonical defaults are company-hub-seed-v1 and schema revision 0003_sprint03_roles, passed as storage options.

## Stage 2 repository extension

Worker-local `register(name, handler, write=false)` registers explicit semantic operations. A handler receives the RPC payload and returns response data (or a promise). Mark writes true; repositories must not BEGIN/COMMIT/export/persist themselves. Worker `query(sql, params)` frees prepared statements in finally. A repository registration module may export `registerOperations({register, query, run})`; wire it in initialize after opening the database, with `run:(sql,params)=>database.run(sql,params)`. Pass closures rather than a database handle, because recovery/import replaces that handle. No raw SQL operation may be exposed to the client.

`seed.js` caches seed bytes; canonical mode fetches `data/seed.db`. Stage 2 should verify canonical seedVersion/schemaRevision match the generated seed. Stage 4 must add canonical header/table/revision/FK checks before replacement; current probe replacement checks successful opening and integrity only.

## Verification interfaces

`probe.read` returns ordered `{id,value}` rows, `probe.add {value}` inserts one record, `probe.foreignKeys` returns 1, `test.failNextPersist` arms one failure after OPFS stream write but before close. Test hooks exist only with probe worker option. Canonical mode has none. Probe HTML initializes on load, shows status and records, supports add/reset/forced failure. init is idempotent.

Coordinator/test agent owns executable browser results and stage gate. Implementation syntax check: `node --check poc-browser/js/db/worker.js` passed. Browser automated checks are in `tests/persistence.test.mjs`; static service port 8011 and CDP 9231 reserved for this task; FastAPI if ever needed uses only 8001.
