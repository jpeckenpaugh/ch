"""Authentication (fastapi-users): route gating, login/logout/me, password
change, multiple users, and session expiry."""

import sqlite3
from datetime import datetime, timedelta, timezone

from backend.config import ADMIN_EMAIL


def _protected_requests():
    return [
        ("GET", "/api/auth/me"),
        ("PATCH", "/api/auth/me", {"password": "new-password-1"}),
        ("POST", "/api/auth/change-password", {"old_password": "x", "new_password": "new-password-1"}),
        ("POST", "/api/auth/users", {"email": "a@example.com", "password": "new-password-1", "access_level": "user"}),
        ("GET", "/api/auth/users"),
        ("PATCH", "/api/auth/users/1", {"access_level": "read-only"}),
        ("DELETE", "/api/auth/users/1"),
        ("GET", "/api/industries"),
        ("POST", "/api/industries", {"name": "X"}),
        ("PUT", "/api/industries/1", {"name": "X"}),
        ("GET", "/api/countries"),
        ("GET", "/api/companies"),
        ("POST", "/api/companies", {"name": "X"}),
        ("GET", "/api/companies/1"),
        ("PUT", "/api/companies/1", {"name": "X"}),
        ("DELETE", "/api/companies/1"),
        ("POST", "/api/companies/1/locations", {"label": "HQ", "city": "Paris", "country_code": "FR", "type": "Headquarters"}),
        ("PUT", "/api/companies/1/locations/1", {"label": "HQ", "city": "Paris", "country_code": "FR", "type": "Headquarters"}),
        ("DELETE", "/api/companies/1/locations/1"),
        ("POST", "/api/companies/1/references", {"title": "R", "url": "https://example.com"}),
        ("PUT", "/api/companies/1/references/1", {"title": "R", "url": "https://example.com"}),
        ("DELETE", "/api/companies/1/references/1"),
        ("POST", "/api/companies/1/news", {"title": "N", "source": "S", "url": "https://example.com", "published_at": "2026-01-01"}),
        ("PUT", "/api/companies/1/news/1", {"title": "N", "source": "S", "url": "https://example.com", "published_at": "2026-01-01"}),
        ("DELETE", "/api/companies/1/news/1"),
        ("POST", "/api/companies/1/artifacts"),
        ("GET", "/api/companies/1/artifacts"),
        ("GET", "/api/artifacts/1/content"),
        ("DELETE", "/api/artifacts/1"),
        ("POST", "/api/companies/1/logo"),
        ("DELETE", "/api/companies/1/logo"),
        ("POST", "/api/companies/1/documents/generate"),
    ]


def test_every_protected_route_401s_without_a_session(client):
    for method, url, *rest in _protected_requests():
        kwargs = {}
        if rest:
            if method == "POST" and url.endswith(("/artifacts", "/logo")):
                kwargs["files"] = {"file": ("notes.txt", b"hello", "text/plain")}
            else:
                kwargs["json"] = rest[0]
        r = client.request(method, url, **kwargs)
        assert r.status_code == 401, f"{method} {url} -> {r.status_code}"
        assert r.json() == {"detail": "Not authenticated"}, f"{method} {url}"


def test_login_bad_credentials_400(client):
    r = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": "wrong-password"},
    )
    assert r.status_code == 400
    assert r.json() == {"detail": "LOGIN_BAD_CREDENTIALS"}


def test_login_unknown_email_400(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "whatever-1"},
    )
    assert r.status_code == 400
    assert r.json() == {"detail": "LOGIN_BAD_CREDENTIALS"}


def test_login_success_sets_cookie_and_returns_token(client, admin_password):
    r = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"access_token", "token_type"}
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert r.cookies.get("session") == body["access_token"]


def test_login_is_case_insensitive_on_email(client, admin_password):
    r = client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL.upper(), "password": admin_password},
    )
    assert r.status_code == 200


