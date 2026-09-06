# Brief: Filter Companies by Country

## Purpose

Let a user filter the companies list by country so they can answer questions
such as which companies have operations in which countries.

## Expected Behavior

1. The companies list offers a country filter control that accepts multiple
   selected countries at once (multi-select).
2. The set of selectable countries comes from the standard country list used by
   company locations.
3. When one or more countries are selected, the list is filtered to companies
   that have at least one location in any of the selected countries (OR
   semantics across the selection).
4. A company with locations in multiple selected countries appears in the
   filtered list once.
5. Companies with no locations are excluded from the results whenever a country
   filter is active.
6. When no country is selected, the filter is inactive and the full companies
   list is shown.
7. The country filter can be combined with the existing list behaviors (e.g.,
   the existing name search and opening a company's profile from the list).

## Inputs / Outputs

- **Inputs:** A selection of zero, one, or multiple countries from the standard
  country list.
- **Outputs:** The companies list filtered to companies with a location in any
  selected country (or the unfiltered list when the filter is empty).

## User-Visible Behavior

- The user sees a multi-select country filter on the companies list.
- Selecting one or more countries narrows the list immediately to matching
  companies.
- Clearing the selection restores the full list.
- The user can see which countries are currently selected and change the
  selection freely.

## Constraints

- Filtering is by location country only; a company's industry or other fields do
  not influence this filter.
- Multi-select matches any (OR semantics) of a company's locations against the
  selected countries.
- Companies with no locations never appear while a country filter is active.
- The standard country list is fixed this sprint; no country-management UI is
  provided (see brief "Manage Company Locations").

## Basic Acceptance Expectations

- Selecting one country shows companies with a location in that country.
- Selecting multiple countries shows companies with a location in any of them
  (union), each company listed once.
- Companies with no locations are hidden while a filter is active.
- Clearing the selection shows the full list again.

## Assumptions (resolved clarifications)

- Multi-select matches if ANY of a company's locations is in a selected country
  (OR semantics); companies with no locations are excluded while a filter is
  active.