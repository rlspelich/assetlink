// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function startOfQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1).toISOString().slice(0, 10);
}

export function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function lastYearRange(): [string, string] {
  const y = new Date().getFullYear() - 1;
  return [`${y}-01-01`, `${y}-12-31`];
}

export function formatDateDisplay(iso: string): string {
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

export function fmt(n: number): string {
  return n.toLocaleString();
}

export function fmtPct(n: number | null): string {
  if (n === null) return '--';
  return `${n.toFixed(1)}%`;
}

export function fmtDays(n: number | null): string {
  if (n === null) return '--';
  return `${n.toFixed(1)}`;
}

export function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type PresetId = '7d' | '30d' | 'quarter' | 'year' | 'last-year';

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'year', label: 'This Year' },
  { id: 'last-year', label: 'Last Year' },
];

export function applyPreset(id: PresetId): [string, string] {
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
// Tab type
// ---------------------------------------------------------------------------

export type TabId = 'work-orders' | 'inspections' | 'inventory' | 'crew';

// ---------------------------------------------------------------------------
// Shared props for tab components
// ---------------------------------------------------------------------------

export interface DateRangeProps {
  startDate: string;
  endDate: string;
}
