# Stage 2 canonical seed handoff

Implemented and executed `poc-browser/scripts/make_seed_db.py` with `.venv/bin/python`. Outputs: `poc-browser/data/seed.db` and `seed.manifest.json`. No server or existing backend/frontend changes.

Generation sets COMPANY_HUB_DB before importing backend modules, runs real run_migrations() and seed_if_empty() in a TemporaryDirectory, and disposes the async engine. Canonical seed logos are temporarily generated there; all artifact rows are deleted and VACUUM removes their metadata from free pages. The temporary directory, including logo bytes, is cleaned automatically. No bootstrap account creation is called.

Generated timestamps are normalized to 2026-09-06T00:00:00Z for deterministic output; publication dates and all seeded domain content remain unchanged. Explicit version is company-hub-seed-v1 and canonical Alembic revision is 0003_sprint03_roles. No browser-specific tables were added.

Validation passed: 6 companies, 83 countries, 6 industries, 19 locations, 12 references, 23 news, 0 artifacts, 0 users, 0 OAuth accounts and 0 access tokens. Every company has exactly one HQ, at least two locations, two references and three news items. Expected canonical tables, integrity_check and foreign_key_check all passed.

File size: 131072 bytes. SHA-256: baf893e2aee4147f092b5eb8fd476234b0b0cf6d34ec4abca6e99030aeb5bb6d. A second independent generation to /tmp/company-hub-stage2-seed-check.db produced an identical SHA-256 and cmp returned success. This proves byte reproducibility with current source and installed dependencies; future seed/schema changes should increment the explicit version.

Consumers: fetch data/seed.db; manifest exposes seedVersion, schemaRevision, seedTimestamp, bytes, sha256, counts and tables. Browser persistence metadata should read/use these real values instead of probe-v1/null. No commit was created by this agent.
