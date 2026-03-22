"""add inspection_number to inspection

Revision ID: d8e1f5a34b29
Revises: c7d9e4f23a18
Create Date: 2026-03-22 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e1f5a34b29'
down_revision: Union[str, None] = 'c7d9e4f23a18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inspection', sa.Column('inspection_number', sa.String(30), nullable=True))
    op.create_index('ix_inspection_inspection_number', 'inspection', ['inspection_number'])


def downgrade() -> None:
    op.drop_index('ix_inspection_inspection_number', table_name='inspection')
    op.drop_column('inspection', 'inspection_number')
