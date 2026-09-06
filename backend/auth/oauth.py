"""Optional Google SSO flow: custom ``/authorize`` and ``/callback``.

This router is mounted only when Google OAuth credentials are configured
(``backend/auth/providers.py``). It implements the approved custom callback
(architecture §10.2.5, §10.8 item 10): the authorize endpoint issues a signed
state token and the OAuth CSRF cookie; the callback resolves the account via
``UserManager.oauth_callback`` (``associate_by_email=True``,
``is_verified_by_default=True``), establishes the **same cookie session as
email/password** (an ``access_tokens`` row + the HttpOnly ``session`` cookie,
same TTL), and ``302``-redirects to ``/``.

Account resolution (fastapi-users): an already-linked Google identity signs in;
otherwise a matching email links the identity and signs in; otherwise a new
guest account is auto-provisioned and signed in.

The OAuth CSRF cookie honors the 1-hour state-token lifetime; both the session
and CSRF cookies are ``Secure`` only when ``COMPANY_HUB_SECURE_COOKIES=1``.
"""

import secrets

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi_users import exceptions
from fastapi_users.authentication.strategy.db import DatabaseStrategy
from fastapi_users.authentication.transport.cookie import CookieTransport
from fastapi_users.manager import BaseUserManager
from fastapi_users.router.oauth import (
    CSRF_TOKEN_KEY,
    STATE_TOKEN_AUDIENCE,
    generate_csrf_token,
    generate_state_token,
)
from fastapi_users.jwt import decode_jwt
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from backend.auth.db import get_user_manager
from backend.auth.providers import google_oauth_client
from backend.auth.strategies import get_cookie_transport, get_database_strategy
from backend.config import google_sso_state_secret, secure_cookies

STATE_TOKEN_LIFETIME = 3600  # 1 hour, matching the CSRF cookie max-age
CSRF_COOKIE_NAME = "fastapiusersoauthcsrf"
REDIRECT_PATH = "/"


def _build_router(oauth_client):
    router = APIRouter(prefix="/auth", tags=["auth"])
    state_secret = google_sso_state_secret()
    callback_route_name = "oauth:google.callback"
    oauth2_authorize_callback = OAuth2AuthorizeCallback(
        oauth_client, route_name=callback_route_name
    )

    @router.get("/authorize")
    async def authorize(request: Request, response: Response):
        redirect_uri = str(request.url_for(callback_route_name))
        csrf_token = generate_csrf_token()
        state_data: dict[str, str] = {CSRF_TOKEN_KEY: csrf_token}
        state = generate_state_token(state_data, state_secret, STATE_TOKEN_LIFETIME)
        authorization_url = await oauth_client.get_authorization_url(redirect_uri, state)
        response.set_cookie(
            CSRF_COOKIE_NAME,
            csrf_token,
            max_age=STATE_TOKEN_LIFETIME,
            path="/",
            domain=None,
            secure=secure_cookies(),
            httponly=True,
            samesite="lax",
        )
        return {"authorization_url": authorization_url}

    @router.get("/callback", name=callback_route_name)
    async def callback(
        request: Request,
        access_token_state: tuple[OAuth2Token, str] = Depends(oauth2_authorize_callback),
        user_manager: BaseUserManager = Depends(get_user_manager),
        strategy: DatabaseStrategy = Depends(get_database_strategy),
        transport: CookieTransport = Depends(get_cookie_transport),
    ):
        token, state = access_token_state
        try:
            state_data = decode_jwt(state, state_secret, [STATE_TOKEN_AUDIENCE])
        except jwt.DecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="ACCESS_TOKEN_DECODE_ERROR"
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ACCESS_TOKEN_ALREADY_EXPIRED",
            )

        cookie_csrf = request.cookies.get(CSRF_COOKIE_NAME)
        state_csrf = state_data.get(CSRF_TOKEN_KEY)
        if (
            not cookie_csrf
            or not state_csrf
            or not secrets.compare_digest(cookie_csrf, state_csrf)
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="OAUTH_INVALID_STATE"
            )

        account_id, account_email = await oauth_client.get_id_email(token["access_token"])
        if account_email is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="OAUTH_NOT_AVAILABLE_EMAIL"
            )

        try:
            user = await user_manager.oauth_callback(
                oauth_client.name,
                token["access_token"],
                account_id,
                account_email,
                token.get("expires_at"),
                token.get("refresh_token"),
                request,
                associate_by_email=True,
                is_verified_by_default=True,
            )
        except exceptions.UserAlreadyExists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OAUTH_USER_ALREADY_EXISTS",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LOGIN_BAD_CREDENTIALS",
            )

        session_token = await strategy.write_token(user)
        response = RedirectResponse(url=REDIRECT_PATH, status_code=302)
        response.set_cookie(
            transport.cookie_name,
            session_token,
            max_age=transport.cookie_max_age,
            path=transport.cookie_path,
            domain=transport.cookie_domain,
            secure=transport.cookie_secure,
            httponly=transport.cookie_httponly,
            samesite=transport.cookie_samesite,
        )
        await user_manager.on_after_login(user, request, response)
        return response

    return router


def get_google_oauth_router():
    """The SSO router, or ``None`` when Google credentials are not configured."""
    client = google_oauth_client()
    if client is None:
        return None
    return _build_router(client)