# Stage 0 contract handoff

Completed static inventory of both POC documents, all four retained view imports/callers, API facade, relevant backend routers, serializers, request schemas, models, and baseline/current migrations. Deliverable: `../contract.md`. No source implementation, service, or commit was created.

Key findings for coordinator:

- Actual document API export is generateDocument; planning examples use generatePDF.
- Industry uniqueness is case-insensitive application logic beyond SQLite UNIQUE.
- News PUT omitted/null is_scraped preserves existing true; profile order is id descending.
- Reference added_by is required text, currently auth email: browser contract chooses Workspace owner for new rows and preserves old attribution.
- Company PUT resets omitted optional values; this differs from an agent tool preserving fields before its API call.
- Empty countries array means no filter at facade; nonempty all-blank array matches nothing.
- Existing create form uses non-atomic sequential company/location writes and compensating delete. Coordinator approved optional createCompany(data, locations=[]) aggregate RPC with tiny form adjustment.
- Canonical timestamps use second precision UTC Z, no location timestamps; child changes do not update company.updated_at.

Verification performed: source-level cross-check of exported/imported methods and request/response fields. No runtime assertions claimed. Review/commit this artifact as Stage 0 before repository implementation. All work confined to the two assigned docs.
