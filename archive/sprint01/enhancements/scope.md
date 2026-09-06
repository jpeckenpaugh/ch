# Sprint 01 — Agreed Scope

Drawn from `enhancements/sprint01.md`, the single authoritative source for this
pass. This pass extends the v0.1 company-hub build with authentication,
data-model normalization (industries, locations, countries), references and
news articles, and company logos. The application is an internal web app; the
additions support core firm workflows without turning it into a full CRM.

Every item from the sprint concept is listed below by its letter, tagged
**Feature** / **Constraint** / **Boundary**. Nothing is dropped.

## Authentication

- **a. Feature** — Add email/password login so users must sign in; the whole
  application (all routes) requires an authenticated session.
- **b. Constraint** — The system boots an initial local user
  (`admin@localhost`) with a complex auto-generated password printed to the
  console on dev-server startup, so the app is usable immediately with no
  signup flow.
- **c. Boundary** — No self-service signup, roles/permissions, password reset,
  or multi-user administration this sprint. The bootstrap admin is the only
  user.

## Industries

- **d. Feature** — A company's industry becomes a controlled value chosen from
  a standard list, replacing free-form text.
- **e. Constraint** — A standard industry list is seeded so companies are
  categorized consistently. The seeded list is fixed at six industries by item
  t.
- **f. Feature** — Provide UI to manage the industry list: add new industries
  and rename existing ones.

## Locations

- **g. Feature** — A company can have zero or more locations (label, city,
  optional address/region, country, type), replacing the single free-form
  headquarters field.
- **h. Constraint** — Location type is limited to Headquarters, Office, Plant,
  or Other; a company may have at most one Headquarters.
- **i. Feature** — Each location's country is recorded from a standard country
  list, so countries are consistent across companies.
- **j. Feature** — The companies list can be filtered by country (multi-select)
  to answer questions like "which companies have operations in which
  countries".

## References & News

- **k. Feature** — Provide a per-company place to store curated resource links
  ("References"): title, URL, description, and who added it and when.
- **l. Feature** — Provide a per-company place to store news articles: title,
  source, URL, publication date, a summary/snippet, and whether the record came
  from scraping.
- **m. Feature** — References and news articles can be added, edited, and
  removed from a company profile in the UI.
- **n. Boundary** — Scraping of news or resource pages is out of scope; the
  storage and application interfaces are provided so automated workflows can
  write these records later.

## Logos

- **o. Feature** — A company can have a designated logo, set by uploading it
  from the UI and handled through the application's existing file storage.
- **p. Feature** — A set logo is displayed on the company detail page and the
  companies list, and included in generated summary documents. A missing logo
  does not affect company completeness; logo display is purely additive.
- **q. Boundary** — Logo scraping is out of scope; an automated workflow may
  set a logo later and the display path will already handle it.

## Cross-cutting

- **r. Constraint** — Existing v0.1 behavior outside this sprint's scope must
  not regress.
- **s. Constraint** — The company field changes are intentional: free-form
  industry and headquarters fields are replaced by the new lists and locations,
  and the company add/edit forms are updated accordingly. These are in-scope
  changes, not regressions.

## Seed data

- **t. Feature** — Replace the v0.1 fictitious seed companies with real
  companies — one of the biggest players in each seeded industry. The seeded
  industry → company set is Manufacturing → Toyota Motor (JP), Technology →
  Samsung Electronics (KR), Finance → HSBC (UK), Healthcare → Novartis (CH),
  Energy → Shell (UK), Retail → Carrefour (FR). These six industries are the
  seeded standard list (resolving item e); the management UI (item f) extends
  the list at runtime. Each seeded company carries one Headquarters location
  (label, city, country, type) consistent with the new location model (items
  g/h) — one HQ per company, Shell's HQ being London, UK. The seed is limited
  to these six companies: structured fields and their HQ locations only — no
  seeded references, news, logos, or artifacts.
- **u. Constraint** — The current SQLite database and the files under
  `data/artifacts/` may be deleted/flushed this sprint; the data model is
  rebuilt and reseeded from the real-company set. `data/` is gitignored, so no
  repository history is affected. This is an explicit, sanctioned exception to
  item r, limited to dev runtime state under the gitignored `data/` folder — it
  does not authorize deleting or regressing repo-tracked content.

## Constraints & boundaries on the pass

- The six seeded industries in item t are the complete seeded standard list;
  the management UI (item f) is the only mechanism to extend the list beyond
  them at runtime.
- The bootstrap-admin login flow (item b) is the authentication path for this
  sprint, scoped to the local development server.
- Logo presence is purely additive (item p): it does not change the company
  completeness rule.
- No out-of-scope v0.1 behavior regresses, except the sanctioned dev-data flush
  under item u.