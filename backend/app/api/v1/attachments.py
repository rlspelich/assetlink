"""
Attachment endpoints — upload, list, get, delete photos/documents.

Attachments are polymorphic: they can be linked to any entity type
(sign, sign_support, work_order, inspection) via entity_type + entity_id.
"""

import uuid

from typing import Union

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.attachment import Attachment
from app.schemas.attachment import AttachmentListOut, AttachmentOut
from app.services.storage import get_storage_service

router = APIRouter(prefix="/attachments", tags=["attachments"])

# Max file size: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# Allowed content types
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
}

VALID_ENTITY_TYPES = {"sign", "sign_support", "work_order", "inspection"}


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: str = Form(...),
    attachment_type: str = Form("photo"),
    title: str = Form(None),
    description: str = Form(None),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AttachmentOut:
    """Upload a file and attach it to an entity."""
    # Validate entity type
    if entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type: {entity_type}. Must be one of: {', '.join(VALID_ENTITY_TYPES)}",
        )

    # Validate entity_id is a valid UUID
    try:
        parsed_entity_id = uuid.UUID(entity_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid entity_id format")

    # Validate content type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed: {content_type}. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    # Read file content
    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {file_size / (1024 * 1024):.1f} MB. Max: {MAX_FILE_SIZE / (1024 * 1024):.0f} MB",
        )

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Upload to storage
    storage = get_storage_service()
    file_url = await storage.upload(
        file_bytes=file_bytes,
        original_filename=file.filename or "upload",
        content_type=content_type,
        tenant_id=str(tenant_id),
        entity_type=entity_type,
        entity_id=entity_id,
    )

    # Create attachment record
    attachment = Attachment(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=parsed_entity_id,
        file_name=file.filename or "upload",
        file_url=file_url,
        file_size_bytes=file_size,
        content_type=content_type,
        attachment_type=attachment_type,
        title=title,
        description=description,
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)

    return AttachmentOut.model_validate(attachment)


@router.get("", response_model=AttachmentListOut)
async def list_attachments(
    entity_type: str | None = None,
    entity_id: str | None = None,
    attachment_type: str | None = None,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AttachmentListOut:
    """List attachments, optionally filtered by entity."""
    query = select(Attachment).where(Attachment.tenant_id == tenant_id)

    if entity_type:
        query = query.where(Attachment.entity_type == entity_type)
    if entity_id:
        try:
            query = query.where(Attachment.entity_id == uuid.UUID(entity_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid entity_id format")
    if attachment_type:
        query = query.where(Attachment.attachment_type == attachment_type)

    query = query.order_by(Attachment.uploaded_at.desc())

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    result = await db.execute(query)
    attachments = result.scalars().all()

    return AttachmentListOut(
        attachments=[AttachmentOut.model_validate(a) for a in attachments],
        total=total,
    )


@router.get("/{attachment_id}")
async def get_attachment(
    attachment_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Union[AttachmentOut, FileResponse]:
    """Get attachment metadata or serve the file (for local storage)."""
    result = await db.execute(
        select(Attachment).where(
            Attachment.attachment_id == attachment_id,
            Attachment.tenant_id == tenant_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # If local storage, serve the file directly
    if attachment.file_url.startswith("/uploads/"):
        storage = get_storage_service()
        file_path = await storage.get_file_path(attachment.file_url)
        if file_path and file_path.exists():
            return FileResponse(
                path=str(file_path),
                media_type=attachment.content_type or "application/octet-stream",
                filename=attachment.file_name,
            )
        raise HTTPException(status_code=404, detail="File not found on disk")

    # For GCS, return the metadata (frontend uses file_url directly)
    return AttachmentOut.model_validate(attachment)


@router.delete("/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an attachment and its file."""
    result = await db.execute(
        select(Attachment).where(
            Attachment.attachment_id == attachment_id,
            Attachment.tenant_id == tenant_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Delete from storage
    storage = get_storage_service()
    await storage.delete(attachment.file_url)

    # Delete record
    await db.delete(attachment)
