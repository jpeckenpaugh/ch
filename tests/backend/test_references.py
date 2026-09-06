"""References CRUD: added_by is the signed-in user, created_at immutable."""

from backend.config import ADMIN_EMAIL


def _seed_company_id(authed_client):
    return authed_client.get("/api/companies").json()[0]["id"]


def _create_reference(authed_client):
    cid = _seed_company_id(authed_client)
    r = authed_client.post(
        f"/api/companies/{cid}/references",
        json={"title": "Annual Report", "url": "https://example.com/report", "description": "FY report"},
    )
    assert r.status_code == 201
    d = r.json()
    assert d["added_by"] == ADMIN_EMAIL
    return cid, d["id"], d


def test_create_reference(authed_client):
    cid, ref_id, d = _create_reference(authed_client)
    assert d["created_at"]
    assert d["updated_at"] == d["created_at"]


def test_update_reference_preserves_adder_and_created_at(authed_client):
    cid, ref_id, created = _create_reference(authed_client)
    r = authed_client.put(
        f"/api/companies/{cid}/references/{ref_id}",
        json={"title": "Annual Report 2026", "url": "https://example.com/report/2026", "description": "Updated"},
    )
    assert r.status_code == 200
    d = r.json()
    assert d["title"] == "Annual Report 2026"
    assert d["added_by"] == ADMIN_EMAIL
    assert d["created_at"] == created["created_at"]
    assert d["updated_at"] >= d["created_at"]


def test_delete_reference(authed_client):
    cid, ref_id, _ = _create_reference(authed_client)
    assert authed_client.delete(f"/api/companies/{cid}/references/{ref_id}").status_code == 204
    assert authed_client.delete(f"/api/companies/{cid}/references/{ref_id}").status_code == 404