# Browser workspace completion report

All twelve POC completion criteria are satisfied. Final sequential verification:
`node poc-browser/tests/run.mjs` — seven suites passed on 2026-09-06.
Raw per-suite completion evidence is in `../tests/stage-5-results.json`.

## Criteria

| # | Requirement | Evidence |
| --- | --- | --- |
| 1 | Static files | serve.py uses only the standard-library static handler; vendored JS/WASM/CSS and seed |
| 2 | No running FastAPI required | All browser suites started only static HTTP and Chrome; no /api resource requests |
| 3 | SQLite executes in browser | sql.js in dedicated worker; real SQL domain and UI operations |
| 4 | Persistent OPFS database | Probe survives page reload and actual Chrome process restart with same isolated profile |
| 5 | Company list renders | Six seeded companies, search and country-filter UI checks |
| 6 | Profile renders | Details, locations, references and news; coordinator screenshot inspection |
| 7 | Representative mutations | Company, location, reference, news and industry UI writes; seven domain-invariant groups |
| 8 | Changes survive reload | UI suite reloads after changes; portable lifecycle reloads edited and imported data |
| 9 | Standard SQLite export | Real Export button downloads file; SQLite header checked on disk; canonical schema preserved |
| 10 | Re-import into clean workspace | Lifecycle resets to seed before importing snapshot |
| 11 | Prior state restored | Export→reset→import recovers marker and survives reload |
| 12 | Majority of SPA reusable | list.js and industries.js copied unchanged; 1,194 of 1,419 original lines across four views retained (~84%); most removed lines are server-only controls |

## Gates and local commits

| Stage | Commit | Gate |
| --- | --- | --- |
| 0 | 46d6ce9 | Reviewed behavior/shape/validation contract; original backend baseline 81 passed |
| 1 | 644bb52 | Eight persistence/browser-restart/failure/queue/FK/diagnostics checks |
| 2 | 272690a | Reproducible canonical seed; read contract; eight UI checks; persistence regression |
| 3 | ac3a885 | Seven domain groups; six UI write groups; fifteen measured 10/50/100 MiB saves |
| 4 | df32424 | Import contract and six portability/visible-control/failure groups |
| 5 | Final verification commit | All seven suites, user-level UI pass, completion documentation |

Sub-agents delivered bounded contracts, implementation, tests, seed and review
handoffs on disk through Stage 3. Shared sub-agent usage limits then stopped
their turns. Coordinator completed remaining metrics integration and Stages 4–5;
no independent-agent review is claimed for those coordinator-owned changes.

## User-level UI inspection

Using the Codex in-app browser on our own port 8011, coordinator opened the
company directory (six seed records), navigated to Workspace, clicked Export,
opened Import through its actual file chooser, selected the shipped canonical
seed, observed import success/revision increment, and reloaded to confirm saved
state. Workspace layout was visually inspected at a narrow viewport: readable
labels, wrapped explanatory text and all three controls without clipping.
The separate CDP gate verifies actual downloaded bytes, native confirmation
dialogs, and changed-data round-trip restoration. This is agent-performed UI
inspection, not a claim of human acceptance testing.

Temporary inspection tab and static server were closed. Automated suites used
temporary Chrome profiles and cleaned their own processes. No process on port
8000 was used or stopped; no FastAPI instance was needed. Any future FastAPI
comparison is reserved to 8001. Original frontend/, backend/ and opencode/
are unchanged relative to 66dc61a.

## Persistence and limits

Writes acknowledge only after OPFS stream close. Failed saves restore committed
bytes before rejecting. Foreign keys are re-enabled after every sql.js export
(the runtime resets connection pragmas). Import/reset serialize with reads and
writes and validate before closing live state; failed replacement restores the
previous database. Sidecar failure handling is source-reviewed, not separately
fault-injected; metadata is advisory and cannot reject a saved mutation.

Canonical schema revision is 0003_sprint03_roles; no browser migrations, binary
artifacts, agents, authentication, synchronization or multi-tab coordination are
included. Browser persistence permission was not granted in test profiles, so
exports remain the backup mechanism. Native SQLite OPFS VFS remains deferred.
Memory samples are partial measurements, not full process peaks; see metrics.md.
The benchmark's 100 MiB median save was about 95 ms on this host, with a range
up to 162 ms. Larger/frequent writes warrant a later native-OPFS investigation.

Browser tests exercised Chrome 152 and the Codex in-app browser; no claim is made
for other browser engines. The original backend baseline emitted three existing
dependency deprecation warnings; all 81 baseline tests passed.
