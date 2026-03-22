"""add inspection_asset junction table

Revision ID: b5e8a3f12c07
Revises: a3f7c2d91e04
Create Date: 2026-03-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b5e8a3f12c07'
down_revision: Union[str, None] = 'a3f7c2d91e04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the inspection_asset junction table
    op.create_table(
        'inspection_asset',
        sa.Column('inspection_asset_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('inspection_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('inspection.inspection_id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenant.tenant_id'), nullable=False),
        sa.Column('asset_type', sa.String(30), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('condition_rating', sa.SmallInteger(), nullable=True),
        sa.Column('findings', sa.Text(), nullable=True),
        sa.Column('defects', postgresql.JSONB(), nullable=True),
        sa.Column('retroreflectivity_value', sa.Numeric(8, 2), nullable=True),
        sa.Column('passes_minimum_retro', sa.Boolean(), nullable=True),
        sa.Column('action_recommended', sa.String(30), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='inspected'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('app_user.user_id'), nullable=True),
        sa.UniqueConstraint('inspection_id', 'asset_type', 'asset_id', name='uq_inspection_asset_insp_type_id'),
        sa.CheckConstraint('condition_rating BETWEEN 1 AND 5', name='ck_inspection_asset_condition'),
    )

    # Indexes
    op.create_index('ix_inspection_asset_tenant_id', 'inspection_asset', ['tenant_id'])
    op.create_index('ix_inspection_asset_inspection_id', 'inspection_asset', ['inspection_id'])
    op.create_index('ix_inspection_asset_asset_lookup', 'inspection_asset', ['asset_type', 'asset_id'])

    # Data migration: copy existing sign_id references to the junction table
    op.execute(
        """
        INSERT INTO inspection_asset (inspection_asset_id, inspection_id, tenant_id, asset_type, asset_id,
            condition_rating, findings, retroreflectivity_value, passes_minimum_retro, status)
        SELECT
            gen_random_uuid(),
            inspection_id,
            tenant_id,
            'sign',
            sign_id,
            condition_rating,
            findings,
            retroreflectivity_value,
            passes_minimum_retro,
            'inspected'
        FROM inspection
        WHERE sign_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table('inspection_asset')
