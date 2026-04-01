import { api, buildSearchParams } from './client';
import type { SignSupport, SignSupportCreate, SignSupportDetail, SignSupportListResponse } from './types';

export async function listSupports(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  support_type?: string;
}): Promise<SignSupportListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    support_type: params?.support_type,
  });
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
