#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Flushing dev runtime state (data/company_hub.db and data/artifacts)..."
rm -f data/company_hub.db
rm -rf data/artifacts

echo "Done. The next ./run.sh will reseed the database from scratch."