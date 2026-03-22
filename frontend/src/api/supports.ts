import { api } from './client';
import type { SignSupport, SignSupportCreate, SignSupportDetail, SignSupportListResponse } from './types';

export async function listSupports(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  support_type?: string;
}): Promise<SignSupportListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.support_type) searchParams.set('support_type', params.support_type);
  return api.get('supports', { searchParams }).json();
}

export async function getSupport(id: string): Promise<SignSupportDetail> {
  return api.get(`supports/${id}`).json();
}

export async function createSupport(data: SignSupportCreate): Promise<SignSupport> {
  return api.post('supports', { json: data }).json();
}

export async function updateSupport(id: string, data: Partial<SignSupportCreate>): Promise<SignSupport> {
  return api.put(`supports/${id}`, { json: data }).json();
}

export async function deleteSupport(id: string): Promise<void> {
  await api.delete(`supports/${id}`);
}
