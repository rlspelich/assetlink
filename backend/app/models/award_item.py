import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AwardItem(Base):
    """IDOT awarded price data. Reference table — shared across all tenants.

    Public data scraped from the IDOT Transportation Bulletin. Subscribers
    access this through the Estimator module (modules_enabled check).
    Not tenant-scoped because the data is identical for everyone.
    """

    __tablename__ = "award_item"

    award_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    letting_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    pay_item_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    abbreviation: Mapped[str] = mapped_column(String(150), default="", server_default="")
    item_number: Mapped[str] = mapped_column(String(20), default="", server_default="")
    unit: Mapped[str] = mapped_column(String(15), default="", server_default="")
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    contract_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    county: Mapped[str] = mapped_column(String(50), default="", server_default="")
    district: Mapped[str] = mapped_column(String(10), default="", server_default="")
    source_file: Mapped[str] = mapped_column(String(255), default="", server_default="")
