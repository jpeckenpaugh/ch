# Brief: View Company Profiles

## Purpose

Allow a user to open a dedicated profile for an individual company and view the
information associated with it, including its structured details and any related
content, in one place.

## Expected Behavior

1. A user can open a dedicated profile for a single company.
2. The profile presents all of that company's structured information in one
   place.
3. The profile also presents related content associated with that company —
   files, generated artifacts, and generated documents (see briefs "Manage
   Company Files and Artifacts" and "Generate Documents and Artifacts from
   Profiles").
4. From the profile, the user can access related content (for example, open or
   download a document associated with the company).
5. The profile reflects the current state of the company's structured
   information and related content: changes made elsewhere in the app appear
   when the profile is viewed.
6. The user can return from a profile to the company list.

## Inputs / Outputs

- **Inputs:** A specific company selection; that company's structured
  information; that company's related files, artifacts, and generated
  documents.
- **Outputs:** A single profile page gathering the company's structured details
  and related content, with access to each related item.

## User-Visible Behavior

- The user sees a dedicated profile for one company.
- The company's structured details and any related content appear together on
  the profile.
- The user can open or download related content (e.g., a generated document)
  from the profile.

## Constraints

- The profile gathers information and content associated with one company only;
  it does not mix in another company's records or content.
- Structured information and file/artifact content are presented as distinct
  things (structured vs. stored), consistent with the app's separation of the
  two.
- The profile must not allow editing or deleting; those capabilities are covered
  by other briefs.

## Basic Acceptance Expectations

- A user can open a profile for any company in the list.
- The profile shows all of that company's structured information.
- Related files/artifacts and generated documents associated with the company
  are visible and accessible from the profile.
- Opening one company's profile never shows another company's content.