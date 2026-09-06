# Stage 4 portability integration

Coordinator completed this bounded stage after sub-agent usage exhaustion. New schema.js validates the canonical table/column set and single supported Alembic revision. Imports additionally check SQLite signature, successful opening, integrity, and foreign keys in a temporary candidate. Startup does lightweight schema/revision validation only. Import/reset share the worker replacement path and serialized queue.

A validated candidate stays open while the old DB is closed and OPFS replacement commits, eliminating a fallible reopen after success. Failed persistence closes the candidate and restores the previous persisted state. Export returns transferable normal SQLite bytes with no browser tables.

Workspace UI implements real download, file selection, confirmation for replacement/reset, busy controls, errors and readable storage/size/quota/revision/save status. Schema metadata remains advisory in OPFS.

Gate: Node import contract passed canonical/header/truncation/unrelated/missing-column/missing-table/revision/FK cases; read and seven write-domain groups pass. Six CDP portability groups pass: full lifecycle including reload, invalid import preservation, actual visible export/download with SQLite header checked on disk, native reset dialog, real import file input/native dialog, failed replacement persistence preserving old state. Coordinator visually inspected the workspace screenshot: controls and status readable without clipping. Quota label clarified as total quota and GB formatting added after visual inspection. No native-picker manual selection claim: file choice is driven by CDP; final stage includes user-level UI inspection.

Evidence: tests/stage-4-results.json and tests/portability.test.mjs. All tests isolated to 8011/9231; no FastAPI or other agent services touched.
