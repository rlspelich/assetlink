"""Add performance indexes for contractor intelligence queries.

Optimizes the 4.1M-row bid_item table and supporting tables for
contractor profile, head-to-head, and job analysis queries.

Revision ID: j5g7h9i12b34
Revises: i4f6g8h01a23
Create Date: 2026-03-30
"""
from alembic import op

revision = "j5g7h9i12b34"
down_revision = "i4f6g8h01a23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index for contractor bid lookups (profile, history, head-to-head)
    op.create_index("ix_bid_contractor_contract", "bid", ["contractor_pk", "contract_id"])

    # Composite index for bid item aggregation by pay item within a bid
    op.create_index("ix_bid_item_bid_pay_item", "bid_item", ["bid_id", "pay_item_code"])

    # Geographic filtering
    op.create_index("ix_contract_county", "contract", ["county"])
    op.create_index("ix_contract_district", "contract", ["district"])

    # Partial index for valid prices — most price queries filter these conditions
    op.execute(
        "CREATE INDEX ix_bid_item_valid_prices ON bid_item (pay_item_code, unit_price) "
        "WHERE was_omitted = false AND unit_price > 0"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bid_item_valid_prices")
    op.drop_index("ix_contract_district", table_name="contract")
    op.drop_index("ix_contract_county", table_name="contract")
    op.drop_index("ix_bid_item_bid_pay_item", table_name="bid_item")
    op.drop_index("ix_bid_contractor_contract", table_name="bid")
