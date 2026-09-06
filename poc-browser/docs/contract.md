# Browser Company Hub application contract

Stage 0 inventory, 2026-09-06. Sources: `poc-browser-only.md`, `docs/poc-browser-only-plan.md`, the four retained `frontend/js/{list,profile,form,industries}.js` views, `frontend/js/api.js`, `backend/schemas.py`, `backend/serializers.py`, the routers below, models, and canonical migrations. This is the SPA-facing contract; HTTP is not part of the browser runtime. Existing frontend, backend, and OpenCode workflows remain unchanged.

## Response types

All facade operations return promises. IDs are numbers. Nullable fields are explicitly `null`. Arrays are always arrays, including empty arrays. Database failures and domain validation reject with an `Error` carrying `message`, `status` (404/409/422 for domain cases), and optionally `detail`/`body`; preserve these through RPC because the form checks `err.status` and all views display `err.message`. Do not expose SQL or require view-side SQL.

- `Industry`: `{id, name}` (created_at is stored but not returned).
- `Country`: `{code, name}` (id and created_at are not returned).
- `Company`: `{id, name, industry: Industry|null, hq_location: string|null, website, contact_email, contact_phone, description, created_at, updated_at, is_complete: boolean, artifacts_count: 0, logo_url: null}`. No top-level `industry_id` in the response; form reads `industry.id`.
- `Profile`: all Company fields plus `{locations: Location[], references: Reference[], news: News[], artifacts: []}`.
- `Location`: `{id, company_id, label, address: string|null, city, country_code, type, country_name: string|null}`. No location timestamps exist.
- `Reference`: `{id, company_id, title, url, description: string|null, added_by, created_at, updated_at}`.
- `News`: `{id, company_id, title, source, url, published_at, summary: string|null, created_at, updated_at, is_scraped: boolean}`. Convert SQLite 0/1 to actual boolean.

## Operation matrix

Router locations below are relative to `backend/routers/`; all request validation also refers to `backend/schemas.py`. Input definitions and rule keys follow the matrix. `companyId` and each entity ID are separate arguments to the facade, and explicit fields in the worker payload.

| SPA method(arguments) | Browser operation | Class | Response | Tables | Backend implementation / rules |
| --- | --- | --- | --- | --- | --- |
| listCompanies(q, countries) | companies.list | READ | Company[] | companies, industries, locations | companies.py:list_companies; LIST, DERIVE |
| getCompany(id) | companies.get | READ | Profile | companies, industries, countries, locations, references, news_articles | companies.py:get_company; PROFILE, DERIVE; missing company 404 |
| createCompany(data) | companies.create | WRITE | Company | companies, industries | companies.py:create_company; COMPANY; timestamps generated |
| updateCompany(id, data) | companies.update | WRITE | Company | companies, industries, locations | companies.py:update_company; COMPANY; full replacement, preserve created_at, regenerate updated_at |
| deleteCompany(id) | companies.delete | WRITE | null | companies and cascading children | companies.py:delete_company; missing company 404; database cascade; omit server file-directory removal |
| listCountries() | countries.list | READ | Country[] | countries | reference.py:list_countries; ORDER |
| listIndustries() | industries.list | READ | Industry[] | industries | industries.py:list_industries; ORDER |
| createIndustry(name) | industries.create | WRITE | Industry | industries | industries.py:create_industry; INDUSTRY; generate created_at |
| renameIndustry(id, name) | industries.update | WRITE | Industry | industries | industries.py:rename_industry; INDUSTRY; missing industry 404; created_at unchanged |
| createLocation(companyId, data) | locations.add | WRITE | Location | companies, countries, locations | locations.py:create_location; LOCATION |
| updateLocation(companyId, locationId, data) | locations.update | WRITE | Location | companies, countries, locations | locations.py:update_location; LOCATION; full replacement |
| deleteLocation(companyId, locationId) | locations.delete | WRITE | null | companies, locations | locations.py:delete_location; OWNERSHIP; deleting HQ/last location allowed |
| createReference(companyId, data) | references.add | WRITE | Reference | companies, references | references.py:create_reference; REFERENCE; generate attribution and both timestamps |
| updateReference(companyId, referenceId, data) | references.update | WRITE | Reference | companies, references | references.py:update_reference; REFERENCE; replace editable fields, preserve attribution/created_at |
| deleteReference(companyId, referenceId) | references.delete | WRITE | null | companies, references | references.py:delete_reference; OWNERSHIP |
| createNews(companyId, data) | news.add | WRITE | News | companies, news_articles | news.py:create_news; NEWS; generate both timestamps |
| updateNews(companyId, newsId, data) | news.update | WRITE | News | companies, news_articles | news.py:update_news; NEWS; preserve created_at; generate updated_at |
| deleteNews(companyId, newsId) | news.delete | WRITE | null | companies, news_articles | news.py:delete_news; OWNERSHIP |

