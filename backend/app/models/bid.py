import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Bid(Base, TimestampMixin):
    """One contractor's bid on one contract.

    Reference table — public DOT data, shared across all tenants.
    """

    __tablename__ = "bid"
    __table_args__ = (
        UniqueConstraint("contract_id", "contractor_pk", name="uq_bid_contract_contractor"),
    )

    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contract.contract_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contractor_pk: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contractor.contractor_pk", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rank: Mapped[int] = mapped_column(Integer, default=0)  # 1=low bid, 0=bad bid
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)  # calculated from items
    doc_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)  # from source document
    is_low: Mapped[bool] = mapped_column(Boolean, default=False)
    is_bad: Mapped[bool] = mapped_column(Boolean, default=False)  # has omitted items
    has_alt: Mapped[bool] = mapped_column(Boolean, default=False)
    no_omitted: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    contract: Mapped["Contract"] = relationship("Contract", back_populates="bids")
    contractor: Mapped["Contractor"] = relationship("Contractor", back_populates="bids")
    items: Mapped[list["BidItem"]] = relationship("BidItem", back_populates="bid", cascade="all, delete-orphan")


class BidItem(Base):
    """One line item within a bid.

    Reference table — public DOT data, shared across all tenants.
    """

    __tablename__ = "bid_item"

    bid_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bid.bid_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pay_item_code: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    abbreviation: Mapped[str] = mapped_column(String(50), default="", server_default="")
    unit: Mapped[str] = mapped_column(String(15), default="", server_default="")
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=0)
    was_omitted: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    bid: Mapped["Bid"] = relationship("Bid", back_populates="items")
