"""fastapi-users auth wiring for the Company Hub backend."""

from backend.auth.dependencies import get_current_user
from backend.auth.managers import bootstrap_admin
from backend.auth.routers import router

__all__ = [
    "bootstrap_admin",
    "get_current_user",
    "router",
]