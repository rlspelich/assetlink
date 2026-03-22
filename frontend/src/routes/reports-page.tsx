import { useState, useMemo, useCallback } from 'react';
import {
  FileBarChart,
  RefreshCw,
  Loader2,
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
} from 'lucide-react';
import {
  useWorkOrderReport,
  useInspectionReport,
  useInventoryReport,
  useCrewProductivityReport,
} from '../hooks/use-reports';
import { CONDITION_COLORS, UNRATED_COLOR, WO_PRIORITY_COLORS } from '../lib/constants';
import { openPrintPreview } from '../lib/print-utils';
import type {
  WorkOrderReport,
  InspectionReport,
  InventoryReport,
  CrewProductivityReport,
  PriorityBucket,
  MonthBucket,
  WorkTypeBucket,
  AssigneeBucket,
  StatusBucket,
  ConditionRatingBucket,
  InspectionMonthBucket,
  TypeBucket,
  InspectorBucket,
  ConditionBucket,
  AgeBucket,
  SheetingBucket,
  CrewMemberStats,
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
  accessor: (row: T) => string | number | null;
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

function WorkOrdersTab({
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
          items={d.by_month}
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
            { header: 'Crew Member', accessor: (r) => r.user_name },
            { header: 'Completed', accessor: (r) => fmt(r.completed), align: 'right' },
            { header: 'Open', accessor: (r) => fmt(r.open), align: 'right' },
          ]}
          emptyMessage="No work order assignments in this period"
        />
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

      {/* Replacement forecast */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Replacement Forecast</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Est. Total Cost</p>
            <p className="text-2xl font-bold text-gray-900">{fmtDollars(d.estimated_replacement_cost)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Within 1 year</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
            <p className="text-xs text-red-600 uppercase tracking-wide mb-1">Overdue</p>
            <p className="text-2xl font-bold text-red-700">{fmt(d.overdue_for_replacement)}</p>
            <p className="text-xs text-red-400 mt-0.5">Past due date</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-100">
            <p className="text-xs text-orange-600 uppercase tracking-wide mb-1">Due in 90 Days</p>
            <p className="text-2xl font-bold text-orange-700">{fmt(d.due_within_90_days)}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-100">
            <p className="text-xs text-yellow-600 uppercase tracking-wide mb-1">Due in 1 Year</p>
            <p className="text-2xl font-bold text-yellow-700">{fmt(d.due_within_1_year)}</p>
          </div>
        </div>
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
                {sorted.map((member, idx) => {
                  const isTop = member.user_id === topPerformerId && member.wos_completed > 0;
                  return (
                    <tr
                      key={member.user_id}
                      className={`transition-colors ${isTop ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-2.5 text-center">
                        {isTop ? (
                          <Award size={16} className="text-blue-600 inline" />
                        ) : (
                          <span className="text-xs text-gray-400">{idx + 1}</span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 whitespace-nowrap ${isTop ? 'font-semibold text-blue-800' : 'text-gray-900'}`}>
                        {member.user_name}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{capitalize(member.role)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt(member.wos_assigned)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt(member.wos_completed)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{fmtDays(member.avg_days_to_complete)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt(member.inspections_completed)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{fmt(member.signs_inspected)}</td>
                    </tr>
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
              Reports
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">KPI reports for budget justification and council presentations</p>
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