### Worker payload convention

Lock these names for independent facade/repository work: reads `companies.list {q, countries}`, `companies.get {id}`, `countries.list {}`, `industries.list {}`; company writes `companies.create {data, locations: []}`, `companies.update {id, data}`, `companies.delete {id}`; industry writes `industries.create {name}`, `industries.update {id, name}`; child adds `locations.add/references.add/news.add {companyId, data}`, updates `locations.update/references.update/news.update {companyId, id, data}`, deletes `locations.delete/references.delete/news.delete {companyId, id}`. The facade maps entity-specific IDs to worker `id`. One request envelope carries `{id: requestId, op, payload}`; response correlates requestId and carries result or serialized error. Request ID is transport metadata, distinct from payload entity IDs.

### Inputs and application-enforced rules

**COMPANY:** `{name, industry_id?, website?, contact_email?, contact_phone?, description?}`. Name must be a string, trimmed and nonempty. Optional strings default to null; industry ID defaults to null and must reference an existing industry when supplied (`422 Unknown industry_id`). PUT requires name and resets omitted optional fields to null; it is not a patch. UI already trims optional strings and converts blanks to null, but backend does not independently trim those optional values. Preserve that distinction (e.g. whitespace in a directly supplied description is truthy). No company-name uniqueness rule, URL/email format validation, or maximum lengths exist in this schema. Ignore unknown input fields, never assign arbitrary column names.

**LOCATION:** `{label, address?, city, country_code, type}`. Required strings label/city/country_code are trimmed and nonempty; address defaults null. Type is exactly `Headquarters`, `Office`, `Plant`, or `Other`. Country lookup is exact/case-sensitive after trimming; do not uppercase silently (`422 Unknown country_code`). A second HQ is rejected (`422 Company already has a Headquarters`) without demoting/replacing the existing HQ; update excludes its own ID when checking. There may be zero HQs or zero locations. Full replacement includes clearing omitted address. Location changes do not touch company.updated_at.

**REFERENCE:** `{title, url, description?}`. Required title/url are trimmed nonempty strings; description defaults null. URL is not validated beyond nonempty by backend. On create, generate identical created_at/updated_at and attribution; on update, replace title/url/description, update updated_at, preserve added_by/created_at. No duplicate-URL constraint exists. `added_by` is a required plain text snapshot, not a user FK. Browser adaptation: use the fixed label `Workspace owner` for new references because there is no authenticated user. Preserve existing imported/seed attribution verbatim.

**NEWS:** `{title, source, url, published_at, summary?, is_scraped?}`. Required title/source/url are trimmed nonempty strings. Trim published_at; require exact `YYYY-MM-DD` and a real calendar date (reject leap-day errors, month/day overflow, and invalid year). Store it as a date string rather than converting it to a timestamp. Summary defaults null. Create defaults is_scraped to false when omitted/null; update preserves the existing flag when omitted/null, including UI edits (UI never supplies it). Explicit boolean changes it. Other editable fields are fully replaced; regenerate updated_at only. No URL uniqueness/verification, automatic scraping, or parent timestamp change. OpenCode's external research checks are not backend domain requirements.

**INDUSTRY:** Trim name, reject blank/non-string. Duplicate detection uses `lower(name)` against the trimmed new name, case-insensitively at application level; reject `409 Industry already exists`. Rename excludes the current ID, so renaming the same row or changing only its case is allowed. Companies resolve industry names through their stored FK on every read; no company updates or timestamp changes are needed.

