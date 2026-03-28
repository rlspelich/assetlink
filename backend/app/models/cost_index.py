import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CostIndex(Base):
    """Inflation index values from FHWA NHCCI and BLS PPI. Reference data, not tenant-specific."""

    __tablename__ = "cost_index"
    __table_args__ = (
        UniqueConstraint("source", "year", "quarter", name="uq_cost_index_source_year_quarter"),
    )

    cost_index_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # nhcci, ppi_highway, ppi_asphalt, ppi_concrete, ppi_steel, ppi_machinery
    source: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-4 or null for annual
    value: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    base_year: Mapped[int] = mapped_column(Integer, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CostIndexMapping(Base):
    """Maps pay item divisions/categories to the appropriate cost index source. Reference data."""

    __tablename__ = "cost_index_mapping"
    __table_args__ = (
        UniqueConstraint(
            "pay_item_division", "pay_item_category",
            name="uq_cost_index_mapping_division_category",
        ),
    )

    cost_index_mapping_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pay_item_division: Mapped[str] = mapped_column(String(100), nullable=False)
    pay_item_category: Mapped[str] = mapped_column(String(100), default="", server_default="")
    # Which CostIndex.source to use for this division/category
    index_source: Mapped[str] = mapped_column(String(20), nullable=False)
