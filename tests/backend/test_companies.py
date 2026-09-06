"""Companies: list shape + derived fields, country/q filters, CRUD."""

_COMPLETE_FIELDS = {
    "name": "Test Corp",
    "industry_id": 1,
    "website": "https://t.example",
    "contact_email": "t@example.com",
    "contact_phone": "+1 555",
    "description": "test",
}


def _names(data):
    return [c["name"] for c in data]


def test_list_shape_and_derived_fields(authed_client):
    r = authed_client.get("/api/companies")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    first = data[0]
    assert set(first) == {
        "id",
        "name",
        "industry",
        "hq_location",
        "website",
        "contact_email",
        "contact_phone",
        "description",
        "created_at",
        "updated_at",
        "is_complete",
        "artifacts_count",
        "logo_url",
    }
    assert first["industry"]["name"]
    assert first["hq_location"]
    assert first["logo_url"] and first["logo_url"].startswith("/api/artifacts/")
    assert first["is_complete"] is True

    by = {c["name"]: c for c in data}
    assert by["Shell"]["hq_location"] == "London, GB"
    assert by["HSBC"]["hq_location"] == "London, GB"
    assert by["Carrefour"]["hq_location"] == "Paris, FR"


def test_country_filter_single_and_multi(authed_client):
    gb = authed_client.get("/api/companies", params={"countries": "GB"})
    assert _names(gb.json()) == ["HSBC", "Shell"]

    multi = authed_client.get("/api/companies", params={"countries": "GB,FR"})
    assert sorted(_names(multi.json())) == ["Carrefour", "HSBC", "Shell"]

    dup = authed_client.get("/api/companies", params={"countries": "GB,GB"})
    assert _names(dup.json()) == ["HSBC", "Shell"]


def test_country_filter_unknown_and_present_empty(authed_client):
    unknown = authed_client.get("/api/companies", params={"countries": "ZZ"})
    assert unknown.json() == []

    empty = authed_client.get("/api/companies", params={"countries": ""})
    assert empty.json() == []


def test_q_filter_and_combined(authed_client):
    q = authed_client.get("/api/companies", params={"q": "toyota"})
    assert _names(q.json()) == ["Toyota Motor"]

    combined = authed_client.get(
        "/api/companies", params={"q": "shell", "countries": "GB"}
    )
    assert _names(combined.json()) == ["Shell"]


def _create_company(authed_client, **overrides):
    r = authed_client.post("/api/companies", json={**_COMPLETE_FIELDS, **overrides})
    assert r.status_code == 201
    return r.json()["id"]


def test_create_company_with_industry(authed_client):
    r = authed_client.post("/api/companies", json=_COMPLETE_FIELDS)
    assert r.status_code == 201
    d = r.json()
    assert d["industry"] == {"id": 1, "name": "Manufacturing"}
    assert d["hq_location"] is None
    assert d["is_complete"] is True
    assert d["artifacts_count"] == 0
    assert d["logo_url"] is None


def test_create_company_unknown_industry_422(authed_client):
    r = authed_client.post(
        "/api/companies", json={"name": "X", "industry_id": 99999}
    )
    assert r.status_code == 422


def test_create_company_blank_name_422(authed_client):
    r = authed_client.post("/api/companies", json={"name": "   "})
    assert r.status_code == 422


def test_update_company(authed_client):
    cid = _create_company(authed_client)
    r = authed_client.put(
        f"/api/companies/{cid}",
        json={**_COMPLETE_FIELDS, "industry_id": 2, "description": "updated"},
    )
    assert r.status_code == 200
    assert r.json()["industry"]["name"] == "Technology"
    assert r.json()["description"] == "updated"


def test_profile_empty_related_sets(authed_client):
    cid = _create_company(authed_client)
    r = authed_client.get(f"/api/companies/{cid}")
    assert r.status_code == 200
    d = r.json()
    assert d["locations"] == []
    assert d["references"] == []
    assert d["news"] == []
    assert d["artifacts"] == []


def test_delete_company(authed_client):
    cid = _create_company(authed_client)
    assert authed_client.delete(f"/api/companies/{cid}").status_code == 204
    assert authed_client.get(f"/api/companies/{cid}").status_code == 404
    assert authed_client.delete(f"/api/companies/{cid}").status_code == 404