**OWNERSHIP:** For all child operations first check parent exists (`404 Company not found`); update/delete then match both child.id and child.company_id, returning respectively `404 Location not found`, `404 Reference not found`, or `404 News article not found`. An existing child belonging to a different company must never be modified. Unknown company on company get/update/delete also returns `404 Company not found`; industry rename uses `404 Industry not found`.

**Timestamps:** Backend `config.py:utc_now` produces UTC `YYYY-MM-DDTHH:mm:ssZ` (seconds, no milliseconds). Use this shape for generated values. Preserve imported strings unless mutating that timestamp. The two reference/news creation timestamps use the same instant. No browser-specific timestamp columns or revision tables belong in SQLite.

### Read rules and pure derivations

**LIST:** q filters company.name using case-insensitive SQL `LIKE '%q%'`; `%` and `_` in q remain LIKE wildcards (not escaped literal search). The UI trims q before calling. Combine search AND country filter. A nonempty countries array matches a company if ANY location.country_code is in that set, independent of HQ, without duplicate company results. Order companies by numeric id ASC. Facade `countries=[]`, omitted, or null means no filter, matching the original facade's omission of an empty query parameter. A nonempty array containing only blank codes corresponds to an explicitly present but empty backend filter and matches nothing after trimming. Unknown nonempty codes match nothing; no validation error. Country codes are not case-normalized.

**ORDER:** Industries and countries sort by `lower(name), name` using SQLite ordering. Locations in profiles sort id ASC. References and news sort id DESC, not publication time. Do not change news ordering to chronological date order.

**DERIVE (PURE DERIVATION):** completeness is truthy name AND industry_id is not null AND each of website/contact_email/contact_phone/description is truthy; locations, artifacts, logos do not count. It is never persisted. `industry` is a joined `{id,name}` or null. `hq_location` is `city + ', ' + country_code` for the HQ (first by id if malformed data contains more than one), else null. `country_name` is a country join, else null. Browser artifacts_count is always 0, logo_url always null; do not synthesize `/api/...` links even when imported databases contain artifact metadata.

**PROFILE:** Return the company response plus child arrays above. Browser `artifacts` remains [] even on import with artifact rows, since bytes are absent. Do not remove canonical artifact schema or silently rewrite imported artifact metadata merely to render it.

## Database-enforced rules

Use the migrated schema, not ORM create_all. Baseline migration includes rules not declared in every model. Current recognized revision is `0003_sprint03_roles` in `alembic_version`.

- AUTOINCREMENT integer primary keys; IDs are generated, never supplied by editable payloads.
- Company industry FK; location country_code FK to countries.code.
- companies → locations/references/news_articles/artifacts: `ON DELETE CASCADE`. Enable `PRAGMA foreign_keys=ON` for every database opening, including after import/recovery.
- Industries name UNIQUE; countries code UNIQUE and name UNIQUE. Default unique comparisons are not a replacement for industry case-insensitive application validation.
- `idx_locations_one_hq`: partial unique company_id where type='Headquarters'. `ck_locations_type`: allowed type CHECK. Both are required alongside readable application validation.
- `idx_artifacts_one_logo` remains canonical though artifact operations are excluded.
- Required columns are NOT NULL, but most nonempty-string rules, date validity, attribution immutability, and boolean API representation are application responsibilities. Quote the SQL table name `"references"`.

## Exact view imports and trimming

| View | api.js exports currently imported | app.js exports currently imported |
| --- | --- | --- |
| list.js | listCompanies, listCountries | esc, completenessBadge, canMutate |
| form.js | createCompany, updateCompany, deleteCompany, getCompany, listIndustries, listCountries, createLocation | esc, showToast, canMutate |
| industries.js | createIndustry, listIndustries, renameIndustry | esc, showToast, canMutate |
| profile.js | getCompany, listCountries, createLocation, updateLocation, deleteLocation, createReference, updateReference, deleteReference, createNews, updateNews, deleteNews; plus removed methods below | esc, completenessBadge, sourceBadge, formatSize, formatDate, showToast, canMutate |

