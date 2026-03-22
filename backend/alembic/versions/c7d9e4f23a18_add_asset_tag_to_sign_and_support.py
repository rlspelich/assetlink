"""add asset_tag to sign and sign_support

Revision ID: c7d9e4f23a18
Revises: b5e8a3f12c07
Create Date: 2026-03-22 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d9e4f23a18'
down_revision: Union[str, None] = 'b5e8a3f12c07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add asset_tag to sign table
    op.add_column('sign', sa.Column('asset_tag', sa.String(50), nullable=True))
    op.create_index('ix_sign_asset_tag', 'sign', ['asset_tag'])

    # Add asset_tag to sign_support table
    op.add_column('sign_support', sa.Column('asset_tag', sa.String(50), nullable=True))
    op.create_index('ix_sign_support_asset_tag', 'sign_support', ['asset_tag'])


def downgrade() -> None:
    op.drop_index('ix_sign_support_asset_tag', table_name='sign_support')
    op.drop_column('sign_support', 'asset_tag')
    op.drop_index('ix_sign_asset_tag', table_name='sign')
    op.drop_column('sign', 'asset_tag')
