"""add first_name, last_name, employee_id to app_user

Revision ID: e9f2a6b47c31
Revises: d8e1f5a34b29
Create Date: 2026-03-22 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9f2a6b47c31'
down_revision: Union[str, None] = 'd8e1f5a34b29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add first_name and last_name columns (nullable initially for data migration)
    op.add_column('app_user', sa.Column('first_name', sa.String(100), nullable=True))
    op.add_column('app_user', sa.Column('last_name', sa.String(100), nullable=True))
    op.add_column('app_user', sa.Column('employee_id', sa.String(50), nullable=True))

    # Migrate existing name data: split on first space
    op.execute("""
        UPDATE app_user
        SET first_name = CASE
                WHEN position(' ' in name) > 0 THEN substring(name from 1 for position(' ' in name) - 1)
                ELSE name
            END,
            last_name = CASE
                WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
                ELSE ''
            END
        WHERE name IS NOT NULL AND first_name IS NULL
    """)

    # Set defaults for any rows with NULL name
    op.execute("""
        UPDATE app_user
        SET first_name = 'Unknown', last_name = 'User'
        WHERE first_name IS NULL
    """)

    # Now make first_name and last_name NOT NULL
    op.alter_column('app_user', 'first_name', nullable=False)
    op.alter_column('app_user', 'last_name', nullable=False)

    # Make name nullable (backward compat — keep the column but stop requiring it)
    op.alter_column('app_user', 'name', nullable=True)

    # Update role values: field_worker -> crew_chief, viewer -> crew_chief
    op.execute("""
        UPDATE app_user SET role = 'crew_chief' WHERE role IN ('field_worker', 'viewer')
    """)

    # Unique constraint: (tenant_id, email)
    op.create_unique_constraint(
        'uq_app_user_tenant_email',
        'app_user',
        ['tenant_id', 'email'],
    )

    # Partial unique constraint: (tenant_id, employee_id) WHERE employee_id IS NOT NULL
    op.execute("""
        CREATE UNIQUE INDEX ix_app_user_tenant_employee_id
        ON app_user (tenant_id, employee_id)
        WHERE employee_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_app_user_tenant_employee_id")
    op.drop_constraint('uq_app_user_tenant_email', 'app_user', type_='unique')

    # Restore name from first_name + last_name
    op.execute("""
        UPDATE app_user SET name = first_name || ' ' || last_name
        WHERE name IS NULL
    """)
    op.alter_column('app_user', 'name', nullable=False)

    # Restore old role values
    op.execute("UPDATE app_user SET role = 'viewer' WHERE role = 'crew_chief'")

    op.drop_column('app_user', 'employee_id')
    op.drop_column('app_user', 'last_name')
    op.drop_column('app_user', 'first_name')
