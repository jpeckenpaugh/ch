# Brief: Manage Company Logos

## Purpose

Give a company a designated logo, uploaded through the application's existing
file storage, and display it where a company is shown. A missing logo is
normal; logo display is purely additive and does not affect the company
completeness rule.

## Expected Behavior

1. A user can set a company's logo by uploading an image from the UI; the upload
   is handled through the application's existing file-storage capability.
2. A user can replace an existing logo by uploading a new one.
3. A user can remove a company's logo, leaving the company without one.
4. When a logo is set, it is displayed on the company detail (profile) page and
   in the companies list.
5. When a logo is set, it is included in generated summary documents for that
   company (see v0.1 brief "Generate Documents and Artifacts from Profiles").
6. When a logo is not set, nothing is displayed in its place; the company views
   and generated documents simply omit it.
7. A missing logo has no effect on the company's completeness status.

## Inputs / Outputs

- **Inputs:** An uploaded logo image for a company; a request to replace or
  remove the logo.
- **Outputs:** A stored logo object associated with the company, displayed on
  the company list and profile and included in generated summary documents when
  set.

## User-Visible Behavior

- The user can upload, replace, and remove a company logo from the UI.
- The logo appears on the company detail page and in the companies list when
  set.
- Generated summary documents for the company include the logo when one is set.
- Companies without a logo simply show no logo; nothing is rendered as a
  placeholder, and completeness is unaffected.

## Constraints

- The logo is handled through the application's existing file-storage
  capability (per v0.1 brief "Manage Company Files and Artifacts"); it is a
  stored object, not structured company data.
- Logo presence is purely additive: it does not change the company completeness
  rule.
- Logo scraping is out of scope; an automated workflow may set a logo later, and
  the display path must already handle it.
- Missing logos are normal; views and generated documents must not fail or
  misbehave when no logo is set.

## Basic Acceptance Expectations

- A user can upload a logo for a company, and it appears on the company list and
  detail page.
- A user can replace and remove a logo.
- A set logo is included in a generated summary document for the company.
- A company without a logo shows none, and its completeness status is
  unchanged.

## Assumptions (resolved clarifications)

- Logo display placement (list/detail/documents) is per scope item p; exact
  presentation is implementation-level and deferred to the architecture stage.