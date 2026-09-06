"""Sprint 02: fastapi-users auth + async SQLAlchemy schema changes.

Applies the Sprint 02 deltas over the Sprint 01 baseline:

- ``users``: adds ``is_active`` / ``is_superuser`` / ``is_verified`` (INTEGER
  NOT NULL, defaulting to 1/0/0); ``password_hash`` stays TEXT NOT NULL and now
  holds a ``pwdlib``-generated hash.
- ``sessions``: dropped — replaced by the stateful ``access_tokens`` store.
- ``access_tokens``: new (id, token, user_id, created_at, lifetime_seconds).
- ``oauth_accounts``: new, schema-only (no OAuth routes this sprint), with the
  two uniqueness constraints.

Per architecture §9.1, the dev database is flushed once (scope item n) and
these revisions run fresh in sequence on an empty database.

Revision ID: 0002_sprint02_auth_orm
Revises: 0001_sprint01_baseline
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_sprint02_auth_orm"
down_revision = "0001_sprint01_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("is_superuser", sa.Boolean(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), server_default=sa.text("0"), nullable=False),
    )

    op.drop_table("sessions")

    op.create_table(
        "access_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lifetime_seconds", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
        sqlite_autoincrement=True,
    )

    op.create_table(
        "oauth_accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("oauth_name", sa.String(length=100), nullable=False),
        sa.Column("access_token", sa.String(), nullable=True),
        sa.Column("refresh_token", sa.String(), nullable=True),
        sa.Column("expires_at", sa.Integer(), nullable=True),
        sa.Column("account_id", sa.String(), nullable=False),
        sa.Column("account_email", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "oauth_name", name="uq_oauth_accounts_user_provider"
        ),
        sa.UniqueConstraint(
            "oauth_name", "account_id", name="uq_oauth_accounts_provider_account"
        ),
        sqlite_autoincrement=True,
    )


def downgrade() -> None:
    op.drop_table("oauth_accounts")
    op.drop_table("access_tokens")

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="cascade"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
        sqlite_autoincrement=True,
    )

    op.drop_column("users", "is_verified")
    op.drop_column("users", "is_superuser")
    op.drop_column("users", "is_active")