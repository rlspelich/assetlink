import uuid
from datetime import datetime

from pydantic import BaseModel


class AttachmentOut(BaseModel):
    attachment_id: uuid.UUID
    tenant_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    file_name: str
    file_url: str
    file_size_bytes: int | None = None
    content_type: str | None = None
    attachment_type: str = "photo"
    title: str | None = None
    description: str | None = None
    uploaded_by: uuid.UUID | None = None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class AttachmentListOut(BaseModel):
    attachments: list[AttachmentOut]
    total: int
