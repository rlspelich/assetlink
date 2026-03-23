"""
File storage service — handles uploads to GCS (production) or local filesystem (dev).

Usage:
    storage = get_storage_service()
    url = await storage.upload(file_bytes, filename, content_type, tenant_id)
    await storage.delete(url)
"""

import os
import uuid
from datetime import datetime
from pathlib import Path

from app.config import settings


class LocalStorageService:
    """Local filesystem storage for development. Files saved under upload_dir."""

    def __init__(self, upload_dir: str):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def upload(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        tenant_id: str,
        entity_type: str = "",
        entity_id: str = "",
    ) -> str:
        """Save file locally, return a URL-like path."""
        # Organize: uploads/{tenant_id}/{entity_type}/{date}/{uuid}_{filename}
        date_str = datetime.now().strftime("%Y%m%d")
        file_id = uuid.uuid4().hex[:8]
        # Sanitize filename
        safe_name = "".join(
            c if c.isalnum() or c in (".", "-", "_") else "_"
            for c in original_filename
        )
        rel_path = f"{tenant_id}/{entity_type}/{date_str}/{file_id}_{safe_name}"
        full_path = self.upload_dir / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        full_path.write_bytes(file_bytes)

        # Return a path that the API can serve
        return f"/uploads/{rel_path}"

    async def delete(self, file_url: str) -> bool:
        """Delete a local file by its URL path."""
        if not file_url.startswith("/uploads/"):
            return False
        rel_path = file_url.replace("/uploads/", "", 1)
        full_path = self.upload_dir / rel_path
        if full_path.exists():
            full_path.unlink()
            return True
        return False

    async def get_file_path(self, file_url: str) -> Path | None:
        """Get the actual filesystem path for a local URL."""
        if not file_url.startswith("/uploads/"):
            return None
        rel_path = file_url.replace("/uploads/", "", 1)
        full_path = self.upload_dir / rel_path
        return full_path if full_path.exists() else None


class GCSStorageService:
    """Google Cloud Storage service for production."""

    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name
        self._client = None
        self._bucket = None

    def _get_bucket(self):
        if self._bucket is None:
            from google.cloud import storage
            self._client = storage.Client()
            self._bucket = self._client.bucket(self.bucket_name)
        return self._bucket

    async def upload(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        tenant_id: str,
        entity_type: str = "",
        entity_id: str = "",
    ) -> str:
        """Upload to GCS, return the public URL."""
        date_str = datetime.now().strftime("%Y%m%d")
        file_id = uuid.uuid4().hex[:8]
        safe_name = "".join(
            c if c.isalnum() or c in (".", "-", "_") else "_"
            for c in original_filename
        )
        blob_path = f"attachments/{tenant_id}/{entity_type}/{date_str}/{file_id}_{safe_name}"

        bucket = self._get_bucket()
        blob = bucket.blob(blob_path)
        blob.upload_from_string(file_bytes, content_type=content_type)

        return f"https://storage.googleapis.com/{self.bucket_name}/{blob_path}"

    async def delete(self, file_url: str) -> bool:
        """Delete from GCS by URL."""
        prefix = f"https://storage.googleapis.com/{self.bucket_name}/"
        if not file_url.startswith(prefix):
            return False
        blob_path = file_url.replace(prefix, "", 1)
        bucket = self._get_bucket()
        blob = bucket.blob(blob_path)
        if blob.exists():
            blob.delete()
            return True
        return False

    async def get_file_path(self, file_url: str) -> None:
        """GCS doesn't have local paths — return None."""
        return None


def get_storage_service() -> LocalStorageService | GCSStorageService:
    """Factory: returns GCS if bucket is configured, local otherwise."""
    if settings.gcs_bucket:
        return GCSStorageService(settings.gcs_bucket)
    return LocalStorageService(settings.upload_dir)
