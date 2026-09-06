#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x .venv/bin/uvicorn ]; then
  echo "error: virtual environment missing or incomplete; run ./install.sh first." >&2
  exit 1
fi

exec .venv/bin/uvicorn backend.app:app --host 127.0.0.1 --port 8000
