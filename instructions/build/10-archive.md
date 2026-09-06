# Stage 10 — Archive

## Role / Purpose

Relocate a completed build's artifacts into `archive/<phase>/` so the live
working folders reflect only the current state. Archiving is relocation, not
deletion: the files remain in the repository under `archive/` as durable
reference, and their contents are not altered. This stage runs after a build
completes and can also be invoked on-demand to archive an earlier build (e.g.
the v0.1 build baseline) so a subsequent enhancement sprint can start from a
clean baseline.

## Inputs

- Run-specific target: the phase to archive (e.g. `build`). Supplied by the
  Stage Manager for this run; defaults to `build`.
- The artifacts produced by that build:
  - `features/` and `features/briefs/` (Stages 2 and 3).
  - The per-stage summaries under `summaries/`.

## Outputs

- `archive/<phase>/` populated with that phase's files, preserving their
  internal structure.
- The source files removed from their working locations, using `git mv`.

## Instructions

1. Determine the phase from the run target (default `build`).
2. Write your summary file (`summaries/10-archive.md`, see below) **before**
   relocating `summaries/`, so it is preserved in the archive.
3. Ensure the archive root exists (e.g. `mkdir -p archive/build/features`).
4. `git mv features archive/<phase>/features/completed` (includes the
   `features/completed/briefs/` folder).
5. `git mv summaries archive/<phase>/summaries/`.
6. Preserve each file's internal folder structure under its archive root.
7. Keep in place (do not archive): `docs/`, `backend/`, `frontend/`,
   environment scripts (`install.sh`, `run.sh`, `requirements.txt`,
   `environment-notes.md`, `.gitignore`), `README.md`, `concept.md`, and
   `tmp/`.
8. Do NOT edit, delete, or regress any file content; move files only.
9. Commit your changes as the final step (see below).

## What NOT to do

- Do NOT delete files; use `git mv` so history and content are preserved.
- Do NOT edit or reformat the content of archived files.
- Do NOT archive persistent/cumulative artifacts (`docs/`, `backend/`,
  `frontend/`, environment scripts, `README.md`, `concept.md`).
- Do NOT perform any other stage's work.

## Summary

Write `summaries/10-archive.md` using `summaries/00-template.md`. Record the
phase archived, the archive roots created, and any open concerns.

As the final step, commit your changes to the current branch and push to
`origin`, using a message in the form `stage 10: archive <phase> artifacts`.