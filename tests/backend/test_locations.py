"""Locations sub-resource CRUD and uniqueness/validation guards."""


def _create_office(authed_client):
    cid = authed_client.get("/api/companies").json()[0]["id"]
    r = authed_client.post(
        f"/api/companies/{cid}/locations",
        json={
            "label": "Regional Office",
            "address": "1 Main St",
            "city": "London",
            "country_code": "GB",
            "type": "Office",
        },
    )
    assert r.status_code == 201
    return cid, r.json()["id"]


def test_create_location_and_resolve_country(authed_client):
    cid, loc_id = _create_office(authed_client)
    r = authed_client.post(
        f"/api/companies/{cid}/locations",
        json={
            "label": "Regional Office",
            "address": "1 Main St",
            "city": "London",
            "country_code": "GB",
            "type": "Office",
        },
    )
    assert r.status_code == 201
    d = r.json()
    assert d["country_name"] == "United Kingdom"
    assert d["country_code"] == "GB"
    assert d["type"] == "Office"


def test_second_headquarters_is_422(authed_client):
    cid = authed_client.get("/api/companies").json()[0]["id"]
    r = authed_client.post(
        f"/api/companies/{cid}/locations",
        json={"label": "Second HQ", "city": "Paris", "country_code": "FR", "type": "Headquarters"},
    )
    assert r.status_code == 422


def test_unknown_country_code_422(authed_client):
    cid = authed_client.get("/api/companies").json()[0]["id"]
    r = authed_client.post(
        f"/api/companies/{cid}/locations",
        json={"label": "Bad", "city": "Nowhere", "country_code": "XX", "type": "Office"},
    )
    assert r.status_code == 422


def test_invalid_location_type_422(authed_client):
    cid = authed_client.get("/api/companies").json()[0]["id"]
    r = authed_client.post(
        f"/api/companies/{cid}/locations",
        json={"label": "Bad", "city": "Nowhere", "country_code": "GB", "type": "Branch"},
    )
    assert r.status_code == 422


def test_update_location(authed_client):
    cid, loc_id = _create_office(authed_client)
    r = authed_client.put(
        f"/api/companies/{cid}/locations/{loc_id}",
        json={"label": "EMEA Office", "city": "Frankfurt", "country_code": "DE", "type": "Office"},
    )
    assert r.status_code == 200
    d = r.json()
    assert d["country_code"] == "DE"
    assert d["country_name"] == "Germany"


def test_delete_location(authed_client):
    cid, loc_id = _create_office(authed_client)
    assert authed_client.delete(f"/api/companies/{cid}/locations/{loc_id}").status_code == 204
    assert authed_client.delete(f"/api/companies/{cid}/locations/{loc_id}").status_code == 404