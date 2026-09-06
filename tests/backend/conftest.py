"""Shared fixtures for the backend test suite.

The storage root is redirected to a session-scoped temp directory before any
backend module is imported (guarding against the real ``data/`` tree), and each
test then gets its own throwaway DB via a function-scoped ``client`` fixture.
The admin password is fixed per test so login is deterministic. The engine is
re-created per test so the app's startup (migrations + seed + bootstrap admin)
runs against the fresh database.
"""

import os
import tempfile
from pathlib import Path

import pytest

_SESSION_TMP = Path(tempfile.mkdtemp(prefix="company-hub-tests-"))
os.environ["COMPANY_HUB_DB"] = str(_SESSION_TMP / "company_hub.db")

from fastapi.testclient import TestClient  # noqa: E402

from backend.app import app  # noqa: E402
from backend.config import ADMIN_EMAIL  # noqa: E402
from backend.db import engine as engine_module  # noqa: E402
from backend.services import storage as storage_module  # noqa: E402

ADMIN_PASSWORD = "test-admin-password"


@pytest.fixture()
def admin_password() -> str:
    return ADMIN_PASSWORD


@pytest.fixture()
def db_path(client) -> Path:
    """The SQLite file backing the current client (for direct inspection)."""
    return Path(engine_module.DB_PATH)


@pytest.fixture()
def client(tmp_path, monkeypatch, admin_password):
    db_file = tmp_path / "company_hub.db"
    artifacts_dir = db_file.parent / "artifacts"
    monkeypatch.setattr(engine_module, "DB_PATH", db_file)
    monkeypatch.setattr(storage_module, "ARTIFACTS_DIR", artifacts_dir)
    monkeypatch.setenv("COMPANY_HUB_ADMIN_PASSWORD", admin_password)
    engine_module.reset()
    with TestClient(app) as c:
        yield c
    engine_module.reset()


@pytest.fixture()
def authed_client(client, admin_password):
    r = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    assert r.status_code == 200
    return client