import { api, buildSearchParams } from './client';
import type {
  Inspection,
  InspectionCreate,
  InspectionUpdate,
  InspectionListResponse,
  WorkOrder,
} from './types';

export async function listInspections(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  inspection_type?: string;
  follow_up_required?: boolean;
  inspector_id?: string;
}): Promise<InspectionListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
    status: params?.status,
    inspection_type: params?.inspection_type,
    follow_up_required: params?.follow_up_required,
    inspector_id: params?.inspector_id,
  });
  return api.get('inspections', { searchParams }).json();
}

export async function getInspection(id: string): Promise<Inspection> {
  return api.get(`inspections/${id}`).json();
}

export async function createInspection(data: InspectionCreate): Promise<Inspection> {
  return api.post('inspections', { json: data }).json();
}

export async function updateInspection(
  id: string,
  data: InspectionUpdate,
): Promise<Inspection> {
  return api.put(`inspections/${id}`, { json: data }).json();
}

export async function deleteInspection(id: string): Promise<void> {
  await api.delete(`inspections/${id}`);
}

export async function listSignInspections(
  signId: string,
  params?: { page?: number; page_size?: number },
): Promise<InspectionListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
  });
  return api.get(`signs/${signId}/inspections`, { searchParams }).json();
}

export async function listSupportInspections(
  supportId: string,
  params?: { page?: number; page_size?: number },
): Promise<InspectionListResponse> {
  const searchParams = buildSearchParams({
    page: params?.page,
    page_size: params?.page_size,
  });
  return api.get(`supports/${supportId}/inspections`, { searchParams }).json();
}

export async function createWorkOrderFromInspection(
  inspectionId: string,
): Promise<WorkOrder> {
  return api.post(`inspections/${inspectionId}/create-work-order`).json();
}
