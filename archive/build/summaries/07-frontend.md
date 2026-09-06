# Summary: Frontend Engineer (Stage 7)

- **Date:** 2026-09-01
- **Author / Executor:** Frontend Engineer role (agent)
- **Instruction file:** `instructions/build/07-frontend.md`
- **Commit:** `stage 07: implement bootstrap frontend SPA`

## Work Completed

Built the browser interface as a pure static, client-side Bootstrap SPA under
`frontend/`, served by the FastAPI backend at `/`. It is a strict API client
with no client-side persistence: every view change fetches from the backend, so
the list, profile, and forms always reflect current backend state (per the
architecture's state-flow and Briefs 01/02). Implements all user-visible modes
from the five briefs — browse+search+click-through list, company profile with
completeness indicator and related content, add/edit form with save/cancel, and
artifact upload/delete plus synchronous document generation with inline
success/failure feedback. All five frontend modules passed syntax validation
and every static asset serves with the correct MIME type from the running
server; the full API surface the SPA consumes was exercised live via `curl`
against `./run.sh` (logs in `./tmp/`).

## Outputs Produced

- `frontend/index.html` — SPA shell (navbar, `#view`, toast area), loads vendored
  Bootstrap + icons + `js/app.js` ES module
- `frontend/css/style.css` — custom styles over Bootstrap (badges for
  complete/incomplete and upload/generated sources, scannable table, profile dl)
- `frontend/js/app.js` — hash router, shared helpers (`esc`, badges, size/date
  formatting, toast), view dispatch
- `frontend/js/api.js` — fetch wrapper + typed functions for every documented
  endpoint; `HttpError` carries status/detail/parsed body
- `frontend/js/list.js` — list view: debounced (250 ms) name search via
  `GET /api/companies?q=`, completeness badge, artifact count, click-through
- `frontend/js/profile.js` — profile view: structured details, completeness
  badge, Edit + Generate actions, upload form, artifact list with
  download/delete, inline generation success/failure messages
- `frontend/js/form.js` — add/edit form (all seven fields, name required,
  save/cancel), full-replace `PUT` on edit
- `frontend/vendor/bootstrap/` + `frontend/vendor/bootstrap-icons/` — Bootstrap
  v5.3.3 and Icons v1.11.3 vendored locally (no CDN, no runtime network)

## Key Decisions

- **Bootstrap vendored locally** (human-resolved Q1): no CDN/network dependency;
  app is fully offline after `frontend/` is in place. No build step — plain JS
  ES modules + static assets.
- **No company-delete UI** (human-resolved Q2): deletion left to the API /
  automated workflows; the SPA exposes add/edit, artifact delete, and
  generation only.
- **Generate stays enabled for incomplete companies** (human-resolved Q3): the
  button is always active; a `422` response renders the backend's failure
  message inline on the profile (matching Brief 05 feedback).
- **Live debounced search** (human-resolved Q4) on the list view.
- **Approved defaults applied:** forms submit all seven fields with `""` for
  cleared optional fields; list rows show completeness badge + artifact count;
  edits via full-replace `PUT`; hash-based routing (server always serves
  `index.html`).
- **Post-save navigation:** after create → navigate to the list (shows the new
  company appearing); after edit → navigate back to the profile (shows updated
  info). Both with a success toast.
- **Artifact delete guarded by a native `confirm()`** to avoid accidental
  removal (Brief 04 "when it is no longer wanted").
- **All dynamic text escaped** via a single `esc()` helper when injected into
  the DOM to avoid HTML injection from stored company/artifact data.
- **Download via plain anchor** to `download_url`; the backend already sends
  `Content-Disposition: attachment`, so the `download` attribute is a belt-and-
  suspenders cue.

## Open Questions & Concerns

- **BLOCKER — backend company responses omit `id`.** The running backend
  serializes companies without the `id` field: `GET /api/companies`,
  `POST /api/companies`, `PUT /api/companies/{id}`, and `GET /api/companies/{id}`
  all return company objects lacking `id`, even though the documented contract
  (`docs/architecture.md` §4, e.g. lines 170–186, 221–233) requires `"id": 1`.
  The SPA routes by `id` (list rows → `#/companies/{id}`, edit links, and the
  create response to navigate to the new profile), so it cannot function until
  this is fixed. This is a backend (Stage 6) defect outside the frontend's
  scope; I did not modify the backend. **Recommended one-line fix:** include
  `id` in `company_to_dict` in `backend/models.py` (add `"id"` to the returned
  dict). The verification stage must confirm this before end-to-end testing.
- **Because of the blocker above, the SPA could not be end-to-end verified in a
  browser.** I verified all static asset serving, JS syntax, and every API call
  the SPA makes against the live server (list/search, profile, create, PUT,
  upload, download headers, delete, generate 201 and 422). Those all return the
  documented shapes/statuses; only `id` is missing.
- **Search scope** remains name-only per the architecture (flagged by Stage 6
  too); the search box sends `?q=` to the documented endpoint.
- **Bootstrap JS** (`bootstrap.bundle.min.js`) is loaded for the navbar toggler
  and toasts; no interactive Bootstrap components beyond those are used.

## Status

- [ ] Complete
- [x] Needs review (blocked by missing `id` in backend company responses)
