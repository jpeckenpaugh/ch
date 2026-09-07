# Gemma 4 E2B local news-ranking benchmark

This is Phase 1 of the browser-local news-ranking POC. It is a fixture-only
benchmark: it never reads or writes the user's Company Hub workspace.

## Run

Serve the POC and open `#/news-ranking`. Choose one of the 20 fixture cases.
**Run deterministic baseline** exercises the metadata-only comparison. **Run
Gemma locally** lazily fetches the browser runtime and Gemma model, then runs a
single local WebGPU ranking. The development debug panel holds the prompt, raw
output, parsed ranking, and timings only in page memory.

The Gemma button requires WebGPU. Model weights are intentionally not vendored
in this repository. The adapter pins Gemma-4-capable Transformers.js 4.2.0 from jsDelivr and the
`onnx-community/gemma-4-E2B-it-ONNX` q4f16 WebGPU model artifact. Both are
loaded only after an explicit click and are expected to be cached by the
browser thereafter.

## Benchmark contract

Every fixture has a company, existing-news data for deterministic filtering,
ten structured candidates, acceptable top candidates, and obvious rejects.
Before Gemma runs, JavaScript removes candidates that duplicate existing news;
the model receives only the remaining candidates. Gemma then runs twice: a
screening call returns rejected candidate IDs, and a separate ranking call
orders every surviving ID from best to worst. The model sees no tools and
cannot access SQLite, OPFS, or network search. JavaScript validates each
response, permits exactly one retry after malformed output, and reports
shortfalls rather than inserting unranked results.

The deterministic baseline ranks publisher tier and recency. Evaluation records
top-three label hits and whether obvious rejects were rejected or kept out of
the top three. Real Gemma executions are intentionally manual benchmarks;
automated tests use a fake ranker for reproducible normalization, validation,
retry, and selection checks.

## Live candidate discovery

The company profile's **Find news** control is the Phase 2 entry point. It
searches the Currents News API for the company name. Before using this flow,
the workspace owner adds a personal Currents API key in **Workspace → News
providers**; the browser sends that key with the Currents search request.

The finder requests up to ten recent English-language candidates, normalizes
them, removes candidates already represented in the company's news, and sends
the remaining candidates to Gemma for screening. JavaScript removes the
rejected IDs, then a separate Gemma call ranks every survivor. Existing news is
not included in either model prompt. The user chooses how many ranked articles
to review (one to five). Nothing is written automatically: the user reviews
Gemma's selected articles and explicitly confirms before `createNews()` writes
them to the local workspace.

Missing or rejected keys, request-limit responses, unavailable service, and
empty usable results are displayed in the finder. These cases do not create
partial news records. The Workspace screen also provides controls to test,
replace, or remove the configured Currents key.

## Phase 2 boundary

The collector and profile preview are now implemented; live runs remain
foreground-only and user-confirmed. No scheduled collection or automatic writes
are included.
