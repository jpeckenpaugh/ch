# Brief: Maintain Company References

## Purpose

Provide a per-company place to store curated resource links ("References"), so
the firm can keep useful external links associated with each company. Storage
and application interfaces are provided so automated workflows can also write
these records later.

## Expected Behavior

1. Each company profile has a References section.
2. A reference records a title, a URL, a description, and who added it and when.
3. A user can add a reference to a company: enter a title, URL, and description.
   The record also captures the signed-in user who added it and the timestamp.
4. A user can edit an existing reference's title, URL, and/or description; the
   adder and the original created-at timestamp are preserved, and an updated
   timestamp reflects the edit.
5. A user can remove a reference from a company.
6. References are listed on the company's profile; each entry shows its title,
   description, URL (openable as a link), the adder, and the timestamp.
7. References belong to exactly one company: they are shown on the company they
   were added to and never under another company.
8. The application exposes interfaces so automated workflows can create (and
   update) reference records later; this sprint the UI is the only required
   interaction surface.

## Inputs / Outputs

- **Inputs:** Reference details (title, URL, description) entered by the user,
  plus the signed-in user identity; an edit or removal request.
- **Outputs:** A maintained set of reference records per company, listed on the
  company profile with provenance (adder and timestamps).

## User-Visible Behavior

- The user sees a References section on a company's profile.
- The user can add a reference with title, URL, and description.
- The user can edit or remove a reference.
- Each listed reference shows its title, description, an openable link, who
  added it, and when.

## Constraints

- Every reference belongs to exactly one company and is only visible on that
  company's profile.
- The adder and created-at timestamp are immutable once set; edits update only
  the editable fields and the updated-at timestamp.
- Scraping of resource pages is out of scope; automated workflows write records
  through the provided interfaces rather than through scraping.
- Adding/editing/removing references must not regress existing v0.1 profile
  behavior.

## Basic Acceptance Expectations

- A user can add a reference to a company and it appears on that company's
  profile with title, description, openable URL, adder, and timestamp.
- A user can edit a reference; the edit is reflected and the original adder and
  created-at timestamp are unchanged.
- A user can remove a reference and it disappears from the profile.
- References added to one company never appear on another company's profile.

## Assumptions (resolved clarifications)

- `added_by` is the signed-in user; `created_at` is immutable. Edits refresh
  only an `updated_at` timestamp.