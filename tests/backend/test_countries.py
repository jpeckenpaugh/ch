"""Countries: the fixed read-only reference list."""


def test_countries_seeded_sorted_with_gb(authed_client):
    r = authed_client.get("/api/countries")
    assert r.status_code == 200
    data = r.json()
    assert 50 <= len(data) <= 100
    assert {"code": "GB", "name": "United Kingdom"} in data
    names = [c["name"] for c in data]
    assert names == sorted(names, key=str.lower)
    assert len({c["code"] for c in data}) == len(data)