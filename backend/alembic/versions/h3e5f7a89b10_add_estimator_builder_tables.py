"""add estimator builder tables (estimate, estimate_item, regional_factor)

Revision ID: h3e5f7a89b10
Revises: g2b4c6d80e53
Create Date: 2026-03-27 20:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'h3e5f7a89b10'
down_revision: Union[str, None] = 'g2b4c6d80e53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- regional_factor (reference table, no tenant_id) ---
    op.create_table(
        'regional_factor',
        sa.Column('regional_factor_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('state_code', sa.String(2), nullable=False, unique=True),
        sa.Column('state_name', sa.String(50), nullable=False),
        sa.Column('factor', sa.Numeric(6, 4), nullable=False),
        sa.Column('source', sa.String(50), server_default='RSMeans'),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- estimate (tenant-scoped) ---
    op.create_table(
        'estimate',
        sa.Column('estimate_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('target_state', sa.String(2), server_default='IL'),
        sa.Column('target_district', sa.String(10), server_default=''),
        sa.Column('use_inflation_adjustment', sa.Boolean(), server_default='true'),
        sa.Column('target_year', sa.Integer(), nullable=True),
        sa.Column('total_nominal', sa.Numeric(15, 2), server_default='0'),
        sa.Column('total_adjusted', sa.Numeric(15, 2), server_default='0'),
        sa.Column('total_with_regional', sa.Numeric(15, 2), server_default='0'),
        sa.Column('confidence_low', sa.Numeric(15, 2), nullable=True),
        sa.Column('confidence_high', sa.Numeric(15, 2), nullable=True),
        sa.Column('item_count', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
    )
    op.create_index('ix_estimate_tenant_id', 'estimate', ['tenant_id'])

    # --- estimate_item (tenant-scoped) ---
    op.create_table(
        'estimate_item',
        sa.Column('estimate_item_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('estimate_id', UUID(as_uuid=True), sa.ForeignKey('estimate.estimate_id', ondelete='CASCADE'), nullable=False),
        sa.Column('pay_item_code', sa.String(20), nullable=False),
        sa.Column('description', sa.String(150), server_default=''),
        sa.Column('unit', sa.String(15), server_default=''),
        sa.Column('quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 4), server_default='0'),
        sa.Column('unit_price_source', sa.String(20), server_default='computed'),
        sa.Column('adjusted_unit_price', sa.Numeric(12, 4), nullable=True),
        sa.Column('regional_unit_price', sa.Numeric(12, 4), nullable=True),
        sa.Column('extension', sa.Numeric(15, 2), server_default='0'),
        sa.Column('confidence_pct', sa.Integer(), nullable=True),
        sa.Column('confidence_label', sa.String(20), nullable=True),
        sa.Column('price_p25', sa.Numeric(12, 4), nullable=True),
        sa.Column('price_p50', sa.Numeric(12, 4), nullable=True),
        sa.Column('price_p75', sa.Numeric(12, 4), nullable=True),
        sa.Column('price_count', sa.Integer(), server_default='0'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
    )
    op.create_index('ix_estimate_item_tenant_id', 'estimate_item', ['tenant_id'])
    op.create_index('ix_estimate_item_estimate_id', 'estimate_item', ['estimate_id'])
    op.create_index('ix_estimate_item_pay_item_code', 'estimate_item', ['pay_item_code'])

    # Add composite index on award_item for pricing engine performance
    op.create_index('ix_award_item_code_date', 'award_item', ['pay_item_code', 'letting_date'])


def downgrade() -> None:
    op.drop_index('ix_award_item_code_date', table_name='award_item')
    op.drop_table('estimate_item')
    op.drop_table('estimate')
    op.drop_table('regional_factor')
