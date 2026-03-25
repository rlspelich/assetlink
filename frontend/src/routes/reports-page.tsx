import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart,
  AlertTriangle,
  Printer,
  ClipboardList,
  Eye,
  Shield,
  Clock,
  Users,
  Package,
  TrendingUp,
  CheckCircle,
  BarChart3,
  Calendar,
  Award,
  ChevronUp,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import {
  useWorkOrderReport,
  useInspectionReport,
  useInventoryReport,
  useCrewProductivityReport,
} from '../hooks/use-reports';
import { useWorkOrdersList } from '../hooks/use-work-orders';
import { useInspectionsList } from '../hooks/use-inspections';
import { useUsersList } from '../hooks/use-users';
import {
  CONDITION_COLORS,
  UNRATED_COLOR,
  WO_PRIORITY_COLORS,
  getWoStatusOption,
  getWoPriorityOption,
  getInspectionTypeOption,
  getInspectionStatusOption,
  formatEnumLabel,
} from '../lib/constants';
import { openPrintPreview } from '../lib/print-utils';
import type {
  WorkOrder,
  Inspection,
  AssigneeBucket,
  InspectorBucket,
} from '../api/types';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1).toISOString().slice(0, 10);
}

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function lastYearRange(): [string, string] {
  const y = new Date().getFullYear() - 1;
  return [`${y}-01-01`, `${y}-12-31`];
}

function formatDateDisplay(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtPct(n: number | null): string {
  if (n === null) return '--';
  return `${n.toFixed(1)}%`;
}

function fmtDays(n: number | null): string {
  if (n === null) return '--';
  return `${n.toFixed(1)}`;
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

type TabId = 'work-orders' | 'inspections' | 'inventory' | 'crew';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'work-orders', label: 'Work Orders', icon: <ClipboardList size={15} /> },
  { id: 'inspections', label: 'Inspections', icon: <Eye size={15} /> },
  { id: 'inventory', label: 'Inventory', icon: <Package size={15} /> },
  { id: 'crew', label: 'Crew Productivity', icon: <Users size={15} /> },
];

type PresetId = '7d' | '30d' | 'quarter' | 'year' | 'last-year';

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'year', label: 'This Year' },
  { id: 'last-year', label: 'Last Year' },
];

function applyPreset(id: PresetId): [string, string] {
  switch (id) {
    case '7d':
      return [daysAgoISO(7), todayISO()];
    case '30d':
      return [daysAgoISO(30), todayISO()];
    case 'quarter':
      return [startOfQuarter(), todayISO()];
    case 'year':
      return [startOfYear(), todayISO()];
    case 'last-year':
      return lastYearRange();
  }
}

// ---------------------------------------------------------------------------
// KPI Card (same style as dashboard-page)
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  borderColor: string;
  icon: React.ReactNode;
  alert?: boolean;
}

