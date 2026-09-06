"""Sprint 03: role-based access, admin user management, guardrails, and the
SSO discovery/provider wiring.

Uses the shared ``client``/``admin_password`` fixtures from ``conftest.py``.
"""

import pytest

from backend.config import ADMIN_EMAIL


def _login(client, email, password):
    client.post("/api/auth/logout")
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _create_user(client, email, level, password="pass-123456"):
    return client.post(
        "/api/auth/users",
        json={"email": email, "password": password, "access_level": level},
    )


def _authed(client, admin_password):
    r = _login(client, ADMIN_EMAIL, admin_password)
    assert r.status_code == 200
    return client


# ---- Role-based access ----------------------------------------------------


def test_guest_has_no_data_access_but_can_me_logout_change_password(client, admin_password):
    _authed(client, admin_password)
    assert _create_user(client, "guest@example.com", "guest").status_code == 201
    assert _login(client, "guest@example.com", "pass-123456").status_code == 200

    # me / change-password / logout work for a guest.
    assert client.get("/api/auth/me").status_code == 200
    assert (
        client.post(
            "/api/auth/change-password",
            json={"old_password": "pass-123456", "new_password": "pass-abcdef"},
        ).status_code
        == 200
    )
    assert client.post("/api/auth/logout").status_code == 204

    # Every data route (read or write) is denied with 403.
    _login(client, "guest@example.com", "pass-abcdef")
    for method, url in [
        ("GET", "/api/companies"),
        ("GET", "/api/companies/1"),
        ("GET", "/api/industries"),
        ("GET", "/api/countries"),
        ("POST", "/api/companies"),
        ("POST", "/api/companies/1/documents/generate"),
        ("GET", "/api/companies/1/artifacts"),
    ]:
        r = client.request(method, url, json={"name": "X"} if method == "POST" else None)
        assert r.status_code == 403, f"{method} {url} -> {r.status_code}"
        assert r.json() == {"detail": "Insufficient access level"}, f"{method} {url}"


