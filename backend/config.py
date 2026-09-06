"""Runtime configuration: paths, environment overrides, and time helpers.

All paths are anchored to the repository root (the parent of the ``backend``
package) rather than the process working directory, so the app is robust
regardless of where it is launched from. Importing this module performs no I/O
beyond reading environment variables at import time.

Sprint 02: the persistence layer now lives under ``backend/db/`` and honors the
same environment overrides as the v0.1/Sprint 01 build (``COMPANY_HUB_DB`` for
the storage root, ``COMPANY_HUB_SESSION_TTL`` for the session lifetime).
"""

import os
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATA_DIR = PROJECT_ROOT / "data"

_OVERRIDE_DB = os.environ.get("COMPANY_HUB_DB")
if _OVERRIDE_DB:
    DB_PATH = Path(_OVERRIDE_DB)
    ARTIFACTS_DIR = DB_PATH.parent / "artifacts"
else:
    DB_PATH = DATA_DIR / "company_hub.db"
    ARTIFACTS_DIR = DATA_DIR / "artifacts"

ADMIN_EMAIL = "admin@localhost"
AGENT_EMAIL = "agent@localhost"

DEFAULT_SESSION_TTL = 7 * 24 * 60 * 60  # 604800 seconds (7 days)


def session_ttl_seconds() -> int:
    """The fixed absolute session lifetime in seconds.

    ``COMPANY_HUB_SESSION_TTL`` overrides the 7-day default; invalid/absent
    values fall back to the default. Non-positive values are rejected so a
    misconfigured variable never creates instant-expiry sessions.
    """
    raw = os.environ.get("COMPANY_HUB_SESSION_TTL")
    if raw:
        try:
            value = int(raw)
        except ValueError:
            return DEFAULT_SESSION_TTL
        if value > 0:
            return value
    return DEFAULT_SESSION_TTL


def utc_now() -> str:
    """Current UTC time as an ISO-8601 string with a ``Z`` suffix."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def secure_cookies() -> bool:
    """Whether session and OAuth cookies should be ``Secure``.

    ``COMPANY_HUB_SECURE_COOKIES=1`` enables the production secure default;
    the default (off) keeps cookies non-Secure so the SSO flow works over plain
    HTTP on localhost (Brief 03 item 7).
    """
    return os.environ.get("COMPANY_HUB_SECURE_COOKIES") == "1"


def google_sso_configured() -> bool:
    """True when both Google OAuth credentials are present (SSO enabled)."""
    return bool(
        os.environ.get("COMPANY_HUB_GOOGLE_CLIENT_ID")
        and os.environ.get("COMPANY_HUB_GOOGLE_CLIENT_SECRET")
    )


def google_sso_state_secret() -> str:
    """The secret signing the OAuth state token.

    ``COMPANY_HUB_OAUTH_STATE_SECRET`` wins when set; otherwise the Google
    client secret is used (architecture §10.8 item 11).
    """
    return (
        os.environ.get("COMPANY_HUB_OAUTH_STATE_SECRET")
        or os.environ.get("COMPANY_HUB_GOOGLE_CLIENT_SECRET")
        or ""
    )


def ensure_dirs() -> None:
    """Create the runtime storage directories if absent."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)