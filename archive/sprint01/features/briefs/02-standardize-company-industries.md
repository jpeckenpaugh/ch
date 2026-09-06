# Brief: Standardize Company Industries

## Purpose

Replace the free-form industry text on a company with a controlled industry
value chosen from a standard, seeded list, so companies are categorized
consistently and can be compared meaningfully.

## Expected Behavior

1. When a user adds or edits a company, the industry is chosen from a standard
   list of industries rather than typed as free-form text.
2. The standard list is seeded with exactly six industries: Manufacturing,
   Technology, Finance, Healthcare, Energy, Retail.
3. An existing company's free-form industry value is no longer valid; the
   company's industry is stored as one of the controlled values from the
   standard list.
4. Every company record carries an industry selected from the list (when the
   user supplies one); the company add/edit form reflects this controlled
   selection.
5. The industry shown in the company list and profile comes from the controlled
   value on the company, consistent with the value stored.
6. The controlled list is extensible at runtime only through the industry
   management capability (see brief "Manage the Industry List"); no other path
   introduces new industry values.

## Inputs / Outputs

- **Inputs:** A selection of one industry from the standard list while adding or
  editing a company.
- **Outputs:** A company whose industry is a controlled value from the standard
  list, displayed in the company list and profile.

## User-Visible Behavior

- The company add/edit form presents a dropdown/picker of standard industries
  instead of a free-text industry box.
- The company list and profile show the controlled industry value.
- Users can no longer enter arbitrary industry text on a company.

## Constraints

- The seeded standard list is fixed at six industries; runtime extension happens
  only via the industry management UI (brief "Manage the Industry List").
- Existing v0.1 free-form industry text is intentionally replaced (per scope
  item s); this is an in-scope change, not a regression.
- No other application behavior is changed by this brief.

## Basic Acceptance Expectations

- Adding/editing a company offers the six seeded industries as choices.
- A company's industry is stored and displayed as a controlled value from the
  list.
- Free-form industry entry is no longer possible.

## Assumptions (resolved clarifications)

- Industries are controlled references: renaming an industry in the management
  UI automatically updates every company using it (see brief "Manage the
  Industry List").