# Stage 2 UI adaptation

Owned files: `index.html`, `css/`, `vendor/bootstrap/`, `vendor/bootstrap-icons/`, `js/{app,api,list,profile,form,industries}.js`, `tests/read-ui.test.mjs` and its evidence JSON.

The original directory, profile, form, and industry views are copied into the isolated static bundle. Bootstrap, icons, fonts and CSS remain local. The router uses owner mode; authentication, users, passwords, logout, logo controls, file operations, and document generation are removed. Profile files show a clear empty state. The facade maps all reads and future writes to the locked semantic operation/payload contract. Company creation and initial locations are one `companies.create {data,locations}` request rather than compensating writes. No existing frontend/backend/OpenCode files were changed.

`window.companyHub` exposes `db` and `render`; `window.appReady` is the initialization and first-view promise. Workspace navigation currently shows diagnostic fields for Stage 2 verification. Stage 4 should replace raw diagnostic keys with user-facing labels for saved state, revision, size/quota, persistent/browser-managed storage and backup controls.

Validation: `node --check poc-browser/tests/read-ui.test.mjs`; `node poc-browser/tests/read-ui.test.mjs` PASS (eight checks). The browser gate verified seed row count, search, country filter, profile/cards, industry controls, create/edit lookup forms, workspace diagnostics, and absence of API resources/runtime errors. Evidence: `poc-browser/tests/stage-2-ui-results.json`. Screenshot for coordinator visual inspection: `/tmp/company-hub-stage-2-profile.png`.

Harness starts only its own static server on 8011 and Chrome/CDP on 9231 with a temporary profile, checks ports before use, and cleans owned children/profile. No FastAPI dependency. Writes intentionally await Stage 3 repository implementation.
