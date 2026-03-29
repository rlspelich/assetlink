import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Contract(Base, TimestampMixin):
    """One letting/contract from a transportation agency bid letting.

    Reference table — public DOT data, shared across all tenants.
    Access gated by modules_enabled on the tenant, not row-level ownership.
    """

    __tablename__ = "contract"
    __table_args__ = (
        UniqueConstraint("number", "agency", name="uq_contract_number_agency"),
    )

    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    letting_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    letting_type: Mapped[str] = mapped_column(String(20), default="", server_default="")
    agency: Mapped[str] = mapped_column(String(20), nullable=False, default="IDOT")
    county: Mapped[str] = mapped_column(String(30), default="", server_default="")
    district: Mapped[str] = mapped_column(String(3), default="", server_default="")
    municipality: Mapped[str] = mapped_column(String(50), default="", server_default="")
    section_no: Mapped[str] = mapped_column(String(50), default="", server_default="")
    job_no: Mapped[str] = mapped_column(String(50), default="", server_default="")
    project_no: Mapped[str] = mapped_column(String(50), default="", server_default="")
    letting_no: Mapped[str] = mapped_column(String(20), default="", server_default="")
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    source_file: Mapped[str] = mapped_column(String(255), default="", server_default="")

    # Relationships
    bids: Mapped[list["Bid"]] = relationship("Bid", back_populates="contract", cascade="all, delete-orphan")
