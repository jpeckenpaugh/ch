#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PY=""
for candidate in python3.12 python3.11; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done

if [ -z "$PY" ]; then
  echo "error: a Python 3.11+ interpreter (python3.12 or python3.11) is required." >&2
  echo "Install it first; this script does not bootstrap a Python runtime." >&2
  exit 1
fi

"$PY" -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

echo "Environment ready. Start the app with ./run.sh"
