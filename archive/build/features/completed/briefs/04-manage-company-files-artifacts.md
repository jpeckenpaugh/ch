# Brief: Manage Company Files and Artifacts

## Purpose

Handle files and generated artifacts associated with a company through a simple
object-storage capability, supporting documents and generated outputs without
treating the files themselves as database content.

## Expected Behavior

1. A user can associate a file or generated artifact with a specific company.
2. Stored files and artifacts are handled as stored objects associated with the
   company, not as rows of structured company data.
3. A user can view the files and artifacts associated with a company from that
   company's profile.
4. A user can open or download a stored file or artifact.
5. A user can remove a file or artifact from a company when it is no longer
   wanted.
6. Each stored item is associated with the company it belongs to, so items are
   shown in the right company's profile and never appear under another company.
7. Generated documents produced by the app (see brief "Generate Documents and
   Artifacts from Profiles") are stored and exposed through this same
   capability: once generated, a document becomes a stored artifact associated
   with the company and is accessible from the company profile like any other
   stored item.

## Inputs / Outputs

- **Inputs:** A file or artifact (e.g., an uploaded document) to associate with
  a company; the target company.
- **Outputs:** The stored object associated with the company, listable, openable,
  downloadable, and removable from the company's profile.

## User-Visible Behavior

- The user can attach a file/artifact to a company.
- The company profile lists the files/artifacts associated with that company.
- The user can open or download each stored item.
- The user can delete a stored item from the company.
- Generated documents appear among the company's stored items after generation.

## Constraints

- Files and artifacts must be treated as stored objects, distinct from the
  company's structured information; they are not stored as database content.
- Every stored item must belong to exactly one company.
- Stored items are only visible/accessible from the company they belong to.
- Behavior must not assume any particular storage technology or file format.

## Basic Acceptance Expectations

- A file/artifact can be added to a company and appears on that company's
  profile.
- A stored item can be opened/downloaded.
- A stored item can be removed and disappears from the profile.
- Items added to one company never appear on another company's profile.
- A generated document (per the generation brief) appears as a stored artifact
  on the company profile.