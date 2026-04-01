import { useMemo, useCallback } from 'react';
import {
  useWorkOrderReport,
  useInspectionReport,
  useInventoryReport,
  useCrewProductivityReport,
} from '../../hooks/use-reports';
import { openPrintPreview } from '../../lib/print-utils';
import { fmt, fmtPct, fmtDays, fmtDollars, capitalize, formatDateDisplay } from './report-utils';
import type { TabId } from './report-utils';

// ---------------------------------------------------------------------------
// Print HTML generator
// ---------------------------------------------------------------------------

export function generateReportPrintHtml(
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
// Condition rating labels (needed for inspection print)
// ---------------------------------------------------------------------------

const CONDITION_RATING_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

// ---------------------------------------------------------------------------
// usePrintReport hook
// ---------------------------------------------------------------------------

export function usePrintReport(
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
