import { useNavigate } from 'react-router-dom';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  BarChart3,
  RefreshCw,
  DollarSign,
  Calendar,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { useComplianceDashboard } from '../hooks/use-dashboard';
import { CONDITION_COLORS, UNRATED_COLOR } from '../lib/constants';
import type {
  ComplianceDashboard,
  ConditionBucket,
  AgeBucket,
  SheetingBucket,
  CategoryBucket,
  PrioritySign,
} from '../api/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtDollarsFull(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(n: number | null): string {
  if (n === null) return '--';
  return `${n.toFixed(1)}%`;
}

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}yr ago`;
}

function conditionDot(rating: number | null): string {
  if (rating && CONDITION_COLORS[rating]) return CONDITION_COLORS[rating].hex;
  return UNRATED_COLOR.hex;
}

function conditionLabel(rating: number | null): string {
  if (rating && CONDITION_COLORS[rating]) return CONDITION_COLORS[rating].label;
  return 'Unrated';
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  borderColor: string; // tailwind border-l color class like 'border-blue-500'
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
// Horizontal Bar Chart
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
              <span className="w-24 text-xs text-gray-600 text-right shrink-0 truncate" title={item.label}>
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
// Priority Table
// ---------------------------------------------------------------------------

function PriorityTable({
  signs,
  onSignClick,
}: {
  signs: PrioritySign[];
  onSignClick: (id: string) => void;
}) {
  if (signs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <CheckCircle size={40} className="mx-auto text-green-500 mb-3" />
        <p className="text-lg font-medium text-gray-700">No signs require immediate attention</p>
        <p className="text-sm text-gray-400 mt-1">All signs are within acceptable parameters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Asset Tag
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                MUTCD
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Road
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Intersection
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Condition
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Retro
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Installed
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Days Overdue
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Est. Cost
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Score
              </th>
              <th className="px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {signs.map((sign) => {
              const rowBg =
                sign.priority_score > 80
                  ? 'bg-red-50 hover:bg-red-100'
                  : sign.priority_score > 50
                    ? 'bg-orange-50 hover:bg-orange-100'
                    : 'hover:bg-gray-50';
              return (
                <tr
                  key={sign.sign_id}
                  className={`${rowBg} cursor-pointer transition-colors`}
                  onClick={() => onSignClick(sign.sign_id)}
                >
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {sign.asset_tag || '--'}
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap font-mono text-xs">
                    {sign.mutcd_code || '--'}
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[140px] truncate" title={sign.road_name ?? ''}>
                    {sign.road_name || '--'}
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[120px] truncate" title={sign.intersection_with ?? ''}>
                    {sign.intersection_with || '--'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: conditionDot(sign.condition_rating) }}
                      title={conditionLabel(sign.condition_rating)}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        sign.status === 'missing'
                          ? 'bg-red-100 text-red-700'
                          : sign.status === 'damaged'
                            ? 'bg-orange-100 text-orange-700'
                            : sign.status === 'faded'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sign.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-mono text-xs">
                    {sign.measured_value !== null ? (
                      <span className={sign.passes_minimum === false ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                        {sign.measured_value.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">
                    {sign.install_date || '--'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {sign.days_overdue !== null && sign.days_overdue > 0 ? (
                      <span className="text-red-600 font-semibold text-xs">{fmt(sign.days_overdue)}d</span>
                    ) : sign.days_overdue !== null && sign.days_overdue <= 0 ? (
                      <span className="text-gray-400 text-xs">{Math.abs(sign.days_overdue)}d left</span>
                    ) : (
                      <span className="text-gray-400 text-xs">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-xs text-gray-700">
                    {sign.replacement_cost_estimate !== null
                      ? fmtDollars(sign.replacement_cost_estimate)
                      : '--'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span
                      className={`inline-block min-w-[28px] text-center px-1.5 py-0.5 text-xs font-bold rounded ${
                        sign.priority_score > 80
                          ? 'bg-red-600 text-white'
                          : sign.priority_score > 50
                            ? 'bg-orange-500 text-white'
                            : 'bg-yellow-400 text-yellow-900'
                      }`}
                    >
                      {sign.priority_score}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ArrowUpRight size={14} className="text-gray-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-80" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
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
// Empty State
// ---------------------------------------------------------------------------

function EmptyDashboard() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Sign Data Yet</h2>
        <p className="text-sm text-gray-400">
          Import signs via CSV or add them manually to populate the compliance dashboard.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, dataUpdatedAt, refetch, isFetching } =
    useComplianceDashboard();

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Failed to Load Dashboard</h2>
          <p className="text-sm text-gray-400 mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.total_signs === 0) return <EmptyDashboard />;

  const d = data;
  const problemSigns = d.signs_damaged + d.signs_missing + d.signs_faded;
  const totalInspected = d.total_signs - d.signs_never_inspected;
  const inspectionPct =
    d.total_signs > 0 ? ((totalInspected / d.total_signs) * 100).toFixed(0) : '0';

  const complianceBorder =
    d.compliance_rate === null
      ? 'border-gray-400'
      : d.compliance_rate >= 90
        ? 'border-green-500'
        : d.compliance_rate >= 70
          ? 'border-yellow-500'
          : 'border-red-500';

  const handleSignClick = (signId: string) => {
    // Navigate to signs page -- the sign ID is available for future deep-link support
    navigate('/signs', { state: { highlightSignId: signId } });
  };

  // Build chart data
  const conditionItems: BarItem[] = buildConditionBars(d.condition_distribution);
  const ageItems: BarItem[] = buildAgeBars(d.age_distribution);
  const sheetingItems: BarItem[] = d.sheeting_distribution.map((b) => ({
    label: b.sheeting_type,
    count: b.count,
    color: '#6366f1',
  }));
  const categoryItems: BarItem[] = d.category_distribution.map((b, i) => ({
    label: b.category.charAt(0).toUpperCase() + b.category.slice(1),
    count: b.count,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const currentYear = new Date().getFullYear();

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MUTCD Compliance Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Springfield DPW</p>
          </div>
          <div className="flex items-center gap-3">
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-gray-400">
                Updated {relativeDate(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isFetching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            title="Total Signs"
            value={fmt(d.total_signs)}
            subtitle={`${fmt(d.total_supports)} supports`}
            borderColor="border-blue-500"
            icon={<BarChart3 size={18} />}
          />
          <KpiCard
            title="Compliance Rate"
            value={pct(d.compliance_rate)}
            subtitle={
              d.compliance_rate !== null
                ? `${fmt(d.signs_passing_retro)} of ${fmt(d.signs_passing_retro + d.signs_failing_retro)} measured signs passing`
                : 'No retroreflectivity data'
            }
            borderColor={complianceBorder}
            icon={<Shield size={18} />}
          />
          <KpiCard
            title="Overdue Replacement"
            value={fmt(d.signs_overdue_replacement)}
            subtitle={`${fmt(d.signs_due_soon)} due within 90 days`}
            borderColor={d.signs_overdue_replacement > 0 ? 'border-red-500' : 'border-green-500'}
            icon={<Clock size={18} />}
            alert={d.signs_overdue_replacement > 0}
          />
          <KpiCard
            title="Failing Retro"
            value={fmt(d.signs_failing_retro)}
            subtitle={
              d.signs_retro_unknown > 0
                ? `${fmt(d.signs_retro_unknown)} never measured`
                : 'All measured signs checked'
            }
            borderColor={d.signs_failing_retro > 0 ? 'border-red-500' : 'border-green-500'}
            icon={<AlertTriangle size={18} />}
            alert={d.signs_failing_retro > 0}
          />
          <KpiCard
            title="Problem Signs"
            value={fmt(problemSigns)}
            subtitle={`${fmt(d.signs_damaged)} damaged, ${fmt(d.signs_missing)} missing, ${fmt(d.signs_faded)} faded`}
            borderColor={problemSigns > 0 ? 'border-red-500' : 'border-green-500'}
            icon={<AlertTriangle size={18} />}
            alert={problemSigns > 0}
          />
          <KpiCard
            title="Inspection Coverage"
            value={`${inspectionPct}%`}
            subtitle={`${fmt(d.signs_never_inspected)} never inspected`}
            borderColor="border-blue-500"
            icon={<Eye size={18} />}
          />
        </div>

        {/* Charts Row 1: Condition + Age */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HorizontalBarChart items={conditionItems} title="Condition Distribution" />
          <HorizontalBarChart items={ageItems} title="Sign Age Distribution" />
        </div>

        {/* Charts Row 2: Sheeting + Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HorizontalBarChart items={sheetingItems} title="Sheeting Type Distribution" />
          <HorizontalBarChart items={categoryItems} title="Category Breakdown" />
        </div>

        {/* Replacement Planning */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Replacement Planning</h3>
          </div>

          {d.estimated_replacement_cost > 0 ||
          d.replacements_this_year > 0 ||
          d.replacements_next_year > 0 ||
          d.replacements_year_after > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Estimated Total Cost
                </p>
                <p className="text-2xl font-bold text-gray-900" title={fmtDollarsFull(d.estimated_replacement_cost)}>
                  {fmtDollars(d.estimated_replacement_cost)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Critical/poor + overdue signs
                </p>
              </div>
              <TimelineCard
                label={`${currentYear}`}
                sublabel="This Year"
                count={d.replacements_this_year}
              />
              <TimelineCard
                label={`${currentYear + 1}`}
                sublabel="Next Year"
                count={d.replacements_next_year}
              />
              <TimelineCard
                label={`${currentYear + 2}`}
                sublabel="Year After"
                count={d.replacements_year_after}
              />
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">
                No replacement cost data. Add cost estimates and replacement dates to signs.
              </p>
            </div>
          )}
        </div>

        {/* Priority Table */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            Priority Signs — Immediate Attention Required
          </h3>
          <PriorityTable signs={d.priority_signs} onSignClick={handleSignClick} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TimelineCard({
  label,
  sublabel,
  count,
}: {
  label: string;
  sublabel: string;
  count: number;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{sublabel}</p>
      <p className="text-2xl font-bold text-gray-900">{fmt(count)}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart data builders
// ---------------------------------------------------------------------------

const CONDITION_ORDER: Array<{ rating: number | null; label: string; color: string }> = [
  { rating: 5, label: 'Excellent', color: CONDITION_COLORS[5].hex },
  { rating: 4, label: 'Good', color: CONDITION_COLORS[4].hex },
  { rating: 3, label: 'Fair', color: CONDITION_COLORS[3].hex },
  { rating: 2, label: 'Poor', color: CONDITION_COLORS[2].hex },
  { rating: 1, label: 'Critical', color: CONDITION_COLORS[1].hex },
  { rating: null, label: 'Unrated', color: UNRATED_COLOR.hex },
];

function buildConditionBars(distribution: ConditionBucket[]): BarItem[] {
  const map = new Map<number | null, number>();
  for (const b of distribution) map.set(b.rating, b.count);
  return CONDITION_ORDER.map((c) => ({
    label: c.label,
    count: map.get(c.rating) ?? 0,
    color: c.color,
  }));
}

const AGE_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#6b7280'];
const AGE_ORDER = ['0-2 years', '2-5 years', '5-10 years', '10-15 years', '15+ years', 'Unknown'];

function buildAgeBars(distribution: AgeBucket[]): BarItem[] {
  const map = new Map<string, number>();
  for (const b of distribution) map.set(b.range, b.count);
  return AGE_ORDER.map((r, i) => ({
    label: r,
    count: map.get(r) ?? 0,
    color: AGE_COLORS[i],
  }));
}

const CATEGORY_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#64748b',
];
