import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  Shield,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useInspectionReport } from '../../hooks/use-reports';
import { useInspectionsList } from '../../hooks/use-inspections';
import { useUsersList } from '../../hooks/use-users';
import {
  CONDITION_COLORS,
  UNRATED_COLOR,
  getInspectionTypeOption,
  getInspectionStatusOption,
} from '../../lib/constants';
import type { Inspection, InspectorBucket } from '../../api/types';
import { fmt, fmtPct, capitalize, formatDateDisplay } from './report-utils';
import type { DateRangeProps } from './report-utils';
import {
  KpiCard,
  HorizontalBarChart,
  DataTable,
  ReportSkeleton,
  ReportError,
} from './report-components';
import type { BarItem } from './report-components';

// ---------------------------------------------------------------------------
// Constants
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
type SortDirection = 'asc' | 'desc';

const INSP_LIST_STATUS_ORDER: Record<string, number> = {
  open: 0, in_progress: 1, completed: 2, cancelled: 3,
};

function InspectionStatusList({ startDate, endDate }: DateRangeProps) {
  const INSP_LIST_PAGE_SIZE = 25;
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InspListFilter>('all');
  const [sortField, setSortField] = useState<InspListSortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  const { data: inspData, isLoading } = useInspectionsList({ page_size: 500 });
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

  const inspTotalPages = Math.ceil(sorted.length / INSP_LIST_PAGE_SIZE);
  const inspPaged = sorted.slice(page * INSP_LIST_PAGE_SIZE, (page + 1) * INSP_LIST_PAGE_SIZE);

  // Reset page when filter/data changes
  useEffect(() => { setPage(0); }, [filter, startDate, endDate]);

  const handleSort = (field: InspListSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
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
                {inspPaged.map((insp) => {
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
          {inspTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-2 border-t border-gray-100 text-xs text-gray-600">
              <span>{sorted.length} inspections</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>Page {page + 1} of {inspTotalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(inspTotalPages - 1, p + 1))}
                  disabled={page >= inspTotalPages - 1}
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
// Inspections Tab
// ---------------------------------------------------------------------------

export function InspectionsTab({ startDate, endDate }: DateRangeProps) {
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
