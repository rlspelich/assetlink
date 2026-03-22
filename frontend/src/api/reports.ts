import { api } from './client';
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

function toSearchParams(params: Record<string, string | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, v);
  }
  return sp;
}

export async function getWorkOrderReport(params: WorkOrderReportParams = {}): Promise<WorkOrderReport> {
  const sp = toSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/work-orders', { searchParams: sp }).json();
}

export async function getInspectionReport(params: InspectionReportParams = {}): Promise<InspectionReport> {
  const sp = toSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/inspections', { searchParams: sp }).json();
}

export async function getInventoryReport(params: InventoryReportParams = {}): Promise<InventoryReport> {
  const sp = toSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/inventory', { searchParams: sp }).json();
}

export async function getCrewProductivityReport(params: CrewProductivityReportParams = {}): Promise<CrewProductivityReport> {
  const sp = toSearchParams(params as Record<string, string | undefined>);
  return api.get('reports/crew-productivity', { searchParams: sp }).json();
}
