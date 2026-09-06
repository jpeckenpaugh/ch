# Stage 2 read repositories

Implemented `companies.list`, `companies.get`, `countries.list`, `industries.list` in `js/db/repo/`; canonical worker initialization imports the registry with query/run closures over its current database. Probe initialization remains unchanged. There are no write registrations in this stage.

Company projections expose exactly the SPA fields, joined industry/HQ, derived completeness and fixed null logo/zero artifacts. Profiles add ordered locations with country names, descending references/news, boolean is_scraped, and empty artifacts. Search retains SQL wildcard semantics; country EXISTS avoids duplicates and matches office locations. Empty omitted/null/[] country filters are unrestricted; nonempty all-blank filters match nothing. Missing profiles reject 404 with structured detail.

Stage 3 can extend the registration modules and shared helpers. Register writes with the third argument true and leave transactions/persistence in the worker. `registerCompanies` returns getItem for write result serialization; closure-based helpers ensure imports/recovery cannot leave stale DB handles.

Verification: `node poc-browser/tests/read-contract.test.mjs` passes against the canonical seed. The test runs actual vendored sql.js with seed bytes, exercises seed counts and contract edges, and modifies fixtures only in memory. No HTTP server, backend process, canonical seed changes, or original-app edits were involved. UI rendering and final stage gate belong to coordinator. No commit made by this agent.
