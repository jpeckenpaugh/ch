"""News CRUD: published_at validation and is_scraped preservation on PUT."""


def _seed_company_id(authed_client):
    return authed_client.get("/api/companies").json()[0]["id"]


def _create_news(authed_client):
    cid = _seed_company_id(authed_client)
    r = authed_client.post(
        f"/api/companies/{cid}/news",
        json={"title": "Q2 Results", "source": "Reuters", "url": "https://example.com/q2", "published_at": "2026-08-01", "summary": "Beat expectations"},
    )
    assert r.status_code == 201
    d = r.json()
    assert d["is_scraped"] is False
    return cid, d["id"]


def test_create_news_defaults_is_scraped_false(authed_client):
    _create_news(authed_client)


def test_malformed_published_at_422(authed_client):
    cid = _seed_company_id(authed_client)
    for bad in ("2026-13-99", "08/01/2026", "2026-08-1"):
        r = authed_client.post(
            f"/api/companies/{cid}/news",
            json={"title": "Bad", "source": "X", "url": "u", "published_at": bad},
        )
        assert r.status_code == 422, f"published_at={bad!r} -> {r.status_code}"


def test_update_news_sets_and_preserves_is_scraped(authed_client):
    cid, news_id = _create_news(authed_client)
    r = authed_client.put(
        f"/api/companies/{cid}/news/{news_id}",
        json={"title": "Q2 Results Final", "source": "Reuters", "url": "https://example.com/q2", "published_at": "2026-08-02", "summary": "beat", "is_scraped": True},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Q2 Results Final"
    assert r.json()["is_scraped"] is True

    omitted = authed_client.put(
        f"/api/companies/{cid}/news/{news_id}",
        json={"title": "Q2 Results Final v2", "source": "Reuters", "url": "https://example.com/q2", "published_at": "2026-08-02", "summary": "beat"},
    )
    assert omitted.status_code == 200
    assert omitted.json()["is_scraped"] is True


def test_delete_news(authed_client):
    cid, news_id = _create_news(authed_client)
    assert authed_client.delete(f"/api/companies/{cid}/news/{news_id}").status_code == 204
    assert authed_client.delete(f"/api/companies/{cid}/news/{news_id}").status_code == 404