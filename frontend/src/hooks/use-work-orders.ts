import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as workOrdersApi from '../api/work-orders';
import type { WorkOrderCreate, WorkOrderUpdate, WorkOrderAssetUpdate } from '../api/types';

export const workOrderKeys = {
  all: ['work-orders'] as const,
  lists: () => [...workOrderKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...workOrderKeys.lists(), filters] as const,
  details: () => [...workOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...workOrderKeys.details(), id] as const,
  signWorkOrders: (signId: string) => [...workOrderKeys.all, 'sign', signId] as const,
};

export function useWorkOrdersList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  work_type?: string;
  assigned_to?: string;
  asset_type?: string;
}) {
  return useQuery({
    queryKey: workOrderKeys.list(filters ?? {}),
    queryFn: () => workOrdersApi.listWorkOrders(filters),
  });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: workOrderKeys.detail(id!),
    queryFn: () => workOrdersApi.getWorkOrder(id!),
    enabled: !!id,
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WorkOrderCreate) => workOrdersApi.createWorkOrder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workOrderKeys.lists() });
      // Also invalidate sign work orders since a new WO may be linked to a sign
      qc.invalidateQueries({ queryKey: [...workOrderKeys.all, 'sign'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create work order:', error.message);
    },
  });
}

export function useUpdateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkOrderUpdate }) =>
      workOrdersApi.updateWorkOrder(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: workOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: workOrderKeys.detail(variables.id) });
    },
    onError: (error: Error) => {
      console.error('Failed to update work order:', error.message);
    },
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workOrdersApi.deleteWorkOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: [...workOrderKeys.all, 'sign'] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete work order:', error.message);
    },
  });
}

export function useUpdateWorkOrderAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ woId, woaId, data }: { woId: string; woaId: string; data: WorkOrderAssetUpdate }) =>
      workOrdersApi.updateWorkOrderAsset(woId, woaId, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: workOrderKeys.detail(variables.woId) });
      qc.invalidateQueries({ queryKey: workOrderKeys.lists() });
    },
    onError: (error: Error) => {
      console.error('Failed to update work order asset:', error.message);
    },
  });
}

export function useSignWorkOrders(signId: string | undefined) {
  return useQuery({
    queryKey: workOrderKeys.signWorkOrders(signId!),
    queryFn: () => workOrdersApi.listSignWorkOrders(signId!, { page_size: 10 }),
    enabled: !!signId,
  });
}
