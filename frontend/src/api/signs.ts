import { api, buildSearchParams } from './client';
import type { Sign, SignCreate, SignListResponse, SignType, SignImportResult } from './types';

export async function listSigns(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  road_name?: string;
  mutcd_code?: string;
  sign_category?: string;
}): Promise<SignListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    road_name: params?.road_name,
    mutcd_code: params?.mutcd_code,
    sign_category: params?.sign_category,
  });
  return api.get('signs', { searchParams }).json();
}

export async function getSign(id: string): Promise<Sign> {
  return api.get(`signs/${id}`).json();
}

export async function createSign(data: SignCreate): Promise<Sign> {
  return api.post('signs', { json: data }).json();
}

export async function updateSign(id: string, data: Partial<SignCreate>): Promise<Sign> {
  return api.put(`signs/${id}`, { json: data }).json();
}

export async function deleteSign(id: string): Promise<void> {
  await api.delete(`signs/${id}`);
}

export async function listSignTypes(category?: string): Promise<SignType[]> {
  const searchParams = category ? { category } : undefined;
  return api.get('signs/types/all', { searchParams }).json();
}

export async function importSignsCsv(file: File): Promise<SignImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('signs/import/csv', { body: formData, timeout: 120_000 }).json();
}

export async function importSupportsCsv(file: File): Promise<SignImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('supports/import/csv', { body: formData, timeout: 120_000 }).json();
}

export async function importSignsAndSupportsCsv(signsFile: File, supportsFile: File): Promise<SignImportResult> {
  const formData = new FormData();
  formData.append('signs_file', signsFile);
  formData.append('supports_file', supportsFile);
  return api.post('import/signs-and-supports', { body: formData, timeout: 120_000 }).json();
}
