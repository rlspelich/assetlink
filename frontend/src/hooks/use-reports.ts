import { useQuery } from '@tanstack/react-query';
import {
  getWorkOrderReport,
  getInspectionReport,
  getInventoryReport,
  getCrewProductivityReport,
} from '../api/reports';
import type {
  WorkOrderReportParams,
  InspectionReportParams,
  InventoryReportParams,
  CrewProductivityReportParams,
} from '../api/types';

export const reportKeys = {
  all: ['reports'] as const,
  workOrders: (params: WorkOrderReportParams) => [...reportKeys.all, 'work-orders', params] as const,
  inspections: (params: InspectionReportParams) => [...reportKeys.all, 'inspections', params] as const,
  inventory: (params: InventoryReportParams) => [...reportKeys.all, 'inventory', params] as const,
  crewProductivity: (params: CrewProductivityReportParams) => [...reportKeys.all, 'crew-productivity', params] as const,
};

export function useWorkOrderReport(params: WorkOrderReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.workOrders(params),
    queryFn: () => getWorkOrderReport(params),
    staleTime: 120_000,
    enabled,
  });
}

export function useInspectionReport(params: InspectionReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.inspections(params),
    queryFn: () => getInspectionReport(params),
    staleTime: 120_000,
    enabled,
  });
}

export function useInventoryReport(params: InventoryReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.inventory(params),
    queryFn: () => getInventoryReport(params),
    staleTime: 120_000,
    enabled,
  });
}

export function useCrewProductivityReport(params: CrewProductivityReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.crewProductivity(params),
    queryFn: () => getCrewProductivityReport(params),
    staleTime: 120_000,
    enabled,
  });
}
