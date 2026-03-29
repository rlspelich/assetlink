"""Make bid tab tables reference (drop tenant_id from contract, contractor, bid, bid_item).

These tables contain public DOT data shared across all tenants.
Access is gated by modules_enabled on the tenant, not by row-level ownership.
This matches the pattern already used by award_item, pay_item, cost_index, etc.

Revision ID: i4f6g8h01a23
Revises: 5b03b21aca3b
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "i4f6g8h01a23"
down_revision = "5b03b21aca3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---- contract ----
    # Drop old unique constraint that includes tenant_id
    op.drop_constraint("uq_contract_number_agency", "contract", type_="unique")
    # Drop tenant_id index
    op.drop_index("ix_contract_tenant_id", table_name="contract")
    # Drop FK constraint on tenant_id
    op.drop_constraint("contract_tenant_id_fkey", "contract", type_="foreignkey")
    # Drop tenant_id column
    op.drop_column("contract", "tenant_id")
    # Create new unique constraint without tenant_id
    op.create_unique_constraint("uq_contract_number_agency", "contract", ["number", "agency"])

    # ---- contractor ----
    op.drop_constraint("uq_contractor_id_name", "contractor", type_="unique")
    op.drop_index("ix_contractor_tenant_id", table_name="contractor")
    op.drop_constraint("contractor_tenant_id_fkey", "contractor", type_="foreignkey")
    op.drop_column("contractor", "tenant_id")
    op.create_unique_constraint("uq_contractor_id_name", "contractor", ["contractor_id_code", "name"])

    # ---- bid ----
    op.drop_constraint("uq_bid_contract_contractor", "bid", type_="unique")
    op.drop_index("ix_bid_tenant_id", table_name="bid")
    op.drop_constraint("bid_tenant_id_fkey", "bid", type_="foreignkey")
    op.drop_column("bid", "tenant_id")
    op.create_unique_constraint("uq_bid_contract_contractor", "bid", ["contract_id", "contractor_pk"])

    # ---- bid_item ----
    op.drop_index("ix_bid_item_tenant_id", table_name="bid_item")
    op.drop_constraint("bid_item_tenant_id_fkey", "bid_item", type_="foreignkey")
    op.drop_column("bid_item", "tenant_id")


def downgrade() -> None:
    # ---- bid_item ----
    op.add_column("bid_item", sa.Column("tenant_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("bid_item_tenant_id_fkey", "bid_item", "tenant", ["tenant_id"], ["tenant_id"])
    op.create_index("ix_bid_item_tenant_id", "bid_item", ["tenant_id"])

    # ---- bid ----
    op.drop_constraint("uq_bid_contract_contractor", "bid", type_="unique")
    op.add_column("bid", sa.Column("tenant_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("bid_tenant_id_fkey", "bid", "tenant", ["tenant_id"], ["tenant_id"])
    op.create_index("ix_bid_tenant_id", "bid", ["tenant_id"])
    op.create_unique_constraint("uq_bid_contract_contractor", "bid", ["tenant_id", "contract_id", "contractor_pk"])

    # ---- contractor ----
    op.drop_constraint("uq_contractor_id_name", "contractor", type_="unique")
    op.add_column("contractor", sa.Column("tenant_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("contractor_tenant_id_fkey", "contractor", "tenant", ["tenant_id"], ["tenant_id"])
    op.create_index("ix_contractor_tenant_id", "contractor", ["tenant_id"])
    op.create_unique_constraint("uq_contractor_id_name", "contractor", ["tenant_id", "contractor_id_code", "name"])

    # ---- contract ----
    op.drop_constraint("uq_contract_number_agency", "contract", type_="unique")
    op.add_column("contract", sa.Column("tenant_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("contract_tenant_id_fkey", "contract", "tenant", ["tenant_id"], ["tenant_id"])
    op.create_index("ix_contract_tenant_id", "contract", ["tenant_id"])
    op.create_unique_constraint("uq_contract_number_agency", "contract", ["tenant_id", "number", "agency"])
