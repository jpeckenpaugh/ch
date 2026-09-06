"""Industries: seeded reference list, add, rename, duplicate/blank guards."""


def test_list_industries_seeded_and_sorted(authed_client):
    r = authed_client.get("/api/industries")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    assert [x["name"] for x in data] == sorted(x["name"] for x in data)
    assert data[0]["name"] == "Energy"
    assert {x["name"] for x in data} == {
        "Manufacturing",
        "Technology",
        "Finance",
        "Healthcare",
        "Energy",
        "Retail",
    }


def test_create_and_duplicate_industry(authed_client):
    r = authed_client.post("/api/industries", json={"name": "Aerospace"})
    assert r.status_code == 201
    assert r.json()["name"] == "Aerospace"

    dup = authed_client.post("/api/industries", json={"name": "Aerospace"})
    assert dup.status_code == 409

    case_dup = authed_client.post("/api/industries", json={"name": "aerospace"})
    assert case_dup.status_code == 409

    blank = authed_client.post("/api/industries", json={"name": "   "})
    assert blank.status_code == 422


def test_rename_industry(authed_client):
    aero_id = authed_client.post(
        "/api/industries", json={"name": "Aerospace"}
    ).json()["id"]
    r = authed_client.put(
        f"/api/industries/{aero_id}", json={"name": "Aerospace & Defense"}
    )
    assert r.status_code == 200
    assert r.json() == {"id": aero_id, "name": "Aerospace & Defense"}


def test_rename_to_existing_is_409(authed_client):
    aero_id = authed_client.post(
        "/api/industries", json={"name": "Aerospace"}
    ).json()["id"]
    r = authed_client.put(f"/api/industries/{aero_id}", json={"name": "Manufacturing"})
    assert r.status_code == 409

    case_r = authed_client.put(
        f"/api/industries/{aero_id}", json={"name": "manufacturing"}
    )
    assert case_r.status_code == 409


def test_rename_missing_industry_404(authed_client):
    r = authed_client.put("/api/industries/99999", json={"name": "X"})
    assert r.status_code == 404