"""add work_order_asset junction table

Revision ID: a3f7c2d91e04
Revises: e41c401e73bb
Create Date: 2026-03-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a3f7c2d91e04'
down_revision: Union[str, None] = 'e41c401e73bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the work_order_asset junction table
    op.create_table(
        'work_order_asset',
        sa.Column('work_order_asset_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('work_order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('work_order.work_order_id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('asset_type', sa.String(30), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('damage_notes', sa.Text(), nullable=True),
        sa.Column('action_required', sa.String(30), nullable=True),
        sa.Column('resolution', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.UniqueConstraint('work_order_id', 'asset_type', 'asset_id', name='uq_work_order_asset_wo_type_id'),
    )

    # Indexes
    op.create_index('ix_work_order_asset_tenant_id', 'work_order_asset', ['tenant_id'])
    op.create_index('ix_work_order_asset_work_order_id', 'work_order_asset', ['work_order_id'])
    op.create_index('ix_work_order_asset_asset_lookup', 'work_order_asset', ['asset_type', 'asset_id'])

    # Data migration: copy existing sign_id references to the junction table
    op.execute(
        """
        INSERT INTO work_order_asset (work_order_asset_id, work_order_id, tenant_id, asset_type, asset_id, status)
        SELECT
            gen_random_uuid(),
            work_order_id,
            tenant_id,
            'sign',
            sign_id,
            CASE
                WHEN status IN ('completed', 'cancelled', 'closed') THEN 'completed'
                WHEN status = 'in_progress' THEN 'in_progress'
                ELSE 'pending'
            END
        FROM work_order
        WHERE sign_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table('work_order_asset')
