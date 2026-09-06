# Summary: Feature Decomposition (Stage 2)

- **Date:** 2026-09-01
- **Author / Executor:** Feature Decomposition role (agent)
- **Instruction file:** `instructions/build/02-decompose-features.md`
- **Commit:** `stage 02: decompose concept into product features`

## Work Completed

Read the approved `concept.md` and broke the product into five discrete,
app-specific capabilities. The decomposition covers every requirement in the
concept: a central place to browse companies, viewing a company profile, adding
and editing information, the separation between structured (relational) company
data and file/artifact object storage, and generating a derived document (e.g.,
a summary) from a company profile that is exposed from the profile. Output
stays strictly at the capability level — no behavior, workflows, filenames,
code, or design detail.

## Outputs Produced

- `features/01-browse-companies.md` — Browse Companies
- `features/02-view-company-profiles.md` — View Company Profiles
- `features/03-maintain-company-information.md` — Maintain Company Information
- `features/04-manage-company-files-artifacts.md` — Manage Company Files and Artifacts
- `features/05-generate-documents-from-profiles.md` — Generate Documents and Artifacts from Profiles

## Key Decisions

- Structured company data (browse/maintain) and file/artifact storage (object
  storage) are expressed as two separate capabilities, reflecting the concept's
  explicit separation of relational data from files/generated outputs.
- The derived-document capability is captured generically ("generate a simple,
  clean derived document … e.g., a summary") rather than as a specific format,
  per the human's direction to avoid implementation detail.
- Automated external workflows (n8n/Slack/news/financial updates/AI analysis)
  are treated as future-scope only and were NOT decomposed into current
  features, per the human's resolution.

## Open Questions & Concerns

- Seed data: the concept calls for "a small set of realistic companies as seed
  data" but names no specific companies. Deferred to downstream stages (system
  engineering / architecture); not enumerated here.
- The generated-documents capability and the file/artifact storage capability
  are related but intentionally kept separate (generation vs. storage).
  Downstream briefs should clarify how a generated document is associated with
  and exposed from a company profile.

## Status

- [x] Complete
- [ ] Needs review
