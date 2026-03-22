import { api } from './client';
import type { Sign, SignCreate, SignListResponse, SignType, SignImportResult } from './types';

export async function listSigns(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  road_name?: string;
  mutcd_code?: string;
  sign_category?: string;
}): Promise<SignListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.road_name) searchParams.set('road_name', params.road_name);
  if (params?.mutcd_code) searchParams.set('mutcd_code', params.mutcd_code);
  if (params?.sign_category) searchParams.set('sign_category', params.sign_category);
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
  return api.post('signs/import/csv', { body: formData }).json();
}
