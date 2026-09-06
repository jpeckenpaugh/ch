"""fastapi-users auth backend: stateful ``DatabaseStrategy`` + ``CookieTransport``.

Sessions are server-side tokens persisted in ``access_tokens`` (keyed to the
user), carried to the browser in the HttpOnly ``session`` cookie. The strategy
enforces a fixed absolute lifetime (default 7 days, ``COMPANY_HUB_SESSION_TTL``
to override, ``cookie_max_age`` matches); the refresh flow is disabled. Sign-out
deletes the token row (immediate server-side revocation).

``CompanyHubDatabaseStrategy`` records each session's configured lifetime in the
``lifetime_seconds`` column (architecture §9.1.2); expiry itself is enforced by
the stock ``DatabaseStrategy`` logic against ``created_at``.
"""

from fastapi import Depends
from fastapi.security import APIKeyCookie
from fastapi_users.authentication.strategy.db import AccessTokenDatabase, DatabaseStrategy
from fastapi_users.authentication.transport.cookie import CookieTransport

from backend.auth.db import get_access_token_db
from backend.config import secure_cookies, session_ttl_seconds

COOKIE_NAME = "session"


class CompanyHubDatabaseStrategy(DatabaseStrategy):
    """DatabaseStrategy that persists the session's configured lifetime."""

    def _create_access_token_dict(self, user):
        data = super()._create_access_token_dict(user)
        data["lifetime_seconds"] = self.lifetime_seconds
        return data


def get_cookie_transport() -> CookieTransport:
    """A CookieTransport configured for the current session lifetime.

    Built per request so the cookie ``Max-Age`` always matches the effective
    ``COMPANY_HUB_SESSION_TTL`` and the ``Secure`` flag honors
    ``COMPANY_HUB_SECURE_COOKIES`` (production; default off for dev http).
    """
    return CookieTransport(
        cookie_name=COOKIE_NAME,
        cookie_max_age=session_ttl_seconds(),
        cookie_path="/",
        cookie_domain=None,
        cookie_secure=secure_cookies(),
        cookie_httponly=True,
        cookie_samesite="lax",
    )


def get_database_strategy(
    access_token_db: AccessTokenDatabase = Depends(get_access_token_db),
) -> DatabaseStrategy:
    return CompanyHubDatabaseStrategy(
        access_token_db, lifetime_seconds=session_ttl_seconds()
    )


cookie_scheme = APIKeyCookie(name=COOKIE_NAME, auto_error=False)