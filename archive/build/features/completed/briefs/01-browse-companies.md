# Brief: Browse Companies

## Purpose

Provide a central place to browse the companies the firm works with, so users
can scan the overall set of companies and locate a company of interest.

## Expected Behavior

1. The app presents a single, central list of all companies known to the firm.
2. The list displays each company's structured details in a compact, scannable
   form.
3. The user can scan the list to see the overall set of companies at a glance.
4. The user can locate a specific company of interest from the list.
5. Selecting a company from the list opens that company's profile (see brief
   "View Company Profiles").
6. The list reflects the current set of companies: companies added, edited, or
   removed elsewhere in the app appear or update in the list.

## Inputs / Outputs

- **Inputs:** The collection of companies and their structured information.
- **Outputs:** A browsable list of companies with the ability to select one to
  open its profile.

## User-Visible Behavior

- The user sees a single list of the firm's companies with their structured
  details.
- The user can scan the list and identify a company of interest.
- The user can click/tap a company in the list to go to its profile.

## Constraints

- The list shows structured company information only; it does not display file
  or generated-artifact contents inline.
- The list must stay consistent with the company records maintained by the app.

## Basic Acceptance Expectations

- All companies in the app appear in the list.
- Each listed company shows its structured details.
- Selecting a company opens its profile.
- A newly added or edited company is reflected in the list.