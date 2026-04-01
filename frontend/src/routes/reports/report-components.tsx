import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { fmt } from './report-utils';

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  borderColor: string;
  icon: React.ReactNode;
  alert?: boolean;
}

export function KpiCard({ title, value, subtitle, borderColor, icon, alert }: KpiCardProps) {
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

export interface BarItem {
  label: string;
  count: number;
  color: string;
}

export function HorizontalBarChart({ items, title }: { items: BarItem[]; title: string }) {
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
// Dual Bar Chart (created + completed side by side)
// ---------------------------------------------------------------------------

export function DualBarChart({
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

export interface Column<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  highlight?: (row: T) => boolean;
}

export function DataTable<T>({
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

export function ReportSkeleton() {
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

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
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
