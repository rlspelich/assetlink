import { useMemo } from 'react';
import {
  BarChart3,
  Shield,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useInventoryReport } from '../../hooks/use-reports';
import { CONDITION_COLORS, UNRATED_COLOR } from '../../lib/constants';
import { fmt, fmtPct } from './report-utils';
import {
  KpiCard,
  HorizontalBarChart,
  ReportSkeleton,
  ReportError,
} from './report-components';
import type { BarItem } from './report-components';
import { capitalize } from './report-utils';

// ---------------------------------------------------------------------------
// Constants
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

// ---------------------------------------------------------------------------
// Inventory Tab
// ---------------------------------------------------------------------------

export function InventoryTab() {
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
