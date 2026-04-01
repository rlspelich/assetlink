import { api, buildSearchParams } from './client';
import type {
  WorkOrderReport,
  WorkOrderReportParams,
  InspectionReport,
  InspectionReportParams,
  InventoryReport,
  InventoryReportParams,
  CrewProductivityReport,
  CrewProductivityReportParams,
} from './types';

export async function getWorkOrderReport(params: WorkOrderReportParams = {}): Promise<WorkOrderReport> {
  const sp = buildSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/work-orders', { searchParams: sp }).json();
}

export async function getInspectionReport(params: InspectionReportParams = {}): Promise<InspectionReport> {
  const sp = buildSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/inspections', { searchParams: sp }).json();
}

export async function getInventoryReport(params: InventoryReportParams = {}): Promise<InventoryReport> {
  const sp = buildSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/inventory', { searchParams: sp }).json();
}

export async function getCrewProductivityReport(params: CrewProductivityReportParams = {}): Promise<CrewProductivityReport> {
  const sp = buildSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/crew-productivity', { searchParams: sp }).json();
}
