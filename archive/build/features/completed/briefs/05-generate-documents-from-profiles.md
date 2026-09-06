# Brief: Generate Documents and Artifacts from Profiles

## Purpose

Generate a simple, clean derived document (for example, a summary) based on the
information stored for a company and make that document available from the
company profile.

## Expected Behavior

1. From a company profile, the user can request generation of a derived
   document, such as a summary, based on the company's stored information.
2. The generated document is produced from the company's current structured
   information (and, where relevant, other content associated with the company).
3. The document is simple and clean — a readable, well-presented summary of the
   company, not a comprehensive or exhaustive report.
4. The user is told when generation succeeds or fails (for example, if there is
   not enough information to produce a meaningful document).
5. Once generated, the document becomes an artifact associated with the company
   and is exposed from the company profile for viewing and download.
6. A user can request generation again, producing a fresh document from the
   company's current information (for example, after the information has
   changed).

## Inputs / Outputs

- **Inputs:** A request from the user on the company profile to generate a
  document; the company's current stored information.
- **Outputs:** A generated document artifact associated with the company,
  viewable and downloadable from the company profile.

## User-Visible Behavior

- The user sees an option on the company profile to generate a document/summary.
- The user receives feedback on whether generation succeeded.
- After success, the document is available from the company profile (in line
  with the file/artifact storage capability) for viewing and download.
- Generating again after information changes produces a document reflecting the
  updated information.

## Constraints

- The document is a derived output; it is not stored as structured company data.
- Generated documents are associated with and exposed from the company profile
  via the same object-storage capability used for files and artifacts (see
  brief "Manage Company Files and Artifacts").
- The document should be simple and clean, not an exhaustive report.
- The specific format and contents of the document are not fixed by this brief;
  they are to be defined by the architecture stage. Behavior must not assume a
  particular format.

## Basic Acceptance Expectations

- A user can request a document from a company profile and is told whether it
  succeeded.
- A successful generation produces a simple, clean document summarizing the
  company's information.
- The generated document is viewable and downloadable from the company profile.
- The document reflects the company's information as of generation; regenerating
  after an edit reflects the updated information.