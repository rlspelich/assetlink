import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle,
  Clock,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useWorkOrderReport } from '../../hooks/use-reports';
import { useWorkOrdersList } from '../../hooks/use-work-orders';
import { useUsersList } from '../../hooks/use-users';
import {
  WO_PRIORITY_COLORS,
  getWoStatusOption,
  getWoPriorityOption,
  formatEnumLabel,
} from '../../lib/constants';
import type { WorkOrder, AssigneeBucket } from '../../api/types';
import { fmt, fmtDays, capitalize, formatDateDisplay } from './report-utils';
import type { DateRangeProps } from './report-utils';
import {
  KpiCard,
  HorizontalBarChart,
  DualBarChart,
  DataTable,
  ReportSkeleton,
  ReportError,
} from './report-components';
import type { BarItem } from './report-components';

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

function WorkOrderStatusList({ startDate, endDate }: DateRangeProps) {
  const WO_LIST_PAGE_SIZE = 25;
  const navigate = useNavigate();
  const [filter, setFilter] = useState<WoListFilter>('all');
  const [sortField, setSortField] = useState<WoListSortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  const { data: woData, isLoading } = useWorkOrdersList({ page_size: 500 });
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

  const woTotalPages = Math.ceil(sorted.length / WO_LIST_PAGE_SIZE);
  const woPaged = sorted.slice(page * WO_LIST_PAGE_SIZE, (page + 1) * WO_LIST_PAGE_SIZE);

  // Reset page when filter/data changes
  useEffect(() => { setPage(0); }, [filter, startDate, endDate]);

  const handleSort = (field: WoListSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
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
                {woPaged.map((wo) => {
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
          {woTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-2 border-t border-gray-100 text-xs text-gray-600">
              <span>{sorted.length} work orders</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>Page {page + 1} of {woTotalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(woTotalPages - 1, p + 1))}
                  disabled={page >= woTotalPages - 1}
                  aria-label="Next page"
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work Orders Tab
// ---------------------------------------------------------------------------

export function WorkOrdersTab({ startDate, endDate }: DateRangeProps) {
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
