"""Sprint 03: role-based access — ``access_level`` replaces ``is_superuser``.

Adds the four-level ``access_level`` column (``guest`` / ``read-only`` /
``user`` / ``admin``) to ``users``, backfills it from the existing
``is_superuser`` boolean, forces the bootstrap admin to ``admin`` (defense in
depth), then drops ``is_superuser``.

SQLite DDL notes: SQLite cannot ``ADD CONSTRAINT`` after a table exists, so the
``CHECK`` is embedded in the ``ADD COLUMN`` definition (which SQLite permits),
and the column is added ``NOT NULL DEFAULT 'guest'`` so the ``ADD COLUMN`` is
valid. The real values are then backfilled with ``UPDATE`` statements, and
``is_superuser`` is dropped (SQLite 3.35+, supported by the shipped Python).
The ``DEFAULT 'guest'`` matches the ORM model default for new rows.

No dev-DB flush is required this sprint: ``access_level`` is a normal additive
migration over the Sprint 02 schema (``oauth_accounts`` already exists).

Revision ID: 0003_sprint03_roles
Revises: 0002_sprint02_auth_orm
Create Date: 2026-09-05
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_sprint03_roles"
down_revision = "0002_sprint02_auth_orm"
branch_labels = None
depends_on = None

ADMIN_EMAIL = "admin@localhost"


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "ALTER TABLE users ADD COLUMN access_level VARCHAR(20) NOT NULL "
            "DEFAULT 'guest' "
            "CHECK (access_level IN ('guest','read-only','user','admin'))"
        )
    )
    conn.execute(sa.text("UPDATE users SET access_level = 'admin' WHERE is_superuser = 1"))
    conn.execute(sa.text("UPDATE users SET access_level = 'user' WHERE is_superuser = 0"))
    conn.execute(
        sa.text("UPDATE users SET access_level = 'admin' WHERE email = :email"),
        {"email": ADMIN_EMAIL},
    )
    op.drop_column("users", "is_superuser")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_superuser", sa.Boolean(), server_default=sa.text("0"), nullable=False
        ),
    )
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE users SET is_superuser = 1 WHERE access_level = 'admin'")
    )
    # SQLite cannot drop a column constraint in place; rebuild is required.
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("ck_users_access_level", type_="check")
        batch_op.drop_column("access_level")