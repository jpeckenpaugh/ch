# Stage 3 independent domain contract tests

Created `poc-browser/tests/write-contract.test.mjs` and ran `node poc-browser/tests/write-contract.test.mjs`: all seven domain groups PASS. No implementation changes, browser service or commit from this agent.

The suite opens canonical seed.db in real sql.js, registers actual repository operations, and wraps each marked mutation in BEGIN/COMMIT/ROLLBACK as the worker does. Fixtures exist only in this disposable memory database.

Coverage:

- Required/trimmed company name, unknown industry, generated second-precision UTC timestamps, completeness and full replacement clearing omitted fields.
- Unknown/lowercase country, invalid location type, duplicate HQ, editing same HQ, promoting another HQ rejection, address replacement and deleting the last HQ.
- Required local reference attribution, immutable added_by/created_at, trimmed title/URL and description clearing.
- Valid leap day; rejection of invalid leap/overflow/month/day/year/date-shape values; news omission/null flag preservation, explicit flag changes, false create default and summary replacement.
- All child update/delete operations reject cross-parent and missing IDs; child creation rejects missing company. Child edits leave parent timestamp unchanged.
- Industry trimming/case-insensitive duplicate rejection, same-row case rename, unknown industry, join propagation.
- Aggregate company creation with duplicate HQ or bad country rolls back all inserted rows; successful aggregate stores both locations.
- Company deletion cascades through every child table, missing company operations reject, foreign_key_check remains empty.

No domain defects were encountered in these cases. OPFS persistence acknowledgment/failure and browser reload behavior are separate worker/browser gates, not claimed by this Node suite.
