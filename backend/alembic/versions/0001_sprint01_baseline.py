"""Sprint 01 schema baseline.

Reproduces the v0.1/Sprint 01 database schema verbatim (from the pre-Sprint-02
``backend/db.py``) so the migration history records exactly what existed before
the Sprint 02 changes. This is the initial baseline revision per architecture
§9.8 item 11; the Sprint 02 revision then alters it in place.

Revision ID: 0001_sprint01_baseline
Revises:
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_sprint01_baseline"
down_revision = None
branch_labels = None
depends_on = None


def _id() -> sa.Column:
    return sa.Column("id", sa.Integer(), autoincrement=True, nullable=False)


def upgrade() -> None:
    op.create_table(
        "industries",
        _id(),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "countries",
        _id(),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("name"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "users",
        _id(),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "sessions",
        _id(),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "companies",
        _id(),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("industry_id", sa.Integer(), nullable=True),
        sa.Column("website", sa.String(), nullable=True),
        sa.Column("contact_email", sa.String(), nullable=True),
        sa.Column("contact_phone", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["industry_id"], ["industries.id"]),
        sa.PrimaryKeyConstraint("id"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "locations",
        _id(),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("country_code", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.CheckConstraint(
            "type IN ('Headquarters','Office','Plant','Other')",
            name="ck_locations_type",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="cascade"),
        sa.ForeignKeyConstraint(["country_code"], ["countries.code"]),
        sa.PrimaryKeyConstraint("id"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "references",
        _id(),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("added_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "news_articles",
        _id(),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("published_at", sa.String(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("is_scraped", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sqlite_autoincrement=True,
    )
    op.create_table(
        "artifacts",
        _id(),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.String(), nullable=False),
        sa.Column("stored_filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sqlite_autoincrement=True,
    )

    op.create_index("idx_locations_company", "locations", ["company_id"])
    op.create_index(
        "idx_locations_one_hq",
        "locations",
        ["company_id"],
        unique=True,
        sqlite_where=sa.text("type = 'Headquarters'"),
    )
    op.create_index("idx_references_company", "references", ["company_id"])
    op.create_index("idx_news_company", "news_articles", ["company_id"])
    op.create_index("idx_artifacts_company", "artifacts", ["company_id"])
    op.create_index(
        "idx_artifacts_one_logo",
        "artifacts",
        ["company_id"],
        unique=True,
        sqlite_where=sa.text("source = 'logo'"),
    )


def downgrade() -> None:
    op.drop_index("idx_artifacts_one_logo", table_name="artifacts")
    op.drop_index("idx_artifacts_company", table_name="artifacts")
    op.drop_index("idx_news_company", table_name="news_articles")
    op.drop_index("idx_references_company", table_name="references")
    op.drop_index("idx_locations_one_hq", table_name="locations")
    op.drop_index("idx_locations_company", table_name="locations")
    op.drop_table("artifacts")
    op.drop_table("news_articles")
    op.drop_table("references")
    op.drop_table("locations")
    op.drop_table("companies")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("countries")
    op.drop_table("industries")