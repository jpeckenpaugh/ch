"""Public identity-provider discovery and the optional Google OAuth client.

``GET /api/auth/providers`` is always mounted and tells the static SPA whether
SSO is available (the SPA cannot read environment variables). ``google`` is
``true`` only when both ``COMPANY_HUB_GOOGLE_CLIENT_ID`` and
``COMPANY_HUB_GOOGLE_CLIENT_SECRET`` are present. The GoogleOAuth2 client is
constructed lazily; the SSO router is only mounted when the credentials are
present (architecture §10.2.5, §10.3).
"""

from fastapi import APIRouter

from backend.config import google_sso_configured

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/providers")
async def providers() -> dict:
    return {"google": google_sso_configured()}


def google_oauth_client():
    """Construct the Google OAuth2 client from the environment, or ``None``."""
    if not google_sso_configured():
        return None
    from httpx_oauth.clients.google import GoogleOAuth2

    import os

    return GoogleOAuth2(
        os.environ["COMPANY_HUB_GOOGLE_CLIENT_ID"],
        os.environ["COMPANY_HUB_GOOGLE_CLIENT_SECRET"],
    )