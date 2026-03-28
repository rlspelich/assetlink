import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class Estimate(Base, TenantMixin, TimestampMixin):
    """A contractor's saved estimate/project. Contains line items with auto-priced unit costs."""

    __tablename__ = "estimate"

    estimate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    # draft, final, archived
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")
    # Target state for regional adjustment (IL = baseline)
    target_state: Mapped[str] = mapped_column(String(2), default="IL", server_default="IL")
    # IDOT district for regional weighting within Illinois
    target_district: Mapped[str] = mapped_column(String(10), default="", server_default="")
    # Inflation adjustment settings
    use_inflation_adjustment: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    target_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Computed totals
    total_nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, server_default="0")
    total_adjusted: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, server_default="0")
    total_with_regional: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, server_default="0")
    confidence_low: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    confidence_high: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    item_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Relationships
    items: Mapped[list["EstimateItem"]] = relationship(
        "EstimateItem", back_populates="estimate", cascade="all, delete-orphan",
        order_by="EstimateItem.sort_order",
    )


class EstimateItem(Base, TenantMixin):
    """One line item within an estimate. Prices auto-filled from historical data."""

    __tablename__ = "estimate_item"

    estimate_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    estimate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("estimate.estimate_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pay_item_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(150), default="", server_default="")
    unit: Mapped[str] = mapped_column(String(15), default="", server_default="")
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    # Auto-filled unit price (user can override)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=0, server_default="0")
    # computed, manual, award_avg
    unit_price_source: Mapped[str] = mapped_column(String(20), default="computed", server_default="computed")
    # Inflation-adjusted price
    adjusted_unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    # Adjusted * regional factor
    regional_unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    # quantity * final price
    extension: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0, server_default="0")
    # Confidence scoring
    confidence_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # very_low, low, fair, high, very_high
    confidence_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Historical price distribution
    price_p25: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    price_p50: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    price_p75: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    price_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Relationships
    estimate: Mapped["Estimate"] = relationship("Estimate", back_populates="items")
