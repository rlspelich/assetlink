"""Audit logging for sensitive operations."""
import logging
from uuid import UUID

logger = logging.getLogger("assetlink.audit")


def audit_log(
    action: str,
    entity_type: str,
    entity_id: UUID | str | None = None,
    tenant_id: UUID | str | None = None,
    user_id: str | None = None,
    details: str | None = None,
) -> None:
    """Log a sensitive operation for audit trail.

    Actions: delete, export, import, bulk_update, role_change
    """
    parts = [f"action={action}", f"entity={entity_type}"]
    if entity_id:
        parts.append(f"id={entity_id}")
    if tenant_id:
        parts.append(f"tenant={tenant_id}")
    if user_id:
        parts.append(f"user={user_id}")
    if details:
        parts.append(f"details={details}")
    logger.info(" | ".join(parts))
