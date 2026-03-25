import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as supportsApi from '../api/supports';
import type { SignSupportCreate } from '../api/types';

export const supportKeys = {
  all: ['supports'] as const,
  lists: () => [...supportKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...supportKeys.lists(), filters] as const,
  details: () => [...supportKeys.all, 'detail'] as const,
  detail: (id: string) => [...supportKeys.details(), id] as const,
};

export function useSupportsList(filters?: {
  page?: number;
  page_size?: number;
  status?: string;
  support_type?: string;
}) {
  return useQuery({
    queryKey: supportKeys.list(filters ?? {}),
    queryFn: () => supportsApi.listSupports(filters),
  });
}

export function useSupport(id: string | undefined) {
  return useQuery({
    queryKey: supportKeys.detail(id!),
    queryFn: () => supportsApi.getSupport(id!),
    enabled: !!id,
  });
}

export function useCreateSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SignSupportCreate) => supportsApi.createSupport(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: supportKeys.lists() }),
  });
}

export function useUpdateSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SignSupportCreate> }) =>
      supportsApi.updateSupport(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supportKeys.lists() });
      qc.invalidateQueries({ queryKey: supportKeys.detail(variables.id) });
    },
  });
}

export function useDeleteSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supportsApi.deleteSupport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: supportKeys.lists() }),
  });
}
