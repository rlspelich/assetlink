import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RegionalFactor(Base):
    """State-level construction cost multiplier. Reference table, not tenant-specific.

    Illinois = 1.0000 (baseline, since all historical data is IDOT).
    Other states are expressed as multipliers relative to Illinois.
    Based on RSMeans City Cost Index / FHWA Highway Construction Cost data.
    """

    __tablename__ = "regional_factor"

    regional_factor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    state_code: Mapped[str] = mapped_column(String(2), nullable=False, unique=True)
    state_name: Mapped[str] = mapped_column(String(50), nullable=False)
    factor: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="RSMeans", server_default="RSMeans")
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
