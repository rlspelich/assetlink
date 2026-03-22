import { api } from './client';
import type {
  WorkOrder,
  WorkOrderCreate,
  WorkOrderUpdate,
  WorkOrderListResponse,
  WorkOrderAsset,
  WorkOrderAssetUpdate,
} from './types';

export async function listWorkOrders(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  work_type?: string;
  assigned_to?: string;
  asset_type?: string;
}): Promise<WorkOrderListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.work_type) searchParams.set('work_type', params.work_type);
  if (params?.assigned_to) searchParams.set('assigned_to', params.assigned_to);
  if (params?.asset_type) searchParams.set('asset_type', params.asset_type);
  return api.get('work-orders', { searchParams }).json();
}

export async function getWorkOrder(id: string): Promise<WorkOrder> {
  return api.get(`work-orders/${id}`).json();
}

export async function createWorkOrder(data: WorkOrderCreate): Promise<WorkOrder> {
  return api.post('work-orders', { json: data }).json();
}

export async function updateWorkOrder(
  id: string,
  data: WorkOrderUpdate,
): Promise<WorkOrder> {
  return api.put(`work-orders/${id}`, { json: data }).json();
}

export async function deleteWorkOrder(id: string): Promise<void> {
  await api.delete(`work-orders/${id}`);
}

export async function updateWorkOrderAsset(
  woId: string,
  woaId: string,
  data: WorkOrderAssetUpdate,
): Promise<WorkOrderAsset> {
  return api.put(`work-orders/${woId}/assets/${woaId}`, { json: data }).json();
}

export async function listSignWorkOrders(
  signId: string,
  params?: { page?: number; page_size?: number },
): Promise<WorkOrderListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  return api.get(`signs/${signId}/work-orders`, { searchParams }).json();
}
