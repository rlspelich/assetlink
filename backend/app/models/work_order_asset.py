import uuid

from sqlalchemy import String, Text, UniqueConstraint, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class WorkOrderAsset(Base, TenantMixin, TimestampMixin):
    """
    Junction table linking work orders to assets (signs, supports, etc.).

    Supports multi-asset work orders: one work order can reference multiple
    assets, each with per-asset metadata (damage notes, action required,
    resolution, status).

    The asset_type + asset_id pattern is polymorphic — no FK constraint
    on asset_id so it can point to sign, sign_support, or future asset types.
    """

    __tablename__ = "work_order_asset"

    __table_args__ = (
        UniqueConstraint(
            "work_order_id", "asset_type", "asset_id",
            name="uq_work_order_asset_wo_type_id",
        ),
        Index(
            "ix_work_order_asset_asset_lookup",
            "asset_type", "asset_id",
        ),
    )

    work_order_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_order.work_order_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "sign", "sign_support" — extensible for future asset types
    asset_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Polymorphic asset reference — no FK constraint
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    damage_notes: Mapped[str | None] = mapped_column(Text)
    # replace, reinstall, repair, remove, inspect
    action_required: Mapped[str | None] = mapped_column(String(30))
    resolution: Mapped[str | None] = mapped_column(String(200))
    # pending, in_progress, completed, skipped
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    # Relationships
    work_order = relationship("WorkOrder", back_populates="assets")
    tenant = relationship("Tenant")
