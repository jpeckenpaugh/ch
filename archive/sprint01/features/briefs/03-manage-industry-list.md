# Brief: Manage the Industry List

## Purpose

Let a user manage the standard industry list at runtime — add new industries and
rename existing ones — so the categorization vocabulary grows with the firm's
needs beyond the six seeded values.

## Expected Behavior

1. The application provides a UI for managing the standard industry list.
2. A user can add a new industry to the list; it becomes available as an
   industry choice on the company add/edit form.
3. A user can rename an existing industry in the list.
4. When an industry is renamed, every company currently using that industry is
   updated to show and store the new name; the controlled value is shared, so
   no company is left with a stale name.
5. The list starts with the six seeded industries (Manufacturing, Technology,
   Finance, Healthcare, Energy, Retail) and grows only through this UI.
6. Renaming does not create a duplicate industry; it changes the label of the
   existing controlled value.

## Inputs / Outputs

- **Inputs:** A new industry name to add, or a new label for an existing
  industry.
- **Outputs:** An updated standard industry list; companies referencing a
  renamed industry now reference the new label.

## User-Visible Behavior

- The user can open an industry-management view, see the current list, add an
  entry, and rename an entry.
- After a rename, the company list and profile show the new industry name for
  companies that used the renamed industry.
- The company add/edit form reflects added industries immediately.

## Constraints

- Only add and rename are provided; there is no delete/remove operation on
  industries this sprint.
- The six seeded industries are always present initially; runtime changes do
  not alter the fact that the seed itself is six industries.
- Renames propagate to companies because industries are controlled references
  (per brief "Standardize Company Industries").

## Basic Acceptance Expectations

- A user can add an industry, and it appears in the list and on the company
  add/edit form.
- A user can rename an industry, and companies using it display the new name in
  the list and profile.
- No delete operation is offered.

## Assumptions (resolved clarifications)

- Renaming an industry automatically updates all companies using it (industries
  are controlled references).