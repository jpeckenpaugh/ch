# Whole-database persistence measurements

Five sequential acknowledged industry mutations per size, in an isolated temporary Chrome profile. Fixtures copy the canonical seed and pad an existing description; no schema changes or shipped seed edits. Each trial uses the real worker transaction/export/OPFS write-close path. The same worker runs all sizes, so later samples include allocator retention. Reproduce with `node poc-browser/tests/metrics.test.mjs`.

Browser: Chrome/152.0.7977.77; platform macOS. Recorded: 2026-09-06T17:50:15.773Z. Timing is worker export + OPFS persistence including advisory sidecar; round-trip timings are also in the raw JSON. These are local observations, not performance guarantees.

| Target MiB | Export bytes | Median save ms | Range ms | WASM capacity bytes | Last sampled page JS bytes |
| --- | --- | --- | --- | --- | --- |
| 10 | 10,625,024 | 10.9 | 8.4–12.2 | 22,151,168 | 11,989,108 |
| 50 | 52,609,024 | 45.2 | 43.0–74.8 | 22,151,168 | 74,835,896 |
| 100 | 105,091,072 | 95.0 | 87.7–161.5 | 22,151,168 | 158,684,088 |

WASM capacity stayed at 22,151,168 bytes in these operations; this excludes sql.js virtual-filesystem storage, exported byte arrays, structured-clone copies, and browser/OPFS overhead. Worker JavaScript heap measurement was unavailable (null). Page JS sampling is only a coarse memory observation, not worker or process peak memory. Exported byte size explicitly measures the additional full snapshot allocation; at 100 MiB it is approximately 105 MB per export. Do not read the small WASM capacity as total memory use.

Storage was browser-managed (persistent permission false); measured quota was approximately 10.10 GiB and no quota errors occurred. Raw samples contain usage/quota for each trial.

Decision: retain whole-DB saves for this POC. Small workspaces are inexpensive here; 100 MiB saves already cost tens to hundreds of milliseconds and allocate a full copy. Native SQLite OPFS remains a justified next experiment for large workspaces or frequent writes; these measurements do not support a general large-data scalability claim. No engine change is necessary to complete this POC.

Evidence: `../tests/stage-3-metrics-results.json`.