def test_me_returns_contracted_shape(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json() == {"id": 1, "email": ADMIN_EMAIL, "access_level": "admin"}


def test_logout_is_idempotent_and_revokes_immediately(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    assert client.get("/api/companies").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/companies").status_code == 401
    assert client.post("/api/auth/logout").status_code == 204
    assert client.post("/api/auth/logout").status_code == 204


def test_change_password_rotates_credential(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    r = client.post(
        "/api/auth/change-password",
        json={"old_password": admin_password, "new_password": "brand-new-pass-1"},
    )
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

    client.post("/api/auth/logout")
    old = client.post(
        "/api/auth/login", json={"email": ADMIN_EMAIL, "password": admin_password}
    )
    assert old.status_code == 400
    new = client.post(
        "/api/auth/login", json={"email": ADMIN_EMAIL, "password": "brand-new-pass-1"}
    )
    assert new.status_code == 200


def test_change_password_wrong_old_400(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    r = client.post(
        "/api/auth/change-password",
        json={"old_password": "not-the-password", "new_password": "brand-new-pass-1"},
    )
    assert r.status_code == 400
    assert r.json() == {"detail": "INVALID_PASSWORD"}


def test_change_password_too_short_422(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    r = client.post(
        "/api/auth/change-password",
        json={"old_password": admin_password, "new_password": "short"},
    )
    assert r.status_code == 422


def test_superuser_creates_account_that_can_sign_in(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    r = client.post(
        "/api/auth/users",
        json={"email": "alice@example.com", "password": "alice-pass-123", "access_level": "user"},
    )
    assert r.status_code == 201
    created = r.json()
    assert created == {"id": 3, "email": "alice@example.com", "access_level": "user"}

    client.post("/api/auth/logout")
    alice = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "alice-pass-123"}
    )
    assert alice.status_code == 200
    me = client.get("/api/auth/me")
    assert me.json() == {"id": 3, "email": "alice@example.com", "access_level": "user"}
    assert client.get("/api/companies").status_code == 200


def test_duplicate_email_400(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    r = client.post(
        "/api/auth/users",
        json={"email": "alice@example.com", "password": "alice-pass-123", "access_level": "user"},
    )
    assert r.status_code == 201
    r = client.post(
        "/api/auth/users",
        json={"email": "alice@example.com", "password": "alice-pass-123", "access_level": "user"},
    )
    assert r.status_code == 400
    assert r.json() == {"detail": "REGISTER_USER_ALREADY_EXISTS"}


def test_create_account_bad_email_or_password_422(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    assert (
        client.post(
            "/api/auth/users",
            json={"email": "not-an-email", "password": "alice-pass-123", "access_level": "user"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/auth/users",
            json={"email": "bob@example.com", "password": "short", "access_level": "user"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/auth/users",
            json={"email": "bob@example.com", "password": "bob-pass-123", "access_level": "super-admin"},
        ).status_code
        == 422
    )


def test_non_superuser_cannot_create_accounts(client, admin_password):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    client.post(
        "/api/auth/users",
        json={"email": "alice@example.com", "password": "alice-pass-123", "access_level": "user"},
    )
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "alice-pass-123"}
    )
    r = client.post(
        "/api/auth/users",
        json={"email": "carol@example.com", "password": "carol-pass-123", "access_level": "user"},
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "Insufficient access level"}


def test_session_expires_after_lifetime(client, admin_password, monkeypatch, db_path):
    monkeypatch.setenv("COMPANY_HUB_SESSION_TTL", "3600")
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    assert client.get("/api/companies").status_code == 200

    # Backdate the session token beyond its lifetime (naive UTC, matching the
    # format SQLAlchemy stores for the DateTime column).
    expired = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=7200)
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("UPDATE access_tokens SET created_at = ?", (str(expired),))
        conn.commit()
    finally:
        conn.close()

    r = client.get("/api/companies")
    assert r.status_code == 401
    assert r.json() == {"detail": "Not authenticated"}
    assert client.get("/api/auth/me").status_code == 401

    # Sign-out with an expired token stays idempotent (204).
    assert client.post("/api/auth/logout").status_code == 204


def test_logout_revokes_server_side(client, admin_password, db_path):
    client.post(
        "/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": admin_password},
    )
    conn = sqlite3.connect(str(db_path))
    try:
        before = conn.execute("SELECT COUNT(*) FROM access_tokens").fetchone()[0]
    finally:
        conn.close()
    assert before == 1

    client.post("/api/auth/logout")

    conn = sqlite3.connect(str(db_path))
    try:
        after = conn.execute("SELECT COUNT(*) FROM access_tokens").fetchone()[0]
    finally:
        conn.close()
    assert after == 0