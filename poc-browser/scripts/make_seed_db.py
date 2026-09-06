#!/usr/bin/env python3
"""Build the browser seed using canonical migrations and seeding, in isolation.

Run from any directory with the repository .venv Python. Runtime needs no Python.
The fixed timestamp makes identical source/dependency builds byte reproducible.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SEED_VERSION = "company-hub-seed-v1"
SEED_TIMESTAMP = "2026-09-06T00:00:00Z"
SCHEMA_REVISION = "0003_sprint03_roles"


def validate(conn):
    tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    required = {"companies", "industries", "countries", "locations", "references", "news_articles", "artifacts", "users", "oauth_accounts", "access_tokens", "alembic_version"}
    if not required.issubset(tables):
        raise RuntimeError(f"Missing canonical tables: {required - set(tables)}")
    counts = {table: conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in sorted(required - {"alembic_version"})}
    for table, expected in {"companies": 6, "countries": 83, "industries": 6, "artifacts": 0, "users": 0, "oauth_accounts": 0, "access_tokens": 0}.items():
        if counts[table] != expected:
            raise RuntimeError(f"{table}: expected {expected}, got {counts[table]}")
    revision = conn.execute("SELECT version_num FROM alembic_version").fetchall()
    if revision != [(SCHEMA_REVISION,)]:
        raise RuntimeError(f"Unexpected schema revision: {revision}")
    for cid, name in conn.execute("SELECT id,name FROM companies"):
        for table, minimum in (("references", 2), ("news_articles", 3), ("locations", 2)):
            count = conn.execute(f'SELECT count(*) FROM "{table}" WHERE company_id=?', (cid,)).fetchone()[0]
            if count < minimum:
                raise RuntimeError(f"{name}: insufficient {table}: {count}")
        if conn.execute("SELECT count(*) FROM locations WHERE company_id=? AND type='Headquarters'", (cid,)).fetchone()[0] != 1:
            raise RuntimeError(f"{name}: expected one headquarters")
    if conn.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
        raise RuntimeError("Seed integrity check failed")
    if conn.execute("PRAGMA foreign_key_check").fetchall():
        raise RuntimeError("Seed foreign key check failed")
    return counts, tables


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "poc-browser/data/seed.db")
    args = parser.parse_args()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="company-hub-browser-seed-") as directory:
        temporary_db = Path(directory) / "seed.db"
        # Configure BEFORE any backend imports; artifacts are isolated alongside DB.
        os.environ["COMPANY_HUB_DB"] = str(temporary_db)
        sys.path.insert(0, str(ROOT))
        from backend.db.engine import run_migrations, get_sessionmaker, get_engine
        from backend.db.seed import seed_if_empty
        run_migrations()

        async def seed():
            try:
                async with get_sessionmaker()() as session:
                    await seed_if_empty(session)
            finally:
                await get_engine().dispose()
        asyncio.run(seed())
        with sqlite3.connect(temporary_db) as conn:
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("DELETE FROM artifacts")
            # Normalize generated timestamps only; preserve published dates/content.
            for table in ("industries", "countries", "companies", "references", "news_articles"):
                conn.execute(f'UPDATE "{table}" SET created_at=?', (SEED_TIMESTAMP,))
            for table in ("companies", "references", "news_articles"):
                conn.execute(f'UPDATE "{table}" SET updated_at=?', (SEED_TIMESTAMP,))
            conn.commit()
            conn.execute("VACUUM")  # Remove deleted logo metadata from free pages.
            counts, tables = validate(conn)
        shutil.copyfile(temporary_db, output)
    manifest = {
        "seedVersion": SEED_VERSION,
        "schemaRevision": SCHEMA_REVISION,
        "seedTimestamp": SEED_TIMESTAMP,
        "bytes": output.stat().st_size,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "counts": counts,
        "tables": tables,
    }
    output.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
