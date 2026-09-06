# Brief: Maintain Company News

## Purpose

Provide a per-company place to store news articles, so the firm can keep a
curated record of relevant news per company. Storage and application interfaces
are provided so automated workflows can also write these records later.

## Expected Behavior

1. Each company profile has a News section.
2. A news record captures a title, source, URL, publication date, a
   summary/snippet, and whether the record came from scraping.
3. A user can add a news article to a company by entering title, source, URL,
   publication date, and a summary/snippet. For records created in the UI, the
   "came from scraping" flag is false.
4. A user can edit an existing news record's editable fields; edits refresh an
   updated timestamp and do not disturb the record's identity.
5. A user can remove a news record from a company.
6. News records are listed on the company's profile; each entry shows its title,
   source, URL (openable), publication date, summary/snippet, and the scraped
   flag.
7. News records belong to exactly one company: they are shown on the company
   they were added to and never under another company.
8. The application exposes interfaces so automated workflows can write news
   records later (including marking them as scraped); this sprint the UI is the
   only required interaction surface.

## Inputs / Outputs

- **Inputs:** News details (title, source, URL, publication date,
  summary/snippet) entered by the user; an edit or removal request.
- **Outputs:** A maintained set of news records per company, listed on the
  company profile with each record's fields.

## User-Visible Behavior

- The user sees a News section on a company's profile.
- The user can add a news article with title, source, URL, publication date, and
  summary/snippet.
- The user can edit or remove a news article.
- Each listed record shows its title, source, openable link, publication date,
  summary/snippet, and scraped status (UI-created records are not scraped).

## Constraints

- Every news record belongs to exactly one company and is only visible on that
  company's profile.
- UI-created records always have the scraped flag false; only automated
  workflows set it true.
- Scraping is out of scope; automated workflows write records through the
  provided interfaces rather than through scraping.
- Adding/editing/removing news must not regress existing v0.1 profile behavior.

## Basic Acceptance Expectations

- A user can add a news record to a company and it appears on that company's
  profile with all its fields; the scraped flag is false.
- A user can edit a news record and the change is reflected.
- A user can remove a news record and it disappears from the profile.
- News added to one company never appears on another company's profile.

## Assumptions (resolved clarifications)

- The scraped flag is false/unset for UI-created records; true only for records
  written by automated workflows.