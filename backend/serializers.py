"""Serialization helpers mapping ORM rows to the documented JSON shapes.

The public API shapes are defined here so routers share a single source of
truth (the role formerly played by the v0.1 ``backend/models.py`` row helpers).
The on-disk ``stored_filename`` is intentionally never exposed to clients.

Sprint 01 completeness rule: ``name`` present, ``industry_id`` set, and every
one of ``website``/``contact_email``/``contact_phone``/``description``
non-empty. Locations and logos do not count.
"""

TEXT_FIELDS_FOR_COMPLETENESS = (
    "website",
    "contact_email",
    "contact_phone",
    "description",
)

ARTIFACT_FIELDS = (
    "id",
    "company_id",
    "original_name",
    "content_type",
    "size_bytes",
    "created_at",
    "source",
)

LOCATION_FIELDS = (
    "id",
    "company_id",
    "label",
    "address",
    "city",
    "country_code",
    "type",
)

REFERENCE_FIELDS = (
    "id",
    "company_id",
    "title",
    "url",
    "description",
    "added_by",
    "created_at",
    "updated_at",
)

NEWS_FIELDS = (
    "id",
    "company_id",
    "title",
    "source",
    "url",
    "published_at",
    "summary",
    "created_at",
    "updated_at",
)


def company_is_complete(company) -> bool:
    """A company is complete when ``name`` is present, ``industry_id`` is set,
    and every text field is non-empty. Derived, never stored."""
    if not company.name or company.industry_id is None:
        return False
    return all(bool(getattr(company, f)) for f in TEXT_FIELDS_FOR_COMPLETENESS)


def artifact_to_dict(artifact) -> dict:
    data = {f: getattr(artifact, f) for f in ARTIFACT_FIELDS}
    data["download_url"] = f"/api/artifacts/{artifact.id}/content"
    return data


def location_to_dict(location, country_name: str | None) -> dict:
    data = {f: getattr(location, f) for f in LOCATION_FIELDS}
    data["country_name"] = country_name
    return data


def reference_to_dict(reference) -> dict:
    return {f: getattr(reference, f) for f in REFERENCE_FIELDS}


def news_to_dict(article) -> dict:
    data = {f: getattr(article, f) for f in NEWS_FIELDS}
    data["is_scraped"] = bool(article.is_scraped)
    return data


def company_item_to_dict(company, industry, hq_location, artifacts_count, logo_url) -> dict:
    """Company payload shape used by the list and profile endpoints.

    ``industry`` is the nested ``{id, name}`` or ``None``; ``hq_location`` is
    the derived ``"<city>, <country_code>"`` or ``None``; ``logo_url`` is the
    logo object URL or ``None``; ``artifacts_count`` excludes ``source =
    'logo'`` rows.
    """
    return {
        "id": company.id,
        "name": company.name,
        "industry": industry,
        "hq_location": hq_location,
        "website": company.website,
        "contact_email": company.contact_email,
        "contact_phone": company.contact_phone,
        "description": company.description,
        "created_at": company.created_at,
        "updated_at": company.updated_at,
        "is_complete": company_is_complete(company),
        "artifacts_count": artifacts_count,
        "logo_url": logo_url,
    }