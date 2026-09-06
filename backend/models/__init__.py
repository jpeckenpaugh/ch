"""ORM model package.

Imports every model so ``Base.metadata`` is complete for Alembic and the
declarative registry can resolve the string-based relationship targets.
"""

from backend.db.base import Base
from backend.models.access_token import AccessToken
from backend.models.artifact import Artifact
from backend.models.company import Company, Location
from backend.models.country import Country
from backend.models.industry import Industry
from backend.models.news_article import NewsArticle
from backend.models.oauth_account import OAuthAccount
from backend.models.reference import Reference
from backend.models.user import User

__all__ = [
    "AccessToken",
    "Artifact",
    "Base",
    "Company",
    "Country",
    "Industry",
    "Location",
    "NewsArticle",
    "OAuthAccount",
    "Reference",
    "User",
]