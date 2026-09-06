"""Access-level constants, ordering, and role-gate dependencies.

The four levels are ordered ``guest < read-only < user < admin``; ``admin`` is
the superuser tier. ``require_access(min_level)`` and ``get_current_admin`` are
the single place the ordering is defined and enforced (architecture §10.1.2).

Every data route keeps the session gate (``get_current_user``, ``401`` when
absent/invalid) via these dependencies, and on top of it returns ``403
{"detail": "Insufficient access level"}`` when the signed-in account's level is
below the route's minimum. Denials are always ``403`` (session preserved);
``401`` remains session-only.
"""

from fastapi import Depends, HTTPException, status

from backend.auth.dependencies import get_current_user
from backend.models.user import User

GUEST = "guest"
READ_ONLY = "read-only"
USER = "user"
ADMIN = "admin"

_LEVEL_ORDER = {GUEST: 0, READ_ONLY: 1, USER: 2, ADMIN: 3}

FORBIDDEN_DETAIL = "Insufficient access level"


def _rank(level: str | None) -> int:
    return _LEVEL_ORDER.get(level, -1)


def require_access(min_level: str):
    """Return a dependency that allows only accounts at ``min_level`` or above.

    A guest (below every data minimum) is rejected here, so guests have no data
    access at all.
    """

    async def dependency(user: User = Depends(get_current_user)) -> User:
        if _rank(user.access_level) < _rank(min_level):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=FORBIDDEN_DETAIL
            )
        return user

    return dependency


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Admin-only gate; ``admin`` is the superuser tier."""
    if _rank(user.access_level) < _rank(ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=FORBIDDEN_DETAIL
        )
    return user