Browser app exports at minimum `esc`, `completenessBadge`, `canMutate` (always true in owner mode), `showToast`, `formatDate`. `sourceBadge` and `formatSize` may be removed from profile imports when artifact rendering is trimmed, or preserved as pure helper exports. Preserve escaping of all five HTML-sensitive characters and null→empty string. Preserve toast container/Bootstrap integration. Router retains `#/`, `#/companies/new`, `#/companies/:id`, `#/companies/:id/edit`, `#/industries`; no auth prerequisite. Inspect imports again after copying; ES module missing exports fail before any screen renders.

| Existing export/control | Classification | Browser disposition |
| --- | --- | --- |
| uploadArtifact(companyId,file), deleteArtifact(id) | SERVER-ONLY → REMOVE | Remove imports, handlers, upload/delete controls and download links; files card retains empty state |
| generateDocument(companyId) (called generatePDF in planning examples) | SERVER-ONLY → REMOVE | Remove generate button/feedback/handler/import |
| uploadLogo(companyId,file), deleteLogo(companyId) | SERVER-ONLY → REMOVE | Remove logo upload/remove handlers/controls; no binary storage |
| download_url, logo_url server URLs | SERVER-ONLY → REMOVE / fixed null | Never generate or fetch backend URLs |
| login, logout, me, changePassword, providers, setOnUnauthorized | SERVER-ONLY → REMOVE | No session, login, OAuth, password controls or unauthorized redirect |
| listUsers, createUser, updateUser, deleteUser | SERVER-ONLY → REMOVE | No users screen/navigation |
| HttpError | HTTP adapter implementation | Optional compatibility alias for domain Error shape; no HTTP transport |

## Transaction and persistence boundary

Every mutating worker RPC is one SQL transaction followed by one export/persist; acknowledge only after OPFS writable.close succeeds. On a failed persist, discard in-memory DB and reopen last persisted DB before rejecting; subsequent reads cannot observe failed edits. Serialize reads too around writes/import/reset so none observes an intermediate replacement. Revision sidecar is advisory, updated after successful DB persistence; sidecar failure must not make a committed mutation appear failed. Every prepared statement is freed in finally.

The existing form creates a company, then each initial location through separate calls, and compensates errors with best-effort deleteCompany. Approved browser adaptation: `createCompany(data, locations=[])` passes optional initial locations into one `companies.create` transaction; validate all and create atomically, then navigate using returned company.id. Existing one-argument callers remain compatible. This removes partial company creation if persistence/validation fails and matches the plan's aggregate-operation boundary. Update copied explanatory text accordingly. Coordinator approved this choice during Stage 0.

Workspace export/import/reset are additional semantic operations with exclusive queue ownership. Temporary import validation checks header, expected canonical core tables, supported alembic revision, integrity_check and foreign_key_check before replacing live state. Import/reset share one replacement mechanism; failed validation or persistence preserves the old workspace. Main-thread persist()/estimate() status is diagnostic, not a precondition for mutation.

## Verification cases handed to later stages

Read gate: exact response keys/types, null industry/HQ, completeness combinations, company id ordering, wildcard/case search, any-location country match without duplicates, empty facade filter, child ordering, country names, industry rename reflected on company reads.

Write gate: blank required text; unknown industry/country; invalid dates; duplicate industry with different case; same-row rename; second HQ; same HQ edit; deletion of final HQ; cross-parent child IDs; full replacement clears omitted optional values; news omitted flag preserved; immutable reference attribution; timestamps; cascade deletion; failed mutation leaves state unchanged before/after reload; aggregate company+locations failure leaves no partial rows. New references use Workspace owner. No added URL/company-name uniqueness policy.

Portability gate: standard canonical SQLite export; successful export→reset→import; invalid schema/revision/corruption/FK rejection leaves data intact; OPFS failure recovery; manual visible controls and CDP lifecycle; no /api calls. Any optional FastAPI comparison must bind only 8001 with isolated data; do not touch port 8000 or another worker's directory/processes.
