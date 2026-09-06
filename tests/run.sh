#!/usr/bin/env bash
# Orchestrates both persistent test suites.
#   Backend: pytest against throwaway temp DBs (no live server).
#   Browser: throwaway DB + uvicorn + headless Chrome on :9222 + node --test.
# All logs live under ./tmp/ (gitignored). The real data/ is never touched.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PY=".venv/bin/python"
PORT="${PORT:-8000}"
CDP_PORT="${CDP_PORT:-9222}"
BROWSER_PASSWORD="browser-test-admin-password"

echo "== Backend suite (pytest) =="
"$PY" -m pytest tests/backend -q

echo
echo "== Browser suite (node --test + headless Chrome) =="

mkdir -p tmp
export COMPANY_HUB_DB="$ROOT/tmp/browser-test.db"
export COMPANY_HUB_ADMIN_PASSWORD="$BROWSER_PASSWORD"
rm -f "$COMPANY_HUB_DB"
rm -rf "$ROOT/tmp/artifacts" "$ROOT/tmp/browser-chrome-profile"

"$PY" -m uvicorn backend.app:app --host 127.0.0.1 --port "$PORT" \
  --log-level warning >"$ROOT/tmp/browser-server.log" 2>&1 &
SERVER_PID=$!

CHROME=""
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome chromium; do
  if [ -x "$c" ] || command -v "$c" >/dev/null 2>&1; then
    CHROME="$c"
    break
  fi
done
if [ -z "$CHROME" ]; then
  echo "ERROR: Chrome not found (looked for macOS Chrome, google-chrome, chromium)." >&2
  echo "  Install Chrome, or set CHROME_BIN to its path." >&2
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

"$CHROME" --headless=new --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$ROOT/tmp/browser-chrome-profile" \
  --no-first-run --no-default-browser-check about:blank \
  >"$ROOT/tmp/browser-chrome.log" 2>&1 &
CHROME_PID=$!

cleanup() {
  kill "$CHROME_PID" 2>/dev/null || true
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$CHROME_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "waiting for uvicorn on :$PORT ..."
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then break; fi
  sleep 0.5
done
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "ERROR: uvicorn did not come up; see tmp/browser-server.log" >&2
  exit 1
fi

echo "waiting for Chrome CDP on :$CDP_PORT ..."
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:$CDP_PORT/json"; then break; fi
  sleep 0.5
done
if ! curl -s -o /dev/null "http://127.0.0.1:$CDP_PORT/json"; then
  echo "ERROR: Chrome CDP did not come up; see tmp/browser-chrome.log" >&2
  exit 1
fi

# Sequential file execution: the two files drive the same Chrome page target.
COMPANY_HUB_URL="http://127.0.0.1:$PORT" \
COMPANY_HUB_ADMIN_PASSWORD="$BROWSER_PASSWORD" \
  node --test --test-concurrency=1 "tests/browser/*.test.mjs"