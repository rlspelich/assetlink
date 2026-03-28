from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PayItem(Base):
    """Master pay item catalog. Reference data seeded from agency standards, not tenant-specific."""

    __tablename__ = "pay_item"
    __table_args__ = (
        UniqueConstraint("agency", "code", name="uq_pay_item_agency_code"),
    )

    # Composite natural key — no UUID needed for reference table
    agency: Mapped[str] = mapped_column(String(20), primary_key=True, default="IDOT")
    code: Mapped[str] = mapped_column(String(20), primary_key=True, index=True)

    description: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    abbreviation: Mapped[str] = mapped_column(String(50), default="", server_default="")
    unit: Mapped[str] = mapped_column(String(15), default="", server_default="")
    division: Mapped[str] = mapped_column(String(100), default="", server_default="", index=True)
    category: Mapped[str] = mapped_column(String(100), default="", server_default="", index=True)
    subcategory: Mapped[str] = mapped_column(String(150), default="", server_default="")
    is_metric: Mapped[bool] = mapped_column(Boolean, default=False)
    is_temporary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_special: Mapped[bool] = mapped_column(Boolean, default=False)
