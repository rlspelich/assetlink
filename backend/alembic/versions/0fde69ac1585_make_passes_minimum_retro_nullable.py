"""make passes_minimum_retro nullable

Revision ID: 0fde69ac1585
Revises: 6a817a5cd8ef
Create Date: 2026-03-21 23:22:45.093504

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '0fde69ac1585'
down_revision: Union[str, None] = '6a817a5cd8ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('inspection', 'passes_minimum_retro',
                    existing_type=sa.Boolean(),
                    nullable=True)


def downgrade() -> None:
    op.alter_column('inspection', 'passes_minimum_retro',
                    existing_type=sa.Boolean(),
                    nullable=False)