function KpiCard({ title, value, subtitle, borderColor, icon, alert }: KpiCardProps) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${borderColor} p-4 flex flex-col justify-between min-h-[120px]`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
        <span className={alert ? 'text-red-500' : 'text-gray-400'}>{icon}</span>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar Chart (identical to dashboard-page)
// ---------------------------------------------------------------------------

interface BarItem {
  label: string;
  count: number;
  color: string;
}

function HorizontalBarChart({ items, title }: { items: BarItem[]; title: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No data</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-28 text-xs text-gray-600 text-right shrink-0 truncate" title={item.label}>
                {item.label}
              </span>
              <div className="flex-1 h-6 bg-gray-100 rounded-sm overflow-hidden relative">
                <div
                  className="h-full rounded-sm transition-all duration-500"
                  style={{
                    width: `${Math.max((item.count / max) * 100, item.count > 0 ? 2 : 0)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <span className="w-10 text-xs font-medium text-gray-700 text-right shrink-0">
                {fmt(item.count)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stacked Bar Chart (created + completed side by side)
// ---------------------------------------------------------------------------

function DualBarChart({
  items,
  title,
  labelKey,
  bar1Key,
  bar1Label,
  bar1Color,
  bar2Key,
  bar2Label,
  bar2Color,
}: {
  items: Array<Record<string, unknown>>;
  title: string;
  labelKey: string;
  bar1Key: string;
  bar1Label: string;
  bar1Color: string;
  bar2Key: string;
  bar2Label: string;
  bar2Color: string;
}) {
  const max = Math.max(
    ...items.map((i) => Math.max(Number(i[bar1Key]) || 0, Number(i[bar2Key]) || 0)),
    1
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: bar1Color }} />
          {bar1Label}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: bar2Color }} />
          {bar2Label}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No data</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const label = String(item[labelKey]);
            const v1 = Number(item[bar1Key]) || 0;
            const v2 = Number(item[bar2Key]) || 0;
            return (
              <div key={label}>
                <div className="flex items-center gap-3 mb-0.5">
                  <span className="w-28 text-xs text-gray-600 text-right shrink-0 truncate" title={label}>
                    {label}
                  </span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${Math.max((v1 / max) * 100, v1 > 0 ? 2 : 0)}%`,
                        backgroundColor: bar1Color,
                      }}
                    />
                  </div>
                  <span className="w-8 text-xs font-medium text-gray-700 text-right shrink-0">{fmt(v1)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0" />
                  <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${Math.max((v2 / max) * 100, v2 > 0 ? 2 : 0)}%`,
                        backgroundColor: bar2Color,
                      }}
                    />
                  </div>
                  <span className="w-8 text-xs font-medium text-gray-700 text-right shrink-0">{fmt(v2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Table
// ---------------------------------------------------------------------------

interface Column<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  highlight?: (row: T) => boolean;
}

function DataTable<T>({
  title,
  rows,
  columns,
  emptyMessage,
}: {
  title: string;
  rows: T[];
  columns: Column<T>[];
  emptyMessage?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">{emptyMessage || 'No data'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col, ci) => {
                    const val = col.accessor(row);
                    const isHighlighted = col.highlight?.(row) ?? false;
                    return (
                      <td
                        key={ci}
                        className={`px-4 py-2.5 whitespace-nowrap ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        } ${isHighlighted ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
                      >
                        {val ?? '--'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 h-[120px]">
            <div className="h-3 bg-gray-200 rounded w-20 mb-4" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5 h-64" />
        <div className="bg-white rounded-lg border border-gray-200 p-5 h-64" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Failed to Load Report</h2>
        <p className="text-sm text-gray-400 mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print HTML generators for reports
// ---------------------------------------------------------------------------

function generateReportPrintHtml(
  title: string,
  dateRange: string,
  kpis: Array<{ label: string; value: string }>,
  tables: Array<{ title: string; headers: string[]; rows: string[][] }>,
): string {
  const kpiRows = kpis
    .map((k) => `<div class="field-row"><span class="label">${k.label}:</span> ${k.value}</div>`)
    .join('\n');

  const tableHtml = tables
    .map(
      (t) => `
      <div class="section">
        <hr class="divider">
        <div class="section-title">${t.title}</div>
        <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-top:4px;">
          <thead>
            <tr>${t.headers.map((h) => `<th style="text-align:left;border-bottom:1px solid #000;padding:2px 8px 2px 0;font-size:9pt;">${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${t.rows.map((row) => `<tr>${row.map((c) => `<td style="padding:2px 8px 2px 0;border-bottom:1px solid #eee;font-size:10pt;">${c}</td>`).join('')}</tr>`).join('\n')}
          </tbody>
        </table>
      </div>`
    )
    .join('\n');

  return `
    <div class="header">
      <div class="header-title">${title}</div>
    </div>
    <div class="header-sub">
      <div>AssetLink</div>
      <div>${dateRange}</div>
    </div>
    <hr class="divider">
    <div class="section">
      <div class="section-title">KEY METRICS</div>
      <div class="field-grid">${kpiRows}</div>
    </div>
    ${tableHtml}
  `;
}

// ---------------------------------------------------------------------------
// Tab 1: Work Orders Report
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Work Order Status List — sortable/filterable table for actionable worklist
// ---------------------------------------------------------------------------

type WoListFilter = 'all' | 'open' | 'overdue' | 'emergency' | 'unassigned' | 'completed';
type WoListSortField = 'work_order_number' | 'priority' | 'status' | 'due_date' | 'days_open' | 'created_at';
type SortDirection = 'asc' | 'desc';

const WO_LIST_PRIORITY_ORDER: Record<string, number> = {
  emergency: 0, urgent: 1, routine: 2, planned: 3,
};

const WO_LIST_STATUS_ORDER: Record<string, number> = {
  open: 0, assigned: 1, in_progress: 2, on_hold: 3, completed: 4, cancelled: 5,
};

const OPEN_STATUSES = new Set(['open', 'assigned', 'in_progress', 'on_hold']);

function calcDaysOpen(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
}

function isOverdue(wo: WorkOrder): boolean {
  if (!wo.due_date) return false;
  return OPEN_STATUSES.has(wo.status) && new Date(wo.due_date) < new Date();
}

function WorkOrderStatusList({ startDate, endDate }: { startDate: string; endDate: string }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<WoListFilter>('all');
  const [sortField, setSortField] = useState<WoListSortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const { data: woData, isLoading } = useWorkOrdersList({ page_size: 100 });
  const { data: usersData } = useUsersList();

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      map.set(u.user_id, `${u.first_name} ${u.last_name}`);
    }
    return map;
  }, [usersData]);

  const allWOs = useMemo(() => {
    const wos = woData?.work_orders ?? [];
    // Filter to date range
    return wos.filter((wo) => {
      const created = wo.created_at.slice(0, 10);
      return created >= startDate && created <= endDate;
    });
  }, [woData, startDate, endDate]);

  const filtered = useMemo(() => {
    let items = allWOs;
    switch (filter) {
      case 'open':
        items = items.filter((wo) => OPEN_STATUSES.has(wo.status));
        break;
      case 'overdue':
        items = items.filter(isOverdue);
        break;
      case 'emergency':
        items = items.filter((wo) => wo.priority === 'emergency');
        break;
      case 'unassigned':
        items = items.filter((wo) => !wo.assigned_to);
        break;
      case 'completed':
        items = items.filter((wo) => wo.status === 'completed');
        break;
    }
    return items;
  }, [allWOs, filter]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'work_order_number':
          cmp = (a.work_order_number ?? '').localeCompare(b.work_order_number ?? '');
          break;
        case 'priority':
          cmp = (WO_LIST_PRIORITY_ORDER[a.priority] ?? 99) - (WO_LIST_PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case 'status':
          cmp = (WO_LIST_STATUS_ORDER[a.status] ?? 99) - (WO_LIST_STATUS_ORDER[b.status] ?? 99);
          break;
        case 'due_date':
          cmp = (a.due_date ?? '').localeCompare(b.due_date ?? '');
          break;
        case 'days_open':
          cmp = calcDaysOpen(a.created_at) - calcDaysOpen(b.created_at);
          break;
        case 'created_at':
          cmp = a.created_at.localeCompare(b.created_at);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: WoListSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: WoListSortField }) => {
    if (sortField !== field) return <span className="w-3" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-600" />
      : <ChevronDown size={12} className="text-blue-600" />;
  };

  const thClass = (field: WoListSortField) =>
    `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap ${
      sortField === field ? 'text-blue-700' : 'text-gray-500'
    }`;

  const filterPills: Array<{ id: WoListFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'completed', label: 'Completed This Period' },
  ];

  const handleRowClick = (wo: WorkOrder) => {
    navigate('/work-orders', { state: { selectedWorkOrderId: wo.work_order_id } });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Work Order Status List</h3>
        <div className="flex flex-wrap gap-1.5">
          {filterPills.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                filter === p.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">Loading work orders...</div>
      ) : sorted.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">No work orders match the current filter</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className={thClass('work_order_number')} onClick={() => handleSort('work_order_number')}>
                    <span className="flex items-center gap-1">WO # <SortIcon field="work_order_number" /></span>
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Description</th>
                  <th className={thClass('priority')} onClick={() => handleSort('priority')}>
                    <span className="flex items-center gap-1">Priority <SortIcon field="priority" /></span>
                  </th>
                  <th className={thClass('status')} onClick={() => handleSort('status')}>
                    <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Work Type</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Assets</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Assigned To</th>
                  <th className={thClass('due_date')} onClick={() => handleSort('due_date')}>
                    <span className="flex items-center gap-1">Due Date <SortIcon field="due_date" /></span>
                  </th>
                  <th className={thClass('days_open')} onClick={() => handleSort('days_open')}>
                    <span className="flex items-center gap-1">Days Open <SortIcon field="days_open" /></span>
                  </th>
                  <th className={thClass('created_at')} onClick={() => handleSort('created_at')}>
                    <span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.slice(0, 100).map((wo) => {
                  const priorityOpt = getWoPriorityOption(wo.priority);
                  const statusOpt = getWoStatusOption(wo.status);
                  const assetCount = wo.assets?.length ?? 0;
                  const daysOpen = calcDaysOpen(wo.created_at);
                  const overdue = isOverdue(wo);

                  return (
                    <tr
                      key={wo.work_order_id}
                      onClick={() => handleRowClick(wo)}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {wo.work_order_number || '\u2014'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate">
                        {wo.description || 'No description'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${priorityOpt.color}`}>
                          {priorityOpt.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusOpt.color}`}>
                          {statusOpt.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {formatEnumLabel(wo.work_type)}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {assetCount > 0 ? (
                          <span className="font-medium">{assetCount}</span>
                        ) : (
                          <span className="text-gray-300">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {wo.assigned_to ? (userMap.get(wo.assigned_to) ?? 'Unknown') : <span className="text-gray-300">{'\u2014'}</span>}
                      </td>
                      <td className={`px-3 py-2 text-xs whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {wo.due_date ? formatDateDisplay(wo.due_date) : <span className="text-gray-300">{'\u2014'}</span>}
                      </td>
                      <td className={`px-3 py-2 text-xs whitespace-nowrap ${daysOpen > 30 ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                        {OPEN_STATUSES.has(wo.status) ? daysOpen : <span className="text-gray-300">{'\u2014'}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                        {formatDateDisplay(wo.created_at.slice(0, 10))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > 100 && (
            <div className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
              Showing 100 of {sorted.length} work orders. Use filters to narrow results.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WorkOrdersTab({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const navigate = useNavigate();
  const params = useMemo(
    () => ({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const { data, isLoading, isError, error, refetch } = useWorkOrderReport(params);

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ReportError message={error instanceof Error ? error.message : 'Unknown error'} onRetry={() => refetch()} />;
  if (!data) return null;

  const d = data;

  // Priority bars
  const priorityColors: Record<string, string> = WO_PRIORITY_COLORS;
  const priorityItems: BarItem[] = d.by_priority.map((b) => ({
    label: capitalize(b.priority),
    count: b.created,
    color: priorityColors[b.priority] || '#6b7280',
  }));

  // Work type bars
  const workTypeItems: BarItem[] = d.by_work_type.map((b, i) => ({
    label: capitalize(b.work_type),
    count: b.count,
    color: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'][i % 6],
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="WOs Created"
          value={fmt(d.total_created)}
          subtitle={`${fmt(d.total_cancelled)} cancelled`}
          borderColor="border-blue-500"
          icon={<ClipboardList size={18} />}
        />
        <KpiCard
          title="WOs Completed"
          value={fmt(d.total_completed)}
          subtitle={`${fmt(d.total_assets_affected)} assets affected`}
          borderColor="border-green-500"
          icon={<CheckCircle size={18} />}
        />
        <KpiCard
          title="Open Backlog"
          value={fmt(d.total_open)}
          borderColor={d.total_open > 10 ? 'border-red-500' : 'border-yellow-500'}
          icon={<Clock size={18} />}
          alert={d.total_open > 10}
        />
        <KpiCard
          title="Avg Days to Complete"
          value={fmtDays(d.avg_days_to_complete)}
          subtitle={d.avg_emergency_response_days !== null ? `Emergency: ${fmtDays(d.avg_emergency_response_days)} days` : undefined}
          borderColor="border-blue-500"
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Charts row 1: Priority + Monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart items={priorityItems} title="By Priority (Created)" />
        <DualBarChart
          items={d.by_month as unknown as Array<Record<string, unknown>>}
          title="Monthly Trend"
          labelKey="month"
          bar1Key="created"
          bar1Label="Created"
          bar1Color="#3b82f6"
          bar2Key="completed"
          bar2Label="Completed"
          bar2Color="#22c55e"
        />
      </div>

      {/* Charts row 2: Work type + Assignee table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart items={workTypeItems} title="By Work Type" />
        <DataTable<AssigneeBucket>
          title="By Assignee"
          rows={d.by_assignee}
          columns={[
            { header: 'Crew Member', accessor: (r) => (
              <button
                onClick={() => navigate('/work-orders', { state: { filterAssignedTo: r.user_id } })}
                className="hover:underline hover:text-blue-600 transition-colors text-left"
              >
                {r.user_name}
              </button>
            ) },
            { header: 'Completed', accessor: (r) => r.completed > 0 ? (
              <button
                onClick={() => navigate('/work-orders', { state: { filterAssignedTo: r.user_id, filterStatus: 'completed' } })}
                className="hover:underline hover:text-blue-600 transition-colors"
              >
                {fmt(r.completed)}
              </button>
            ) : fmt(r.completed), align: 'right' },
            { header: 'Open', accessor: (r) => r.open > 0 ? (
              <button
                onClick={() => navigate('/work-orders', { state: { filterAssignedTo: r.user_id, filterStatus: 'open' } })}
                className="hover:underline hover:text-blue-600 transition-colors"
              >
                {fmt(r.open)}
              </button>
            ) : fmt(r.open), align: 'right' },
          ]}
          emptyMessage="No work order assignments in this period"
        />
      </div>

      {/* Section divider + Status List */}
      <div className="border-t border-gray-200 pt-6">
        <WorkOrderStatusList startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Inspections Report
// ---------------------------------------------------------------------------

const CONDITION_RATING_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

// ---------------------------------------------------------------------------
// Inspection Status List — sortable/filterable table for actionable worklist
// ---------------------------------------------------------------------------

type InspListFilter = 'all' | 'needs_followup' | 'no_wo' | 'completed' | 'open';
type InspListSortField = 'inspection_number' | 'inspection_date' | 'condition_rating' | 'status' | 'created_at';

const INSP_LIST_STATUS_ORDER: Record<string, number> = {
  open: 0, in_progress: 1, completed: 2, cancelled: 3,
};

function InspectionStatusList({ startDate, endDate }: { startDate: string; endDate: string }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InspListFilter>('all');
  const [sortField, setSortField] = useState<InspListSortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const { data: inspData, isLoading } = useInspectionsList({ page_size: 100 });
  const { data: usersData } = useUsersList();

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      map.set(u.user_id, `${u.first_name} ${u.last_name}`);
    }
    return map;
  }, [usersData]);

  const allInspections = useMemo(() => {
    const insps = inspData?.inspections ?? [];
    return insps.filter((insp) => {
      const created = insp.created_at.slice(0, 10);
      return created >= startDate && created <= endDate;
    });
  }, [inspData, startDate, endDate]);

  const filtered = useMemo(() => {
    let items = allInspections;
    switch (filter) {
      case 'needs_followup':
        items = items.filter((insp) => insp.follow_up_required);
        break;
      case 'no_wo':
        items = items.filter((insp) => insp.follow_up_required && !insp.follow_up_work_order_id);
        break;
      case 'completed':
        items = items.filter((insp) => insp.status === 'completed');
        break;
      case 'open':
        items = items.filter((insp) => insp.status === 'open' || insp.status === 'in_progress');
        break;
    }
    return items;
  }, [allInspections, filter]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'inspection_number':
          cmp = (a.inspection_number ?? '').localeCompare(b.inspection_number ?? '');
          break;
        case 'inspection_date':
          cmp = (a.inspection_date ?? '').localeCompare(b.inspection_date ?? '');
          break;
        case 'condition_rating':
          cmp = (a.condition_rating ?? 0) - (b.condition_rating ?? 0);
          break;
        case 'status':
          cmp = (INSP_LIST_STATUS_ORDER[a.status] ?? 99) - (INSP_LIST_STATUS_ORDER[b.status] ?? 99);
          break;
        case 'created_at':
          cmp = a.created_at.localeCompare(b.created_at);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: InspListSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: InspListSortField }) => {
    if (sortField !== field) return <span className="w-3" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-600" />
      : <ChevronDown size={12} className="text-blue-600" />;
  };

  const thClass = (field: InspListSortField) =>
    `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap ${
      sortField === field ? 'text-blue-700' : 'text-gray-500'
    }`;

  const filterPills: Array<{ id: InspListFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'needs_followup', label: 'Needs Follow-up' },
    { id: 'no_wo', label: 'No WO Created' },
    { id: 'completed', label: 'Completed' },
    { id: 'open', label: 'Open' },
  ];

  const handleRowClick = (insp: Inspection) => {
    navigate('/inspections', { state: { selectedInspectionId: insp.inspection_id } });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Inspection Status List</h3>
        <div className="flex flex-wrap gap-1.5">
          {filterPills.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                filter === p.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">Loading inspections...</div>
      ) : sorted.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">No inspections match the current filter</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className={thClass('inspection_number')} onClick={() => handleSort('inspection_number')}>
                    <span className="flex items-center gap-1">INS # <SortIcon field="inspection_number" /></span>
                  </th>
                  <th className={thClass('inspection_date')} onClick={() => handleSort('inspection_date')}>
                    <span className="flex items-center gap-1">Date <SortIcon field="inspection_date" /></span>
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Type</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Assets</th>
                  <th className={thClass('condition_rating')} onClick={() => handleSort('condition_rating')}>
                    <span className="flex items-center gap-1">Condition <SortIcon field="condition_rating" /></span>
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Follow-up</th>
                  <th className={thClass('status')} onClick={() => handleSort('status')}>
                    <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Inspector</th>
                  <th className={thClass('created_at')} onClick={() => handleSort('created_at')}>
                    <span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.slice(0, 100).map((insp) => {
                  const typeOpt = getInspectionTypeOption(insp.inspection_type);
                  const statusOpt = getInspectionStatusOption(insp.status);
                  const condColor = insp.condition_rating
                    ? CONDITION_COLORS[insp.condition_rating]
                    : UNRATED_COLOR;
                  const assetCount = insp.assets?.length ?? 0;
                  const firstAssetLabel = insp.assets?.[0]?.asset_label;

                  let followUpBadge: { label: string; classes: string };
                  if (insp.follow_up_required && insp.follow_up_work_order_id) {
                    followUpBadge = { label: 'WO Linked', classes: 'bg-blue-100 text-blue-800' };
                  } else if (insp.follow_up_required) {
                    followUpBadge = { label: 'Required', classes: 'bg-red-100 text-red-800' };
                  } else {
                    followUpBadge = { label: 'No', classes: 'bg-gray-100 text-gray-500' };
                  }

                  return (
                    <tr
                      key={insp.inspection_id}
                      onClick={() => handleRowClick(insp)}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {insp.inspection_number || '\u2014'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {formatDateDisplay(insp.inspection_date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${typeOpt.color}`}>
                          {typeOpt.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {assetCount > 0 ? (
                          <span>
                            <span className="font-medium">{assetCount}</span>
                            {firstAssetLabel && (
                              <span className="text-gray-400 ml-1 truncate max-w-[100px] inline-block align-bottom">
                                {firstAssetLabel}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">{'\u2014'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: condColor.hex }}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: condColor.hex }} />
                          {insp.condition_rating ? `${insp.condition_rating}/5` : 'Unrated'}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${followUpBadge.classes}`}>
                          {insp.follow_up_required && !insp.follow_up_work_order_id && (
                            <AlertCircle size={9} />
                          )}
                          {followUpBadge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusOpt.color}`}>
                          {statusOpt.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {insp.inspector_id ? (userMap.get(insp.inspector_id) ?? 'Unknown') : <span className="text-gray-300">{'\u2014'}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                        {formatDateDisplay(insp.created_at.slice(0, 10))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > 100 && (
            <div className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
              Showing 100 of {sorted.length} inspections. Use filters to narrow results.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InspectionsTab({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const params = useMemo(
    () => ({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const { data, isLoading, isError, error, refetch } = useInspectionReport(params);

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ReportError message={error instanceof Error ? error.message : 'Unknown error'} onRetry={() => refetch()} />;
  if (!data) return null;

  const d = data;

  // Condition distribution
  const conditionItems: BarItem[] = d.condition_distribution.map((b) => ({
    label: b.rating !== null ? (CONDITION_RATING_LABELS[b.rating] || `Rating ${b.rating}`) : 'Unrated',
    count: b.count,
    color: b.rating !== null ? (CONDITION_COLORS[b.rating]?.hex || UNRATED_COLOR.hex) : UNRATED_COLOR.hex,
  }));

  // By type
  const typeItems: BarItem[] = d.by_type.map((b, i) => ({
    label: capitalize(b.inspection_type),
    count: b.count,
    color: ['#3b82f6', '#a855f7', '#f59e0b', '#6b7280'][i % 4],
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Inspections Completed"
          value={fmt(d.total_completed)}
          subtitle={`${fmt(d.total_open)} still open`}
          borderColor="border-green-500"
          icon={<CheckCircle size={18} />}
        />
        <KpiCard
          title="Coverage Rate"
          value={fmtPct(d.coverage_rate)}
          subtitle={`${fmt(d.signs_inspected)} unique signs inspected`}
          borderColor="border-blue-500"
          icon={<Eye size={18} />}
        />
        <KpiCard
          title="Follow-up Rate"
          value={fmtPct(d.follow_up_rate)}
          subtitle={`${fmt(d.follow_ups_required)} need follow-up, ${fmt(d.follow_ups_with_wo)} have WOs`}
          borderColor={d.follow_up_rate !== null && d.follow_up_rate > 30 ? 'border-orange-500' : 'border-blue-500'}
          icon={<AlertTriangle size={18} />}
        />
        <KpiCard
          title="Retro Pass Rate"
          value={fmtPct(d.retro_pass_rate)}
          subtitle={`${fmt(d.retro_pass_count)} pass / ${fmt(d.retro_fail_count)} fail of ${fmt(d.retro_readings_taken)} readings`}
          borderColor={d.retro_pass_rate !== null && d.retro_pass_rate < 80 ? 'border-red-500' : 'border-green-500'}
          icon={<Shield size={18} />}
        />
      </div>

      {/* Charts: condition + monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart items={conditionItems} title="Condition Distribution (Inspected Signs)" />
        <HorizontalBarChart
          items={d.by_month.map((b) => ({
            label: b.month,
            count: b.completed,
            color: '#22c55e',
          }))}
          title="Monthly Trend (Completed)"
        />
      </div>

      {/* By type + By inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart items={typeItems} title="By Inspection Type" />
        <DataTable<InspectorBucket>
          title="By Inspector"
          rows={d.by_inspector}
          columns={[
            { header: 'Inspector', accessor: (r) => r.user_name },
            { header: 'Completed', accessor: (r) => fmt(r.completed), align: 'right' },
          ]}
          emptyMessage="No inspections in this period"
        />
      </div>

      {/* Section divider + Status List */}
      <div className="border-t border-gray-200 pt-6">
        <InspectionStatusList startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Inventory Report
// ---------------------------------------------------------------------------

const CONDITION_ORDER: Array<{ rating: number | null; label: string; color: string }> = [
  { rating: 5, label: 'Excellent', color: CONDITION_COLORS[5].hex },
  { rating: 4, label: 'Good', color: CONDITION_COLORS[4].hex },
  { rating: 3, label: 'Fair', color: CONDITION_COLORS[3].hex },
  { rating: 2, label: 'Poor', color: CONDITION_COLORS[2].hex },
  { rating: 1, label: 'Critical', color: CONDITION_COLORS[1].hex },
  { rating: null, label: 'Unrated', color: UNRATED_COLOR.hex },
];

const AGE_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#6b7280'];
const AGE_ORDER = ['0-2 years', '2-5 years', '5-10 years', '10-15 years', '15+ years', 'Unknown'];

function InventoryTab() {
  const params = useMemo(() => ({}), []);
  const { data, isLoading, isError, error, refetch } = useInventoryReport(params);

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ReportError message={error instanceof Error ? error.message : 'Unknown error'} onRetry={() => refetch()} />;
  if (!data) return null;

  const d = data;

  // Condition
  const condMap = new Map<number | null, number>();
  for (const b of d.condition_distribution) condMap.set(b.rating, b.count);
  const conditionItems: BarItem[] = CONDITION_ORDER.map((c) => ({
    label: c.label,
    count: condMap.get(c.rating) ?? 0,
    color: c.color,
  }));

  // Status
  const statusItems: BarItem[] = d.status_distribution.map((b, i) => ({
    label: capitalize(b.status),
    count: b.count,
    color: ['#22c55e', '#f97316', '#eab308', '#ef4444', '#6b7280', '#8b5cf6'][i % 6],
  }));

  // Age
  const ageMap = new Map<string, number>();
  for (const b of d.age_distribution) ageMap.set(b.range, b.count);
  const ageItems: BarItem[] = AGE_ORDER.map((r, i) => ({
    label: r,
    count: ageMap.get(r) ?? 0,
    color: AGE_COLORS[i],
  }));

  // Sheeting
  const sheetingItems: BarItem[] = d.sheeting_distribution.map((b) => ({
    label: b.sheeting_type,
    count: b.count,
    color: '#6366f1',
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Signs"
          value={fmt(d.total_signs)}
          subtitle={`${fmt(d.total_supports)} supports`}
          borderColor="border-blue-500"
          icon={<BarChart3 size={18} />}
        />
        <KpiCard
          title="Compliance Rate"
          value={fmtPct(d.compliance_rate)}
          subtitle={`${fmt(d.signs_passing_retro)} of ${fmt(d.signs_with_retro_data)} measured`}
          borderColor={d.compliance_rate !== null && d.compliance_rate >= 80 ? 'border-green-500' : 'border-red-500'}
          icon={<Shield size={18} />}
        />
        <KpiCard
          title="Overdue for Replacement"
          value={fmt(d.overdue_for_replacement)}
          subtitle={`${fmt(d.due_within_90_days)} due in 90 days, ${fmt(d.due_within_1_year)} in 1 year`}
          borderColor={d.overdue_for_replacement > 0 ? 'border-red-500' : 'border-green-500'}
          icon={<Clock size={18} />}
          alert={d.overdue_for_replacement > 0}
        />
        <KpiCard
          title="Signs Added (30d)"
          value={fmt(d.signs_added_last_30)}
          subtitle={`${fmt(d.signs_removed_last_30)} removed`}
          borderColor="border-blue-500"
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Charts: condition + status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart items={conditionItems} title="Condition Distribution" />
        <HorizontalBarChart items={statusItems} title="Status Distribution" />
      </div>

      {/* Charts: age + sheeting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart items={ageItems} title="Age Distribution" />
        <HorizontalBarChart items={sheetingItems} title="Sheeting Type Distribution" />
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Crew Member Detail — expandable inline detail for a crew member
// ---------------------------------------------------------------------------

function CrewMemberDetail({
  userId,
}: {
  userId: string;
  userName?: string;
  startDate?: string;
  endDate?: string;
}) {
  const navigate = useNavigate();
  const { data: woData } = useWorkOrdersList({
    page_size: 100,
    assigned_to: userId,
  });
  const { data: inspData } = useInspectionsList({
    page_size: 100,
    inspector_id: userId,
  });

  const workOrders = woData?.work_orders ?? [];
  const inspections = inspData?.inspections ?? [];

  const INITIAL_DISPLAY = 10;
  const [showAllWOs, setShowAllWOs] = useState(false);
  const [showAllInsp, setShowAllInsp] = useState(false);

  // Sort WOs by priority (emergency first) then by date
  const priorityOrder: Record<string, number> = { emergency: 0, urgent: 1, routine: 2, planned: 3 };
  const sortedWOs = [...workOrders].sort((a, b) => {
    const pa = priorityOrder[a.priority ?? 'planned'] ?? 4;
    const pb = priorityOrder[b.priority ?? 'planned'] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });

  const displayedWOs = showAllWOs ? sortedWOs : sortedWOs.slice(0, INITIAL_DISPLAY);
  const sortedInsp = [...inspections].sort((a, b) => (b.inspection_date ?? '').localeCompare(a.inspection_date ?? ''));
  const displayedInsp = showAllInsp ? sortedInsp : sortedInsp.slice(0, INITIAL_DISPLAY);

  return (
    <div className="space-y-3">
      {/* Work Orders section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Work Orders — <span className="normal-case font-normal">Displaying {displayedWOs.length} of {workOrders.length}</span>
        </h4>
        {workOrders.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No work orders assigned</p>
        ) : (
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">WO #</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Description</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Priority</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Status</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedWOs.map((wo) => (
                  <tr
                    key={wo.work_order_id}
                    onClick={() => navigate('/work-orders', { state: { selectedWorkOrderId: wo.work_order_id } })}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-1.5 font-mono text-blue-600">{wo.work_order_number}</td>
                    <td className="px-3 py-1.5 text-gray-700 truncate max-w-xs">{wo.description}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                        wo.priority === 'emergency' ? 'bg-red-100 text-red-700' :
                        wo.priority === 'urgent' ? 'bg-orange-100 text-orange-700' :
                        wo.priority === 'routine' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                        wo.status === 'completed' ? 'bg-green-100 text-green-700' :
                        wo.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                        wo.status === 'open' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {wo.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{wo.created_at ? new Date(wo.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {workOrders.length > INITIAL_DISPLAY && (
              <div className="px-3 py-1.5 text-xs text-gray-400 border-t flex items-center gap-2">
                <button
                  onClick={() => setShowAllWOs(!showAllWOs)}
                  className="text-blue-600 hover:underline"
                >
                  {showAllWOs ? 'Show less' : `Show all ${workOrders.length}`}
                </button>
                <span>·</span>
                <button
                  onClick={() => navigate('/work-orders', { state: { filterAssignedTo: userId } })}
                  className="text-blue-600 hover:underline"
                >
                  Open in Work Orders
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inspections section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Inspections — <span className="normal-case font-normal">Displaying {displayedInsp.length} of {inspections.length}</span>
        </h4>
        {inspections.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No inspections assigned</p>
        ) : (
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">INS #</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Type</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Status</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Follow-Up</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedInsp.map((insp) => (
                  <tr
                    key={insp.inspection_id}
                    onClick={() => navigate('/inspections', { state: { selectedInspectionId: insp.inspection_id } })}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-1.5 font-mono text-blue-600">{insp.inspection_number}</td>
                    <td className="px-3 py-1.5 text-gray-700 capitalize">{insp.inspection_type?.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                        insp.status === 'completed' ? 'bg-green-100 text-green-700' :
                        insp.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {insp.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      {insp.follow_up_required ? (
                        <span className="text-red-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{insp.inspection_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inspections.length > INITIAL_DISPLAY && (
              <div className="px-3 py-1.5 text-xs text-gray-400 border-t flex items-center gap-2">
                <button
                  onClick={() => setShowAllInsp(!showAllInsp)}
                  className="text-blue-600 hover:underline"
                >
                  {showAllInsp ? 'Show less' : `Show all ${inspections.length}`}
                </button>
                <span>·</span>
                <button
                  onClick={() => navigate('/inspections', { state: { filterInspector: userId } })}
                  className="text-blue-600 hover:underline"
                >
                  Open in Inspections
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Crew Productivity
// ---------------------------------------------------------------------------

function CrewProductivityTab({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const params = useMemo(
    () => ({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const { data, isLoading, isError, error, refetch } = useCrewProductivityReport(params);
  const [expandedCrewId, setExpandedCrewId] = useState<string | null>(null);

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ReportError message={error instanceof Error ? error.message : 'Unknown error'} onRetry={() => refetch()} />;
  if (!data) return null;

  const sorted = [...data.crew_stats].sort((a, b) => b.wos_completed - a.wos_completed);
  const topPerformerId = sorted.length > 0 ? sorted[0].user_id : null;

  // Summary KPIs
  const totalCompleted = sorted.reduce((s, c) => s + c.wos_completed, 0);
  const totalInspections = sorted.reduce((s, c) => s + c.inspections_completed, 0);
  const avgDays = sorted.filter((c) => c.avg_days_to_complete !== null);
  const overallAvgDays =
    avgDays.length > 0
      ? avgDays.reduce((s, c) => s + (c.avg_days_to_complete ?? 0), 0) / avgDays.length
      : null;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Active Crew Members"
          value={fmt(sorted.length)}
          borderColor="border-blue-500"
          icon={<Users size={18} />}
        />
        <KpiCard
          title="Total WOs Completed"
          value={fmt(totalCompleted)}
          borderColor="border-green-500"
          icon={<CheckCircle size={18} />}
        />
        <KpiCard
          title="Total Inspections"
          value={fmt(totalInspections)}
          borderColor="border-blue-500"
          icon={<Eye size={18} />}
        />
        <KpiCard
          title="Team Avg Days"
          value={fmtDays(overallAvgDays)}
          subtitle="Avg days to complete WOs"
          borderColor="border-blue-500"
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Crew table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Crew Member Performance</h3>
        </div>
        {sorted.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No crew data for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-8"></th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">WOs Assigned</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">WOs Completed</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Days</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Inspections</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Signs Inspected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((member) => {
                  const isTop = member.user_id === topPerformerId && member.wos_completed > 0;
                  const isExpanded = expandedCrewId === member.user_id;
                  return (
                    <React.Fragment key={member.user_id}>
                      <tr
                        onClick={() => setExpandedCrewId(isExpanded ? null : member.user_id)}
                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50' : isTop ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-2.5 text-center">
                          {isTop && !isExpanded ? (
                            <Award size={16} className="text-blue-600 inline" />
                          ) : (
                            <ChevronDown size={14} className={`inline text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </td>
                        <td className={`px-4 py-2.5 whitespace-nowrap ${isTop || isExpanded ? 'font-semibold text-blue-800' : 'text-gray-900'}`}>
                          {member.user_name}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{capitalize(member.role)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt(member.wos_assigned)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt(member.wos_completed)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmtDays(member.avg_days_to_complete)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt(member.inspections_completed)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmt(member.signs_inspected)}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50 px-6 py-3">
                            <CrewMemberDetail userId={member.user_id!} userName={member.user_name} startDate={startDate} endDate={endDate} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print support - build print HTML for current tab
// ---------------------------------------------------------------------------

function usePrintReport(
  activeTab: TabId,
  startDate: string,
  endDate: string,
) {
  const woParams = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate]);
  const inspParams = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate]);
  const invParams = useMemo(() => ({}), []);
  const crewParams = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate]);

  const wo = useWorkOrderReport(woParams, activeTab === 'work-orders');
  const insp = useInspectionReport(inspParams, activeTab === 'inspections');
  const inv = useInventoryReport(invParams, activeTab === 'inventory');
  const crew = useCrewProductivityReport(crewParams, activeTab === 'crew');

  const print = useCallback(() => {
    const dateRange = `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;

    if (activeTab === 'work-orders' && wo.data) {
      const d = wo.data;
      const html = generateReportPrintHtml(
        'WORK ORDER REPORT',
        dateRange,
        [
          { label: 'WOs Created', value: fmt(d.total_created) },
          { label: 'WOs Completed', value: fmt(d.total_completed) },
          { label: 'Open Backlog', value: fmt(d.total_open) },
          { label: 'Cancelled', value: fmt(d.total_cancelled) },
          { label: 'Avg Days to Complete', value: fmtDays(d.avg_days_to_complete) },
          { label: 'Emergency Avg Days', value: fmtDays(d.avg_emergency_response_days) },
          { label: 'Assets Affected', value: fmt(d.total_assets_affected) },
        ],
        [
          {
            title: 'BY PRIORITY',
            headers: ['Priority', 'Created', 'Completed', 'Open'],
            rows: d.by_priority.map((b) => [capitalize(b.priority), fmt(b.created), fmt(b.completed), fmt(b.open)]),
          },
          {
            title: 'BY WORK TYPE',
            headers: ['Type', 'Count'],
            rows: d.by_work_type.map((b) => [capitalize(b.work_type), fmt(b.count)]),
          },
          {
            title: 'MONTHLY TREND',
            headers: ['Month', 'Created', 'Completed'],
            rows: d.by_month.map((b) => [b.month, fmt(b.created), fmt(b.completed)]),
          },
          {
            title: 'BY ASSIGNEE',
            headers: ['Crew Member', 'Completed', 'Open'],
            rows: d.by_assignee.map((b) => [b.user_name, fmt(b.completed), fmt(b.open)]),
          },
        ]
      );
      openPrintPreview(html, 'Work Order Report');
    }

    if (activeTab === 'inspections' && insp.data) {
      const d = insp.data;
      const html = generateReportPrintHtml(
        'INSPECTION REPORT',
        dateRange,
        [
          { label: 'Completed', value: fmt(d.total_completed) },
          { label: 'Open', value: fmt(d.total_open) },
          { label: 'Coverage Rate', value: fmtPct(d.coverage_rate) },
          { label: 'Signs Inspected', value: fmt(d.signs_inspected) },
          { label: 'Follow-up Rate', value: fmtPct(d.follow_up_rate) },
          { label: 'Retro Pass Rate', value: fmtPct(d.retro_pass_rate) },
          { label: 'Avg Condition', value: d.avg_condition_rating !== null ? d.avg_condition_rating.toFixed(1) : '--' },
        ],
        [
          {
            title: 'CONDITION DISTRIBUTION',
            headers: ['Rating', 'Count'],
            rows: d.condition_distribution.map((b) => [
              b.rating !== null ? (CONDITION_RATING_LABELS[b.rating] || `${b.rating}`) : 'Unrated',
              fmt(b.count),
            ]),
          },
          {
            title: 'BY TYPE',
            headers: ['Type', 'Count'],
            rows: d.by_type.map((b) => [capitalize(b.inspection_type), fmt(b.count)]),
          },
          {
            title: 'MONTHLY TREND',
            headers: ['Month', 'Completed'],
            rows: d.by_month.map((b) => [b.month, fmt(b.completed)]),
          },
          {
            title: 'BY INSPECTOR',
            headers: ['Inspector', 'Completed'],
            rows: d.by_inspector.map((b) => [b.user_name, fmt(b.completed)]),
          },
        ]
      );
      openPrintPreview(html, 'Inspection Report');
    }

    if (activeTab === 'inventory' && inv.data) {
      const d = inv.data;
      const html = generateReportPrintHtml(
        'INVENTORY HEALTH REPORT',
        `As of ${formatDateDisplay(d.as_of_date)}`,
        [
          { label: 'Total Signs', value: fmt(d.total_signs) },
          { label: 'Total Supports', value: fmt(d.total_supports) },
          { label: 'Compliance Rate', value: fmtPct(d.compliance_rate) },
          { label: 'Overdue Replacement', value: fmt(d.overdue_for_replacement) },
          { label: 'Due in 90 Days', value: fmt(d.due_within_90_days) },
          { label: 'Due in 1 Year', value: fmt(d.due_within_1_year) },
          { label: 'Est. Replacement Cost', value: fmtDollars(d.estimated_replacement_cost) },
          { label: 'Added (30d)', value: fmt(d.signs_added_last_30) },
          { label: 'Removed (30d)', value: fmt(d.signs_removed_last_30) },
        ],
        [
          {
            title: 'CONDITION DISTRIBUTION',
            headers: ['Condition', 'Count'],
            rows: d.condition_distribution.map((b) => [b.label, fmt(b.count)]),
          },
          {
            title: 'STATUS DISTRIBUTION',
            headers: ['Status', 'Count'],
            rows: d.status_distribution.map((b) => [capitalize(b.status), fmt(b.count)]),
          },
          {
            title: 'AGE DISTRIBUTION',
            headers: ['Range', 'Count'],
            rows: d.age_distribution.map((b) => [b.range, fmt(b.count)]),
          },
          {
            title: 'SHEETING TYPE',
            headers: ['Type', 'Count'],
            rows: d.sheeting_distribution.map((b) => [b.sheeting_type, fmt(b.count)]),
          },
        ]
      );
      openPrintPreview(html, 'Inventory Health Report');
    }

    if (activeTab === 'crew' && crew.data) {
      const d = crew.data;
      const sorted = [...d.crew_stats].sort((a, b) => b.wos_completed - a.wos_completed);
      const html = generateReportPrintHtml(
        'CREW PRODUCTIVITY REPORT',
        dateRange,
        [
          { label: 'Crew Members', value: fmt(sorted.length) },
          { label: 'Total WOs Completed', value: fmt(sorted.reduce((s, c) => s + c.wos_completed, 0)) },
          { label: 'Total Inspections', value: fmt(sorted.reduce((s, c) => s + c.inspections_completed, 0)) },
        ],
        [
          {
            title: 'CREW MEMBER DETAILS',
            headers: ['Name', 'Role', 'WOs Assigned', 'WOs Completed', 'Avg Days', 'Inspections', 'Signs Inspected'],
            rows: sorted.map((m) => [
              m.user_name,
              capitalize(m.role),
              fmt(m.wos_assigned),
              fmt(m.wos_completed),
              fmtDays(m.avg_days_to_complete),
              fmt(m.inspections_completed),
              fmt(m.signs_inspected),
            ]),
          },
        ]
      );
      openPrintPreview(html, 'Crew Productivity Report');
    }
  }, [activeTab, startDate, endDate, wo.data, insp.data, inv.data, crew.data]);

  const isReady =
    (activeTab === 'work-orders' && !!wo.data) ||
    (activeTab === 'inspections' && !!insp.data) ||
    (activeTab === 'inventory' && !!inv.data) ||
    (activeTab === 'crew' && !!crew.data);

  return { print, isReady };
}

// ---------------------------------------------------------------------------
// Main ReportsPage
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('work-orders');
  const [startDate, setStartDate] = useState(() => daysAgoISO(30));
  const [endDate, setEndDate] = useState(() => todayISO());
  const [activePreset, setActivePreset] = useState<PresetId | null>('30d');

  const handlePreset = (id: PresetId) => {
    const [s, e] = applyPreset(id);
    setStartDate(s);
    setEndDate(e);
    setActivePreset(id);
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') setStartDate(value);
    else setEndDate(value);
    setActivePreset(null);
  };

  const { print, isReady: printReady } = usePrintReport(activeTab, startDate, endDate);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileBarChart size={24} className="text-blue-600" />
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Operational KPIs, crew performance, and status reports</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={print}
              disabled={!printReady}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer size={14} />
              Print Report
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date range controls (hidden for inventory tab which uses as_of_date) */}
        {activeTab !== 'inventory' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <label className="text-xs text-gray-500">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePreset(p.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      activePreset === p.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'work-orders' && <WorkOrdersTab startDate={startDate} endDate={endDate} />}
        {activeTab === 'inspections' && <InspectionsTab startDate={startDate} endDate={endDate} />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'crew' && <CrewProductivityTab startDate={startDate} endDate={endDate} />}
      </div>
    </div>
  );
}
