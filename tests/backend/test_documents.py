"""Document generation gated on the completeness rule; logo never breaks it."""

import base64

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)
FAKE_PNG = b"this is not really an image"

_FAILURE = {
    "success": False,
    "message": "Not enough information to generate a document",
    "artifact": None,
}

_COMPLETE = {
    "name": "Test Corp",
    "industry_id": 1,
    "website": "https://t.example",
    "contact_email": "t@example.com",
    "contact_phone": "+1 555",
    "description": "test",
}


def _seed_company_id(authed_client):
    return authed_client.get("/api/companies").json()[0]["id"]


def test_generate_with_embeddable_logo(authed_client):
    cid = _seed_company_id(authed_client)
    authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("logo.png", PNG, "image/png")},
    )
    r = authed_client.post(f"/api/companies/{cid}/documents/generate")
    assert r.status_code == 201
    d = r.json()
    assert d["success"] is True
    assert d["artifact"]["source"] == "generated"
    assert d["artifact"]["content_type"] == "application/pdf"


def test_generate_with_unembeddable_logo_still_201(authed_client):
    cid = _seed_company_id(authed_client)
    authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("fake.png", FAKE_PNG, "image/png")},
    )
    r = authed_client.post(f"/api/companies/{cid}/documents/generate")
    assert r.status_code == 201
    assert r.json()["success"] is True


def test_generate_incomplete_company_422(authed_client):
    r = authed_client.post("/api/companies", json={"name": "Incomplete"})
    cid = r.json()["id"]
    g = authed_client.post(f"/api/companies/{cid}/documents/generate")
    assert g.status_code == 422
    assert g.json() == _FAILURE


def test_completeness_requires_industry_id(authed_client):
    r = authed_client.post(
        "/api/companies",
        json={"name": "No Industry", **{k: v for k, v in _COMPLETE.items() if k != "industry_id"}},
    )
    cid = r.json()["id"]
    assert authed_client.get(f"/api/companies/{cid}").json()["is_complete"] is False
    g = authed_client.post(f"/api/companies/{cid}/documents/generate")
    assert g.status_code == 422


def test_completeness_requires_all_text_fields(authed_client):
    r = authed_client.post(
        "/api/companies",
        json={"name": "Partial", "industry_id": 1, "website": "https://t.example"},
    )
    cid = r.json()["id"]
    assert authed_client.get(f"/api/companies/{cid}").json()["is_complete"] is False
    assert authed_client.post(f"/api/companies/{cid}/documents/generate").status_code == 422


def test_locations_and_logo_do_not_count_toward_completeness(authed_client):
    cid = _seed_company_id(authed_client)
    authed_client.post(
        f"/api/companies/{cid}/logo",
        files={"file": ("logo.png", PNG, "image/png")},
    )
    profile = authed_client.get(f"/api/companies/{cid}").json()
    assert profile["is_complete"] is True
    assert len(profile["locations"]) >= 1
    assert authed_client.post(f"/api/companies/{cid}/documents/generate").status_code == 201


def test_generate_missing_company_404(authed_client):
    assert authed_client.post("/api/companies/99999/documents/generate").status_code == 404