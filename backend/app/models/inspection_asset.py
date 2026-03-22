import uuid

from sqlalchemy import String, Text, SmallInteger, Numeric, ForeignKey, UniqueConstraint, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class InspectionAsset(Base, TenantMixin, TimestampMixin):
    """
    Junction table linking inspections to assets (signs, supports, etc.).

    Supports multi-asset inspections: one inspection can cover a support
    and all its signs, each with per-asset condition data.

    The asset_type + asset_id pattern is polymorphic — no FK constraint
    on asset_id so it can point to sign, sign_support, or future asset types.
    """

    __tablename__ = "inspection_asset"

    __table_args__ = (
        UniqueConstraint(
            "inspection_id", "asset_type", "asset_id",
            name="uq_inspection_asset_insp_type_id",
        ),
        Index(
            "ix_inspection_asset_asset_lookup",
            "asset_type", "asset_id",
        ),
        CheckConstraint("condition_rating BETWEEN 1 AND 5", name="ck_inspection_asset_condition"),
    )

    inspection_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    inspection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inspection.inspection_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "sign", "sign_support" — extensible for future asset types
    asset_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Polymorphic asset reference — no FK constraint
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Per-asset condition rating (1-5)
    condition_rating: Mapped[int | None] = mapped_column(SmallInteger)
    # Per-asset findings
    findings: Mapped[str | None] = mapped_column(Text)
    # Structured defect list
    defects: Mapped[dict | None] = mapped_column(JSONB)
    # Retroreflectivity measurement (mcd/lux/m2) — sign-specific
    retroreflectivity_value: Mapped[float | None] = mapped_column(Numeric(8, 2))
    passes_minimum_retro: Mapped[bool | None] = mapped_column()
    # replace, repair, monitor, ok
    action_recommended: Mapped[str | None] = mapped_column(String(30))
    # inspected, needs_action, deferred, ok
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="inspected")

    # Relationships
    inspection = relationship("Inspection", back_populates="assets")
    tenant = relationship("Tenant")
