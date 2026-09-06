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
in this repository. The adapter uses Transformers.js from jsDelivr and the
`onnx-community/gemma-4-E2B-it-ONNX` q4f16 WebGPU model artifact. Both are
loaded only after an explicit click and are expected to be cached by the
browser thereafter.

## Benchmark contract

Every fixture has a company, bounded existing-news context, ten structured
candidates, acceptable top candidates, and obvious rejects. The model sees no
tools and cannot access SQLite, OPFS, or network search. It returns ranked and
rejected candidate IDs. JavaScript validates candidate IDs and disjointness,
permits exactly one retry after malformed output, and reports shortfalls rather
than inserting unranked results.

The deterministic baseline ranks publisher tier and recency. Evaluation records
top-three label hits and whether obvious rejects were rejected or kept out of
the top three. Real Gemma executions are intentionally manual benchmarks;
automated tests use a fake ranker for reproducible normalization, validation,
retry, and selection checks.

## Phase 2 boundary

No live search, Company Hub reads, or writes belong here. If this benchmark
shows useful, stable ranking quality, the same ranking module can later receive
the `collectNewsCandidates({company, existingNews, limit: 10})` interface and
present a preview for explicit user confirmation before calling
`addCompanyNews()`.
