"""Add project_type column to contract table.

Missing migration for project_type field that was added to the Contract
model but never migrated — causing 500 errors on all contract queries.

Revision ID: k6h8i0j23c45
Revises: j5g7h9i12b34
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = "k6h8i0j23c45"
down_revision = "j5g7h9i12b34"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "contract",
        sa.Column("project_type", sa.String(50), server_default="", nullable=False),
    )
    op.create_index("ix_contract_project_type", "contract", ["project_type"])


def downgrade() -> None:
    op.drop_index("ix_contract_project_type", table_name="contract")
    op.drop_column("contract", "project_type")
