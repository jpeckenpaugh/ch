# Sprint 01 — Concept

## Scope

This pass extends the v0.1 company-hub build with authentication, data-model
normalization (industries, locations, countries), references and news articles,
and company logos. The application is an internal web app; these additions
support the firm's core workflows without turning it into a full CRM.

This document is the single authoritative source for the pass. Items are
lettered and tagged **Feature** / **Constraint** / **Boundary**; nothing here is
dropped by downstream stages. It stays at the product level — no API routes,
schemas, or implementation choices.

## Authentication

- **a. Feature** — Add email/password login to the application. All application
  routes are protected and require an authenticated session.
- **b. Constraint** — For local development, the system bootstraps an initial
  user `admin@localhost` with a complex auto-generated password, displayed to
  the console when the dev server starts, so the app is usable immediately
  without a signup flow.
- **c. Boundary** — No self-service signup, roles/permissions, password reset,
  or multi-user administration in this sprint. The bootstrap admin is the only
  user.

## Industries

- **d. Feature** — Store a company's industry as a controlled value from a
  standard list, rather than free-form text.
- **e. Constraint** — Seed the standard industry list (e.g. Manufacturing,
  Technology, Finance, Healthcare, …) so companies are consistently categorized.
- **f. Feature** — Provide UI to manage the industry list: add new industries and
  rename existing ones.

## Locations

- **g. Feature** — Support multiple locations per company. A company has zero or
  more locations, each recording a label, city, optional address/region,
  country, and a type. This replaces the single free-form headquarters field.
- **h. Constraint** — Location type is one of: Headquarters, Office, Plant, or
  Other. A company may have at most one Headquarters location.
- **i. Feature** — Record each location's country using a standard country list,
  so countries are consistent across companies.
- **j. Feature** — Filter the companies list by country (multi-select) to answer
  questions like "which companies have operations in which countries".

## References & News

- **k. Feature** — Provide a place to store curated resource links per company
  ("References"): a title, URL, description, and who added it and when.
- **l. Feature** — Provide a place to store news articles per company: title,
  source, URL, publication date, a summary/snippet, and whether the record came
  from scraping.
- **m. Feature** — Allow adding, editing, and removing references and news
  articles from a company profile in the UI.
- **n. Boundary** — Scraping of news articles or resource pages is out of scope
  this sprint; the storage and application interfaces are provided so automated
  workflows can write these records later.

## Logos

- **o. Feature** — Store a designated logo per company, set by uploading it from
  the UI and handled through the application's existing file storage.
- **p. Feature** — Display the company logo on the company detail page and the
  companies list, and include it in generated summary documents when one is set.
  A missing logo does not affect the company completeness rule; logo display is
  purely additive to views and generated documents.
- **q. Boundary** — Logo scraping is out of scope this sprint; an automated
  workflow may set a logo later, and the display path will already handle it.

## Cross-cutting

- **r. Constraint** — Existing v0.1 behavior outside this sprint's scope must
  not regress.
- **s. Constraint** — The company field changes are intentional: the free-form
  industry and headquarters fields are replaced by the new lists and locations,
  and the company add/edit forms are updated accordingly. These are in-scope
  changes, not regressions.

## Seed data

- **t. Feature** — Replace the v0.1 fictitious seed companies with real
  companies: one of the biggest players in each seeded industry, so the seed
  data reflects recognizable real businesses. The industry → company set is:
  Manufacturing → Toyota Motor (JP), Technology → Samsung Electronics (KR),
  Finance → HSBC (UK), Healthcare → Novartis (CH), Energy → Shell (UK),
  Retail → Carrefour (FR). These six industries are the seeded standard list
  (resolving item e's open-ended "…"); the management UI (item f) extends the
  list at runtime. Each seeded company carries one Headquarters location (label,
  city, country, type) consistent with the new location model (item g/h) — one
  HQ per company, Shell's HQ being London, UK. The seed is limited to these six
  companies: structured fields and their HQ locations only — no seeded
  references, news, logos, or artifacts.
- **u. Constraint** — The current SQLite database (and the files under
  `data/artifacts/`) may be deleted/flushed during this sprint; the data model
  is rebuilt and reseeded from the real-company set. `data/` is gitignored, so
  no repository history is affected. This is an explicit, sanctioned exception
  to item r, limited to dev runtime state under the gitignored `data/` folder —
  it does not authorize deleting or regressing repo-tracked content.