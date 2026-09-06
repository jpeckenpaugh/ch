# Stage 1 persistence gate harness

Owned artifacts: `poc-browser/tests/persistence.test.mjs` and the generated `stage-1-results.json` next to it.

Run from repository root with Node 22+ (built-in WebSocket):

```sh
node poc-browser/tests/persistence.test.mjs
```

The runner starts `.venv/bin/python poc-browser/serve.py --port 8011`, runs Chrome with a new temporary profile and CDP port 9231, and refuses to proceed if either port is occupied. It never connects to an existing server or browser. It tracks only children it launched, closes those children, and removes its own temporary profile at completion. Override the Chrome executable with `COMPANY_HUB_TEST_CHROME` if needed.

Coverage: empty probe seed; acknowledged mutation; navigation reload; Chrome process termination and reopening using the same profile; injected persistence failure with restored old state; successful subsequent write and reload; concurrently submitted mutations preserving order and unique IDs; SQLite export signature; foreign keys remaining enabled after export and mutation; diagnostics including save timings, byte counts, revision, quota and persistence grant. The test uses only `/probe.html` and its separate probe workspace. It imports the existing repository CDP utility without editing it.

Status: PASS. `node --check poc-browser/tests/persistence.test.mjs` and `node poc-browser/tests/persistence.test.mjs` completed successfully. All eight browser checks passed on 2026-09-06. See `poc-browser/tests/stage-1-results.json` for recorded evidence. The browser gate required sandbox escalation for loopback port binding and Chrome; all child processes and its temporary profile were cleaned up. No FastAPI instance was needed for this stage.