def test_read_only_can_read_but_all_writes_denied(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "ro@example.com", "read-only")
    assert _login(client, "ro@example.com", "pass-123456").status_code == 200

    for url in ["/api/companies", "/api/companies/1", "/api/industries",
                "/api/countries", "/api/companies/1/artifacts"]:
        assert client.get(url).status_code == 200, url

    # Writes — including document generation — are denied with 403.
    assert client.post("/api/companies", json={"name": "X"}).status_code == 403
    assert client.post("/api/companies/1/documents/generate").status_code == 403
    assert client.put("/api/companies/1", json={"name": "X"}).status_code == 403
    assert client.delete("/api/companies/1").status_code == 403
    assert (
        client.post(
            "/api/companies/1/locations",
            json={"label": "HQ", "city": "Paris", "country_code": "FR", "type": "Headquarters"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/companies/1/references", json={"title": "R", "url": "https://example.com"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/companies/1/news",
            json={"title": "N", "source": "S", "url": "https://example.com", "published_at": "2026-01-01"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/companies/1/artifacts", files={"file": ("a.txt", b"hi", "text/plain")}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/companies/1/logo", files={"file": ("a.png", b"x", "image/png")}
        ).status_code
        == 403
    )


def test_user_has_full_view_edit_access(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "user@example.com", "user")
    assert _login(client, "user@example.com", "pass-123456").status_code == 200

    assert client.get("/api/companies").status_code == 200
    assert client.post("/api/companies", json={"name": "Acme"}).status_code == 201
    assert client.post("/api/companies/1/documents/generate").status_code == 201
    # A user is not an admin: user management is denied.
    assert client.get("/api/auth/users").status_code == 403


def test_user_management_admin_only(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "user@example.com", "user")
    assert _login(client, "user@example.com", "pass-123456").status_code == 200

    assert client.get("/api/auth/users").status_code == 403
    assert client.post("/api/auth/users",
                       json={"email": "x@example.com", "password": "pass-123456", "access_level": "user"}).status_code == 403
    assert client.patch("/api/auth/users/1", json={"access_level": "read-only"}).status_code == 403
    assert client.delete("/api/auth/users/1").status_code == 403


def test_denials_are_403_not_401_for_authenticated_out_of_level(client, admin_password):
    """An out-of-level request keeps the session (403); only a missing/invalid
    session returns 401 (already covered in test_auth)."""
    _authed(client, admin_password)
    _create_user(client, "ro@example.com", "read-only")
    _login(client, "ro@example.com", "pass-123456")
    r = client.post("/api/companies", json={"name": "X"})
    assert r.status_code == 403
    # The session is still valid afterwards.
    assert client.get("/api/auth/me").status_code == 200


# ---- Admin user management ------------------------------------------------


def test_create_user_with_each_access_level(client, admin_password):
    _authed(client, admin_password)
    for level in ["guest", "read-only", "user", "admin"]:
        r = _create_user(client, f"{level}@example.com", level)
        assert r.status_code == 201, level
        assert r.json()["access_level"] == level
        assert r.json()["email"] == f"{level}@example.com"


def test_user_management_list_ordered_by_id(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "a@example.com", "user")
    _create_user(client, "b@example.com", "guest")
    rows = client.get("/api/auth/users").json()
    assert [r["id"] for r in rows] == sorted(r["id"] for r in rows)
    assert all(set(r) == {"id", "email", "access_level", "is_active"} for r in rows)


def test_admin_changes_level_and_active_state(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "a@example.com", "guest")
    uid = [u["id"] for u in client.get("/api/auth/users").json() if u["email"] == "a@example.com"][0]

    r = client.patch(f"/api/auth/users/{uid}", json={"access_level": "user"})
    assert r.status_code == 200
    assert r.json()["access_level"] == "user"

    r = client.patch(f"/api/auth/users/{uid}", json={"is_active": False})
    assert r.status_code == 200
    assert r.json()["is_active"] is False

    # Deactivated account can no longer sign in.
    assert _login(client, "a@example.com", "pass-123456").status_code == 400


def test_patch_requires_at_least_one_field(client, admin_password):
    _authed(client, admin_password)
    assert client.patch("/api/auth/users/1", json={}).status_code == 422


def test_admin_delete_removes_account(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "a@example.com", "user")
    uid = [u["id"] for u in client.get("/api/auth/users").json() if u["email"] == "a@example.com"][0]
    assert client.delete(f"/api/auth/users/{uid}").status_code == 204
    assert client.get("/api/auth/users").status_code == 200
    assert all(u["email"] != "a@example.com" for u in client.get("/api/auth/users").json())
    assert _login(client, "a@example.com", "pass-123456").status_code == 400


def test_delete_unknown_user_404(client, admin_password):
    _authed(client, admin_password)
    assert client.delete("/api/auth/users/9999").status_code == 404


# ---- Guardrails -----------------------------------------------------------


def test_bootstrap_admin_is_immutable(client, admin_password):
    _authed(client, admin_password)
    detail = {"detail": "The bootstrap admin cannot be modified"}
    assert client.patch("/api/auth/users/1", json={"access_level": "user"}).json() == detail
    assert client.patch("/api/auth/users/1", json={"is_active": False}).json() == detail
    assert client.delete("/api/auth/users/1").json() == detail
    # Unchanged in the DB.
    assert client.get("/api/auth/me").json()["access_level"] == "admin"


def test_admin_cannot_change_own_level(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "admin2@example.com", "admin")
    uid = [u["id"] for u in client.get("/api/auth/users").json() if u["email"] == "admin2@example.com"][0]
    _login(client, "admin2@example.com", "pass-123456")
    r = client.patch(f"/api/auth/users/{uid}", json={"access_level": "user"})
    assert r.status_code == 400
    assert r.json() == {"detail": "Admins cannot change their own level"}


def test_self_deactivation_permitted_and_ends_session(client, admin_password):
    _authed(client, admin_password)
    _create_user(client, "admin2@example.com", "admin")
    uid = [u["id"] for u in client.get("/api/auth/users").json() if u["email"] == "admin2@example.com"][0]
    _login(client, "admin2@example.com", "pass-123456")
    assert client.patch(f"/api/auth/users/{uid}", json={"is_active": False}).status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_demoting_the_only_other_admin_is_allowed(client, admin_password):
    """The last-admin rule is a defensive backstop: because the bootstrap admin
    is always an admin and immutable, an admin can never be removed that would
    leave zero admins. Demoting the sole other admin is therefore permitted."""
    _authed(client, admin_password)
    _create_user(client, "admin2@example.com", "admin")
    uid = [u["id"] for u in client.get("/api/auth/users").json() if u["email"] == "admin2@example.com"][0]
    assert client.patch(f"/api/auth/users/{uid}", json={"access_level": "user"}).status_code == 200


# ---- SSO discovery / wiring -----------------------------------------------


def test_providers_reports_google_disabled_by_default(client):
    assert client.get("/api/auth/providers").status_code == 200
    assert client.get("/api/auth/providers").json() == {"google": False}


def test_google_sso_router_mounting(monkeypatch):
    from backend.auth import oauth, providers

    monkeypatch.delenv("COMPANY_HUB_GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("COMPANY_HUB_GOOGLE_CLIENT_SECRET", raising=False)
    assert providers.google_sso_configured() is False
    assert providers.google_oauth_client() is None
    assert oauth.get_google_oauth_router() is None

    monkeypatch.setenv("COMPANY_HUB_GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("COMPANY_HUB_GOOGLE_CLIENT_SECRET", "client-secret")
    assert providers.google_sso_configured() is True
    router = oauth.get_google_oauth_router()
    assert router is not None
    paths = {r.path for r in router.routes}
    assert "/auth/authorize" in paths and "/auth/callback" in paths
    assert providers.google_oauth_client() is not None