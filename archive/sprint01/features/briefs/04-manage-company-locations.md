# Brief: Manage Company Locations

## Purpose

Give each company zero or more structured locations (replacing the single
free-form headquarters field) so the firm can record where a company operates,
with consistent country values and a limited, standard set of location types.

## Expected Behavior

1. A company can have zero, one, or more locations.
2. Each location records a label, city, country, and type, with an optional
   address/region.
3. The country of a location is chosen from a fixed, standard country list so
   countries are recorded consistently across companies.
4. The location type is one of exactly: Headquarters, Office, Plant, or Other.
5. A company may have at most one Headquarters location; attempting to set a
   second Headquarters is rejected with a validation error and the existing
   Headquarters is left unchanged.
6. Locations are maintained from the company add/edit flow and/or the company
   profile: a user can add, edit, and remove locations for a company.
7. Removing a company's Headquarters location is allowed (a company may end up
   with zero locations).
8. The single free-form headquarters field on a company is replaced by the
   location records; the company add/edit form no longer offers a free-form
   headquarters text input.
9. The company profile and list surface location information (for example, the
   Headquarters city/country) derived from the location records.

## Inputs / Outputs

- **Inputs:** Location details (label, city, optional address/region, country,
  type) entered by the user for a company.
- **Outputs:** The set of locations associated with a company, maintained and
  displayed; the free-form headquarters field is removed.

## User-Visible Behavior

- The user can add, edit, and remove locations on a company.
- Each location is entered with label, city, country (from a standard list), and
  type (Headquarters/Office/Plant/Other), plus an optional address/region.
- The company add/edit form no longer shows a free-form headquarters field.
- Company list/profile views show location-derived information in place of the
  old headquarters text.
- If the user tries to mark a second location as Headquarters, the application
  shows a validation error and keeps the existing Headquarters.

## Constraints

- Country is recorded from a fixed standard country list; there is no runtime
  country-management UI this sprint (unlike industries).
- Location type is limited to Headquarters, Office, Plant, or Other.
- A company may have at most one Headquarters; a second is rejected with a
  validation error (no auto-demotion of the existing Headquarters).
- The free-form headquarters field is intentionally replaced (per scope item s);
  this is an in-scope change, not a regression.
- The country standardization is intrinsic to locations (per feature 04).

## Basic Acceptance Expectations

- A company with no locations can gain several locations.
- Each location stores label, city, country (from the standard list), and type,
  with address/region optional.
- Attempting to add a second Headquarters is rejected and the existing
  Headquarters remains.
- Locations can be edited and removed; the views reflect the current location
  set.
- No free-form headquarters input remains anywhere in the UI.

## Assumptions (resolved clarifications)

- A fixed standard country list is used; there is NO runtime management UI for
  countries this sprint (unlike industries).
- HQ uniqueness is enforced by rejecting the second Headquarters with a
  validation error; the existing HQ is not auto-demoted.
- Required fields per location: label, city, country, and type; address/region
  is optional.