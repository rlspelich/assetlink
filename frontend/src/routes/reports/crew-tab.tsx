import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Eye,
  CheckCircle,
  TrendingUp,
  Award,
  ChevronDown,
} from 'lucide-react';
import { useCrewProductivityReport } from '../../hooks/use-reports';
import { useWorkOrdersList } from '../../hooks/use-work-orders';
import { useInspectionsList } from '../../hooks/use-inspections';
import { fmt, fmtDays, capitalize } from './report-utils';
import type { DateRangeProps } from './report-utils';
import {
  KpiCard,
  ReportSkeleton,
  ReportError,
} from './report-components';

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
                    <td className="px-3 py-1.5 text-gray-500">{wo.created_at ? new Date(wo.created_at).toLocaleDateString() : '\u2014'}</td>
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
                    <td className="px-3 py-1.5 text-gray-500">{insp.inspection_date || '\u2014'}</td>
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
// Crew Productivity Tab
// ---------------------------------------------------------------------------

export function CrewProductivityTab({ startDate, endDate }: DateRangeProps) {
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
