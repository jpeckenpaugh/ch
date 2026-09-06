"""Seed-on-empty contents: industries, countries, companies with locations,
references, news, and logos (inspected directly against the test DB)."""

import sqlite3

from backend.db.seed import SEED_COMPANIES, SEED_INDUSTRIES


def test_seeded_industries(db_path):
    conn = sqlite3.connect(str(db_path))
    rows = [r[0] for r in conn.execute("SELECT name FROM industries ORDER BY name")]
    conn.close()
    assert rows == sorted(SEED_INDUSTRIES)


def test_seeded_countries(db_path):
    conn = sqlite3.connect(str(db_path))
    rows = [dict(zip(("code", "name"), r)) for r in conn.execute("SELECT code, name FROM countries")]
    conn.close()
    assert len(rows) == 83
    assert {"code": "GB", "name": "United Kingdom"} in rows


def test_seeded_companies_each_with_one_headquarters(db_path):
    conn = sqlite3.connect(str(db_path))
    companies = [dict(zip(("id", "name"), r)) for r in conn.execute("SELECT id, name FROM companies")]
    assert len(companies) == 6
    assert {r["name"] for r in companies} == {c["name"] for c in SEED_COMPANIES}

    for row in companies:
        n = conn.execute(
            "SELECT COUNT(*) FROM locations WHERE company_id = ? AND type = 'Headquarters'",
            (row["id"],),
        ).fetchone()[0]
        assert n == 1, f"{row['name']} should have exactly one HQ"
    conn.close()


def test_seed_has_references_news_locations_and_logos(db_path):
    conn = sqlite3.connect(str(db_path))
    for cid, name in conn.execute("SELECT id, name FROM companies"):
        refs = conn.execute(
            'SELECT COUNT(*) FROM "references" WHERE company_id = ?', (cid,)
        ).fetchone()[0]
        assert refs == 2, f"{name} should have exactly two references"

        n_news, n_scraped = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(is_scraped), 0) FROM news_articles WHERE company_id = ?",
            (cid,),
        ).fetchone()
        assert n_news >= 3, f"{name} should have at least three news articles"
        assert n_scraped == 0, f"{name} news should be hand-authored, not scraped"

        logos = conn.execute(
            "SELECT COUNT(*) FROM artifacts WHERE company_id = ? AND source = 'logo'",
            (cid,),
        ).fetchone()[0]
        assert logos == 1, f"{name} should have exactly one logo"

        locs = conn.execute(
            "SELECT COUNT(*) FROM locations WHERE company_id = ?", (cid,)
        ).fetchone()[0]
        assert locs >= 2, f"{name} should have its HQ plus extra locations"
    conn.close()


def test_bootstrap_admin_exists_and_is_admin(db_path):
    conn = sqlite3.connect(str(db_path))
    row = conn.execute(
        "SELECT email, is_active, access_level, is_verified FROM users WHERE email = 'admin@localhost'"
    ).fetchone()
    conn.close()
    assert row is not None
    assert row == ("admin@localhost", 1, "admin", 1)


def test_sessions_table_is_gone_and_access_tokens_present(db_path):
    conn = sqlite3.connect(str(db_path))
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert "sessions" not in tables
    assert "access_tokens" in tables
    assert "oauth_accounts" in tables