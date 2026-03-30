import uuid
from datetime import date

from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Contractor(Base, TimestampMixin):
    """Unique contractor who bids on contracts.

    Reference table — public DOT data, shared across all tenants.
    """

    __tablename__ = "contractor"
    __table_args__ = (
        UniqueConstraint("contractor_id_code", "name", name="uq_contractor_id_name"),
    )

    contractor_pk: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Agency-assigned contractor ID (e.g., 4-digit IDOT code)
    contractor_id_code: Mapped[str] = mapped_column(
        String(10), default="", server_default="", index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="unknown", server_default="unknown")
    first_bid_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_bid_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_bids: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Relationships
    bids: Mapped[list["Bid"]] = relationship("Bid", back_populates="contractor")
