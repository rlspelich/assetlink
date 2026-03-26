"""make work_order_number and inspection_number unique per tenant

Revision ID: f1a3b5c79d42
Revises: e9f2a6b47c31
Create Date: 2026-03-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f1a3b5c79d42'
down_revision: Union[str, None] = 'e9f2a6b47c31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- work_order_number: drop global unique index, add per-tenant unique constraint ---
    op.drop_index('ix_work_order_work_order_number', table_name='work_order')
    op.create_unique_constraint(
        'uq_work_order_number_tenant',
        'work_order',
        ['work_order_number', 'tenant_id'],
    )
    # Re-create a plain (non-unique) index for query performance
    op.create_index('ix_work_order_work_order_number', 'work_order', ['work_order_number'])

    # --- inspection_number: drop plain index, add per-tenant unique constraint ---
    op.drop_index('ix_inspection_inspection_number', table_name='inspection')
    op.create_unique_constraint(
        'uq_inspection_number_tenant',
        'inspection',
        ['inspection_number', 'tenant_id'],
    )
    # Re-create a plain index for query performance
    op.create_index('ix_inspection_inspection_number', 'inspection', ['inspection_number'])


def downgrade() -> None:
    # --- inspection_number: restore plain index, drop per-tenant unique ---
    op.drop_index('ix_inspection_inspection_number', table_name='inspection')
    op.drop_constraint('uq_inspection_number_tenant', 'inspection', type_='unique')
    op.create_index('ix_inspection_inspection_number', 'inspection', ['inspection_number'])

    # --- work_order_number: restore global unique index, drop per-tenant unique ---
    op.drop_index('ix_work_order_work_order_number', table_name='work_order')
    op.drop_constraint('uq_work_order_number_tenant', 'work_order', type_='unique')
    op.create_index('ix_work_order_work_order_number', 'work_order', ['work_order_number'], unique=True)
