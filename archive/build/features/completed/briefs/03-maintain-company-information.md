# Brief: Maintain Company Information

## Purpose

Allow users to add and edit structured information about companies, keeping the
firm's company records current and complete.

## Expected Behavior

1. A user can add a new company to the app with its structured information.
2. A user can edit the structured information of an existing company.
3. The user can review the entered/changed information before saving it.
4. Saving a new or edited company makes the change effective: the company
   appears or updates in the company list and its profile reflects the new
   information.
5. The user can cancel an add or edit without saving, leaving records unchanged.
6. The app indicates which companies lack complete information so users can
   recognize where records are incomplete and can be filled in.

## Inputs / Outputs

- **Inputs:** Structured company information entered by the user for a new or
  existing company.
- **Outputs:** An updated, current set of company records available to the list,
  profile, and any feature that reads company information.

## User-Visible Behavior

- The user can initiate adding a company and entering its structured details.
- The user can edit an existing company's structured details.
- The user sees a form/interface for entry and editing with the ability to save
  or cancel.
- After saving, the change is reflected in the company list and on the company
  profile.
- The user can see when a company's information is incomplete.

## Constraints

- This brief covers structured company information only; file/artifact content
  is handled by brief "Manage Company Files and Artifacts".
- The specific fields of structured company information are not fixed by this
  brief; they are to be defined by the architecture stage. Behavior must not
  assume a particular field set.
- A company's structured information should be kept current and complete; the
  app should not silently discard or overwrite user-entered information.

## Basic Acceptance Expectations

- A user can add a company, and it appears in the list and on its profile.
- A user can edit a company, and the change is reflected in the list and profile.
- A user can cancel an add/edit without any change taking effect.
- Incomplete records are identifiable as such.