"""Logos and generic artifacts: image gate, replace/remove, exclusion rules."""

import base64

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)
FAKE_PNG = b"this is not really an image"


def _seed_company_id(authed_client):
    return authed_client.get("/api/companies").json()[0]["id"]


def test_non_image_logo_415(authed_client):
    cid = _seed_company_id(authed_client)
    r = authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 415


def _upload_logo(authed_client):
    cid = _seed_company_id(authed_client)
    r = authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("logo.png", PNG, "image/png")},
    )
    assert r.status_code == 201
    return cid, r.json()["id"]


def test_upload_logo_sets_company_logo_url(authed_client):
    cid, logo_id = _upload_logo(authed_client)
    company = authed_client.get("/api/companies").json()
    logo_company = [c for c in company if c["id"] == cid][0]
    assert logo_company["logo_url"] == f"/api/artifacts/{logo_id}/content"
    assert logo_company["artifacts_count"] == 0


def test_replace_logo_deletes_previous_bytes(authed_client):
    cid, old_id = _upload_logo(authed_client)
    r = authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("logo2.png", PNG, "image/png")},
    )
    assert r.status_code == 201
    new_id = r.json()["id"]
    assert new_id != old_id
    assert authed_client.get(f"/api/artifacts/{old_id}/content").status_code == 404


def test_fake_image_passes_image_gate(authed_client):
    cid = _seed_company_id(authed_client)
    r = authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("fake.png", FAKE_PNG, "image/png")},
    )
    assert r.status_code == 201


def test_generic_artifact_list_excludes_logos(authed_client):
    cid = _seed_company_id(authed_client)
    authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("logo.png", PNG, "image/png")},
    )
    r = authed_client.post(
        f"/api/companies/{cid}/artifacts",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 201
    art_id = r.json()["id"]

    lst = authed_client.get(f"/api/companies/{cid}/artifacts").json()
    assert len(lst) == 1
    assert all(a["source"] != "logo" for a in lst)

    profile = authed_client.get(f"/api/companies/{cid}").json()
    assert profile["artifacts_count"] == 1
    assert all(a["source"] != "logo" for a in profile["artifacts"])
    assert profile["logo_url"]

    assert authed_client.delete(f"/api/artifacts/{art_id}").status_code == 204


def test_delete_logo_and_again_404(authed_client):
    cid, _ = _upload_logo(authed_client)
    assert authed_client.delete(f"/api/companies/{cid}/logo").status_code == 204
    assert authed_client.delete(f"/api/companies/{cid}/logo").status_code == 404