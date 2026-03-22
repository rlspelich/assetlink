import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as inspectionsApi from '../api/inspections';
import type { InspectionCreate, InspectionUpdate } from '../api/types';
import { workOrderKeys } from './use-work-orders';

export const inspectionKeys = {
  all: ['inspections'] as const,
  lists: () => [...inspectionKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...inspectionKeys.lists(), filters] as const,
  details: () => [...inspectionKeys.all, 'detail'] as const,
  detail: (id: string) => [...inspectionKeys.details(), id] as const,
  signInspections: (signId: string) => [...inspectionKeys.all, 'sign', signId] as const,
  supportInspections: (supportId: string) => [...inspectionKeys.all, 'support', supportId] as const,
};

export function useInspectionsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  inspection_type?: string;
  follow_up_required?: boolean;
}) {
  return useQuery({
    queryKey: inspectionKeys.list(filters ?? {}),
    queryFn: () => inspectionsApi.listInspections(filters),
  });
}

export function useInspection(id: string | undefined) {
  return useQuery({
    queryKey: inspectionKeys.detail(id!),
    queryFn: () => inspectionsApi.getInspection(id!),
    enabled: !!id,
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InspectionCreate) => inspectionsApi.createInspection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inspectionKeys.lists() });
      qc.invalidateQueries({ queryKey: [...inspectionKeys.all, 'sign'] });
      qc.invalidateQueries({ queryKey: [...inspectionKeys.all, 'support'] });
    },
  });
}

export function useUpdateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InspectionUpdate }) =>
      inspectionsApi.updateInspection(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: inspectionKeys.lists() });
      qc.invalidateQueries({ queryKey: inspectionKeys.detail(variables.id) });
    },
  });
}

export function useDeleteInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inspectionsApi.deleteInspection(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inspectionKeys.lists() });
      qc.invalidateQueries({ queryKey: [...inspectionKeys.all, 'sign'] });
      qc.invalidateQueries({ queryKey: [...inspectionKeys.all, 'support'] });
    },
  });
}

export function useSignInspections(signId: string | undefined) {
  return useQuery({
    queryKey: inspectionKeys.signInspections(signId!),
    queryFn: () => inspectionsApi.listSignInspections(signId!, { page_size: 10 }),
    enabled: !!signId,
  });
}

export function useSupportInspections(supportId: string | undefined) {
  return useQuery({
    queryKey: inspectionKeys.supportInspections(supportId!),
    queryFn: () => inspectionsApi.listSupportInspections(supportId!, { page_size: 10 }),
    enabled: !!supportId,
  });
}

export function useCreateWorkOrderFromInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inspectionId: string) =>
      inspectionsApi.createWorkOrderFromInspection(inspectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inspectionKeys.lists() });
      qc.invalidateQueries({ queryKey: workOrderKeys.lists() });
    },
  });
}
