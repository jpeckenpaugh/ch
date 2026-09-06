# Summary: System Engineer (Stage 4)

- **Date:** 2026-09-01
- **Author / Executor:** System Engineer role (agent)
- **Instruction file:** `instructions/build/04-system-engineering.md`
- **Commit:** `stage 04: define reproducible Python environment`

## Work Completed

Defined a reproducible development/runtime environment for the approved stack
(Web App / Bootstrap frontend / FastAPI + SQLite backend). Provisioning is a
project-local Python 3.11+ virtual environment with exact-pinned dependencies,
installed from scratch by `install.sh` and started by `run.sh`. The environment
assumes an existing 3.11+ interpreter (target 3.12) and does not bootstrap one.
SQLite is used via the Python standard library (no external server); object
storage is assumed to be local filesystem with no external service. No product
behavior, data model, or application code was defined — those remain with the
Architect (Stage 5) and Backend (Stage 6).

## Outputs Produced

- `requirements.txt` — exact-pinned dependency manifest.
- `install.sh` — provisions `.venv/` and installs dependencies from scratch.
- `run.sh` — starts the app via the provisioned venv.
- `.gitignore` — excludes `.venv/`, caches, local data, OS artifacts; keeps
  `tmp/.gitkeep` (per pipeline conventions).
- `environment-notes.md` — runtime assumptions, dependency roles, storage
  assumptions, and caveats.

## Key Decisions

- **Python 3.12 target (3.11+):** System Python 3.9 is EOL; Homebrew
  `python3.12` is available. `install.sh` prefers `python3.12`, falls back to
  `python3.11`, and errors otherwise (no runtime bootstrap), per human guidance.
- **PDF library — `fpdf2==2.8.8`:** Chosen over reportlab for its lightweight,
  pure-Python nature and lack of system-level dependencies. Its only role is
  producing the simple, clean derived document (Brief 05); exact format/contents
  remain an architecture decision.
- **`python-multipart==0.0.32`:** Included because FastAPI requires it for the
  multipart file uploads in Brief 04.
- **Entry-point contract:** `run.sh` starts `uvicorn backend.app:app
  --host 127.0.0.1 --port 8000`. This contract is relayed to Stages 5 and 6;
  `run.sh` will fail at import until the backend module exists.
- **Local storage reserved at `data/`:** The SQLite DB and local object-storage
  files are expected under `data/` (or as the Architect decides); `data/` is
  gitignored so runtime writes are never committed.

## Open Questions & Concerns

- **Entry-point timing:** `run.sh` depends on `backend.app:app` existing. The
  Architect (Stage 5) must preserve this contract in the backend layout so the
  script works once Stage 6 lands.
- **Local storage layout:** `data/` is reserved/ignored, but the exact object
  storage directory structure is an architecture decision; if the Architect
  chooses a different location it must be added to `.gitignore`.
- **Seed data:** Per human resolution, seeding/schema setup is deferred to
  Stages 5/6; the environment scripts do not seed anything.
- **Frontend serving:** The Bootstrap frontend is assumed to be served by the
  FastAPI app (static files); no separate web-server dependency is provisioned.

## Status

- [x] Complete
- [ ] Needs review
