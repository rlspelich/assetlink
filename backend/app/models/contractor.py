import uuid

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class Contractor(Base, TenantMixin, TimestampMixin):
    """Unique contractor who bids on contracts."""

    __tablename__ = "contractor"
    __table_args__ = (
        UniqueConstraint("tenant_id", "contractor_id_code", "name", name="uq_contractor_id_name"),
    )

    contractor_pk: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Agency-assigned contractor ID (e.g., 4-digit IDOT code)
    contractor_id_code: Mapped[str] = mapped_column(
        String(10), default="", server_default="", index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)

    # Relationships
    bids: Mapped[list["Bid"]] = relationship("Bid", back_populates="contractor")
