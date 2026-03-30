/**
 * Export utilities for CSV and TXT file downloads.
 *
 * Engineers prefer CSV (opens in Excel) for tabular data
 * and TXT for summary reports (easy to paste into emails).
 */

/**
 * Download a CSV file from an array of objects.
 * Columns are auto-detected from the first row's keys, or specified explicitly.
 */
export function downloadCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns?: { key: string; header: string }[],
) {
  if (!data.length) return;

  const cols = columns || Object.keys(data[0]).map((k) => ({ key: k, header: k }));
  const header = cols.map((c) => `"${c.header}"`).join(',');
  const rows = data.map((row) =>
    cols.map((c) => {
      const val = row[c.key];
      if (val == null) return '';
      if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
      return String(val);
    }).join(',')
  );

  const csv = [header, ...rows].join('\r\n');
  _download(csv, filename, 'text/csv');
}

/**
 * Download a TXT summary report.
 */
export function downloadTXT(content: string, filename: string) {
  _download(content, filename, 'text/plain');
}

/**
 * Format a number as currency string for export (no $ symbol, just commas and 2 decimals).
 */
export function exportCurrency(value: number | null | undefined): string {
  if (value == null) return '';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a percentage for export.
 */
export function exportPct(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '';
  return value.toFixed(decimals) + '%';
}

function _download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
