# Brief: Seed Real Company Data

## Purpose

Replace the v0.1 fictitious seed companies with six real, recognizable
companies — one of the biggest players in each seeded industry — so the seeded
data reflects real businesses and exercises the new industry and location
models. The seed also establishes the six-industry standard list and the
country-standardized Headquarters records.

## Expected Behavior

1. On a fresh/empty database, the application seeds exactly six companies:
   Manufacturing → Toyota Motor (JP), Technology → Samsung Electronics (KR),
   Finance → HSBC (UK), Healthcare → Novartis (CH), Energy → Shell (UK),
   Retail → Carrefour (FR).
2. Each seeded company carries its name, its industry from the seeded standard
   list, all of the v0.1 structured company fields (website, contact_email,
   contact_phone, description), and exactly one Headquarters location with a
   label, city, country (from the standard country list), and type
   (Headquarters).
3. Shell's Headquarters location is London, UK.
4. Each seeded company has exactly one Headquarters location — never more —
   consistent with the location model.
5. The seed writes structured fields and Headquarters locations only: no
   references, news, logos, or artifacts are seeded.
6. Seeding happens only when the data is empty; it does not overwrite
   user-entered data.
7. The seed replaces any previous fictitious seed data; the v0.1 SQLite database
   and the files under `data/artifacts/` may be flushed as part of this sprint
   (a sanctioned, gitignored dev-data reset).

## Inputs / Outputs

- **Inputs:** An empty data store on first startup.
- **Outputs:** Six real companies with their structured fields and one
  Headquarters location each, plus the seeded six-industry standard list.

## User-Visible Behavior

- On first run, the companies list shows the six real companies instead of the
  previous fictitious ones.
- Each seeded company's profile shows its real-world structured details and a
  single Headquarters location.
- The industry choices on the add/edit form start as the six seeded industries.

## Constraints

- The seed is limited to the six named companies and their structured fields and
  Headquarters locations; nothing else is seeded.
- The six seeded industries are the complete seeded standard list; the
  management UI (brief "Manage the Industry List") is the only mechanism to
  extend the list at runtime.
- Seeding occurs only when the data store is empty; it never overwrites
  user-entered data.
- The data-model rebuild may flush the gitignored `data/` folder (SQLite DB and
  artifacts) but must not delete or regress repo-tracked content.

## Basic Acceptance Expectations

- A fresh start seeds the six companies with correct names, industries, and one
  Headquarters location each (Shell's HQ in London, UK).
- The six seeded industries are the starting industry list.
- No references, news, logos, or artifacts are seeded.
- Existing user-entered data is never overwritten by the seed.

## Assumptions (resolved clarifications)

- The six real companies seed all v0.1 structured fields (website,
  contact_email, contact_phone, description) plus name, industry, and one
  Headquarters location. This goes slightly beyond a minimal seed and is flagged
  in the Stage 3 summary for the human to review.