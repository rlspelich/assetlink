import { api } from './client';

export interface EmailRequest {
  to: string;
  cc?: string;
  message?: string;
}

export interface EmailResponse {
  status: string; // "sent" | "queued" | "preview"
  subject: string;
  preview_html: string | null;
}

export async function sendWorkOrderEmail(
  workOrderId: string,
  data: EmailRequest,
): Promise<EmailResponse> {
  return api.post(`email/work-order/${workOrderId}`, { json: data }).json<EmailResponse>();
}

export async function sendInspectionEmail(
  inspectionId: string,
  data: EmailRequest,
): Promise<EmailResponse> {
  return api.post(`email/inspection/${inspectionId}`, { json: data }).json<EmailResponse>();
}
