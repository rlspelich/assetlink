"""add estimator module tables (contract, contractor, bid, bid_item, award_item, pay_item, cost_index)

Revision ID: g2b4c6d80e53
Revises: f1a3b5c79d42
Create Date: 2026-03-27 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'g2b4c6d80e53'
down_revision: Union[str, None] = 'f1a3b5c79d42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- pay_item (reference table, no tenant_id) ---
    op.create_table(
        'pay_item',
        sa.Column('agency', sa.String(20), primary_key=True, server_default='IDOT'),
        sa.Column('code', sa.String(20), primary_key=True),
        sa.Column('description', sa.String(150), nullable=False),
        sa.Column('abbreviation', sa.String(50), server_default=''),
        sa.Column('unit', sa.String(15), server_default=''),
        sa.Column('division', sa.String(100), server_default=''),
        sa.Column('category', sa.String(100), server_default=''),
        sa.Column('subcategory', sa.String(150), server_default=''),
        sa.Column('is_metric', sa.Boolean(), server_default='false'),
        sa.Column('is_temporary', sa.Boolean(), server_default='false'),
        sa.Column('is_special', sa.Boolean(), server_default='false'),
        sa.UniqueConstraint('agency', 'code', name='uq_pay_item_agency_code'),
    )
    op.create_index('ix_pay_item_code', 'pay_item', ['code'])
    op.create_index('ix_pay_item_description', 'pay_item', ['description'])
    op.create_index('ix_pay_item_division', 'pay_item', ['division'])
    op.create_index('ix_pay_item_category', 'pay_item', ['category'])

    # --- cost_index (reference table, no tenant_id) ---
    op.create_table(
        'cost_index',
        sa.Column('cost_index_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('quarter', sa.Integer(), nullable=True),
        sa.Column('value', sa.Numeric(10, 4), nullable=False),
        sa.Column('base_year', sa.Integer(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('source', 'year', 'quarter', name='uq_cost_index_source_year_quarter'),
    )
    op.create_index('ix_cost_index_source', 'cost_index', ['source'])

    # --- cost_index_mapping (reference table, no tenant_id) ---
    op.create_table(
        'cost_index_mapping',
        sa.Column('cost_index_mapping_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('pay_item_division', sa.String(100), nullable=False),
        sa.Column('pay_item_category', sa.String(100), server_default=''),
        sa.Column('index_source', sa.String(20), nullable=False),
        sa.UniqueConstraint('pay_item_division', 'pay_item_category', name='uq_cost_index_mapping_division_category'),
    )

    # --- contract (tenant-scoped) ---
    op.create_table(
        'contract',
        sa.Column('contract_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('number', sa.String(20), nullable=False),
        sa.Column('letting_date', sa.Date(), nullable=False),
        sa.Column('letting_type', sa.String(20), server_default=''),
        sa.Column('agency', sa.String(20), nullable=False, server_default='IDOT'),
        sa.Column('county', sa.String(30), server_default=''),
        sa.Column('district', sa.String(3), server_default=''),
        sa.Column('municipality', sa.String(50), server_default=''),
        sa.Column('section_no', sa.String(50), server_default=''),
        sa.Column('job_no', sa.String(50), server_default=''),
        sa.Column('project_no', sa.String(50), server_default=''),
        sa.Column('letting_no', sa.String(20), server_default=''),
        sa.Column('item_count', sa.Integer(), server_default='0'),
        sa.Column('source_file', sa.String(255), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.UniqueConstraint('tenant_id', 'number', 'agency', name='uq_contract_number_agency'),
    )
    op.create_index('ix_contract_tenant_id', 'contract', ['tenant_id'])
    op.create_index('ix_contract_number', 'contract', ['number'])
    op.create_index('ix_contract_letting_date', 'contract', ['letting_date'])

    # --- contractor (tenant-scoped) ---
    op.create_table(
        'contractor',
        sa.Column('contractor_pk', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('contractor_id_code', sa.String(10), server_default=''),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.UniqueConstraint('tenant_id', 'contractor_id_code', 'name', name='uq_contractor_id_name'),
    )
    op.create_index('ix_contractor_tenant_id', 'contractor', ['tenant_id'])
    op.create_index('ix_contractor_id_code', 'contractor', ['contractor_id_code'])
    op.create_index('ix_contractor_name', 'contractor', ['name'])

    # --- bid (tenant-scoped) ---
    op.create_table(
        'bid',
        sa.Column('bid_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('contract_id', UUID(as_uuid=True), sa.ForeignKey('contract.contract_id', ondelete='CASCADE'), nullable=False),
        sa.Column('contractor_pk', UUID(as_uuid=True), sa.ForeignKey('contractor.contractor_pk', ondelete='CASCADE'), nullable=False),
        sa.Column('rank', sa.Integer(), server_default='0'),
        sa.Column('total', sa.Numeric(15, 2), server_default='0'),
        sa.Column('doc_total', sa.Numeric(15, 2), server_default='0'),
        sa.Column('is_low', sa.Boolean(), server_default='false'),
        sa.Column('is_bad', sa.Boolean(), server_default='false'),
        sa.Column('has_alt', sa.Boolean(), server_default='false'),
        sa.Column('no_omitted', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.UniqueConstraint('tenant_id', 'contract_id', 'contractor_pk', name='uq_bid_contract_contractor'),
    )
    op.create_index('ix_bid_tenant_id', 'bid', ['tenant_id'])
    op.create_index('ix_bid_contract_id', 'bid', ['contract_id'])
    op.create_index('ix_bid_contractor_pk', 'bid', ['contractor_pk'])

    # --- bid_item (tenant-scoped) ---
    op.create_table(
        'bid_item',
        sa.Column('bid_item_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('bid_id', UUID(as_uuid=True), sa.ForeignKey('bid.bid_id', ondelete='CASCADE'), nullable=False),
        sa.Column('pay_item_code', sa.String(20), nullable=False),
        sa.Column('abbreviation', sa.String(50), server_default=''),
        sa.Column('unit', sa.String(15), server_default=''),
        sa.Column('quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 4), server_default='0'),
        sa.Column('was_omitted', sa.Boolean(), server_default='false'),
    )
    op.create_index('ix_bid_item_tenant_id', 'bid_item', ['tenant_id'])
    op.create_index('ix_bid_item_bid_id', 'bid_item', ['bid_id'])
    op.create_index('ix_bid_item_pay_item_code', 'bid_item', ['pay_item_code'])

    # --- award_item (reference table, no tenant_id — shared public IDOT data) ---
    op.create_table(
        'award_item',
        sa.Column('award_item_id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('letting_date', sa.Date(), nullable=False),
        sa.Column('pay_item_code', sa.String(20), nullable=False),
        sa.Column('abbreviation', sa.String(150), server_default=''),
        sa.Column('item_number', sa.String(20), server_default=''),
        sa.Column('unit', sa.String(15), server_default=''),
        sa.Column('quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), server_default='0'),
        sa.Column('contract_number', sa.String(20), nullable=False),
        sa.Column('county', sa.String(50), server_default=''),
        sa.Column('district', sa.String(10), server_default=''),
        sa.Column('source_file', sa.String(255), server_default=''),
    )
    op.create_index('ix_award_item_letting_date', 'award_item', ['letting_date'])
    op.create_index('ix_award_item_pay_item_code', 'award_item', ['pay_item_code'])
    op.create_index('ix_award_item_contract_number', 'award_item', ['contract_number'])


def downgrade() -> None:
    op.drop_table('award_item')
    op.drop_table('bid_item')
    op.drop_table('bid')
    op.drop_table('contractor')
    op.drop_table('contract')
    op.drop_table('cost_index_mapping')
    op.drop_table('cost_index')
    op.drop_table('pay_item')
