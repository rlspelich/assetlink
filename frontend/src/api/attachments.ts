import { api } from './client';
import type { Attachment } from './types';

export interface AttachmentListResponse {
  attachments: Attachment[];
  total: number;
}

export async function listAttachments(
  entityType: string,
  entityId: string,
): Promise<AttachmentListResponse> {
  return api
    .get('attachments', { searchParams: { entity_type: entityType, entity_id: entityId } })
    .json();
}

export async function uploadAttachment(
  file: File,
  entityType: string,
  entityId: string,
  attachmentType: string = 'photo',
): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entity_type', entityType);
  formData.append('entity_id', entityId);
  formData.append('attachment_type', attachmentType);

  // Use fetch directly for FormData (ky can be tricky with multipart)
  const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
  const tenantId = import.meta.env.VITE_DEV_TENANT_ID || '';

  const response = await fetch(`${baseUrl}/attachments`, {
    method: 'POST',
    headers: {
      'X-Tenant-ID': tenantId,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Upload failed: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await api.delete(`attachments/${attachmentId}`);
}

/**
 * Get the display URL for an attachment.
 * For local dev, prefix with the API base URL.
 * For GCS, use the URL directly.
 */
export function getAttachmentUrl(attachment: Attachment): string {
  if (attachment.file_url.startsWith('/uploads/')) {
    // Local dev — serve through the backend
    return `${window.location.origin}/api/v1${attachment.file_url}`;
  }
  // GCS — direct URL
  return attachment.file_url;
}
