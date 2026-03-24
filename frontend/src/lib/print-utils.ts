import type { WorkOrder, Inspection } from '../api/types';
import { formatEnumLabel } from './constants';

// --- Shared helpers ---

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDatePrint(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTimePrint(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
    margin: 0.5in;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
  }
  .header-title {
    font-size: 18pt;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .header-number {
    font-size: 18pt;
    font-weight: bold;
    text-align: right;
  }
  .header-sub {
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    color: #444;
    margin-bottom: 8px;
  }
  .divider {
    border: none;
    border-top: 1px solid #000;
    margin: 8px 0;
  }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .section {
    margin-bottom: 2px;
  }
  .field-row {
    display: flex;
    gap: 24px;
    margin-bottom: 2px;
    font-size: 11pt;
  }
  .field-row .label {
    font-weight: bold;
    white-space: nowrap;
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 24px;
  }
  .text-block {
    font-size: 11pt;
    white-space: pre-wrap;
    margin-top: 2px;
    padding: 4px 0;
  }
  .asset-item {
    margin-bottom: 4px;
    font-size: 11pt;
  }
  .asset-item .checkbox {
    font-family: 'DejaVu Sans', Arial, sans-serif;
  }
  .blank-field {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
    font-size: 11pt;
  }
  .blank-field .label {
    font-weight: bold;
    white-space: nowrap;
  }
  .blank-line {
    flex: 1;
    border-bottom: 1px solid #000;
    min-width: 100px;
  }
  .full-blank-line {
    border-bottom: 1px solid #000;
    height: 18px;
    margin-bottom: 8px;
  }
  .crew-section {
    margin-top: 12px;
  }
  .crew-section .section-title {
    margin-bottom: 8px;
  }
  .condition-circles {
    font-family: 'DejaVu Sans', Arial, sans-serif;
    font-size: 11pt;
  }
  @media print {
    body { margin: 0.5in; }
  }
`;

// --- Work Order Print HTML ---

export function generateWorkOrderPrintHtml(wo: WorkOrder): string {
  const woNumber = wo.work_order_number || 'Work Order';
  const priority = formatEnumLabel(wo.priority);
  const status = formatEnumLabel(wo.status);
  const workType = formatEnumLabel(wo.work_type);
  const created = formatDatePrint(wo.created_at);
  const due = formatDatePrint(wo.due_date);
  const assigned = wo.assigned_to ? wo.assigned_to : '\u2014';

  let assetsHtml = '';
  if (wo.assets && wo.assets.length > 0) {
    assetsHtml = wo.assets
      .map((a) => {
        const label = a.asset_label || `${formatEnumLabel(a.asset_type)} ${a.asset_id.slice(0, 8)}`;
        const action = a.action_required ? formatEnumLabel(a.action_required) : '\u2014';
        const notes = a.damage_notes || '\u2014';
        return `<div class="asset-item">
  <span class="checkbox">\u25A1</span> ${escapeHtml(label)} &mdash; Action: ${escapeHtml(action)}
  <br>&nbsp;&nbsp;&nbsp;Notes: ${escapeHtml(notes)}
</div>`;
      })
      .join('\n');
  }

  const description = wo.description
    ? `<div class="section">
        <hr class="divider">
        <div class="section-title">DESCRIPTION</div>
        <div class="text-block">${escapeHtml(wo.description)}</div>
      </div>`
    : '';

  const address = wo.address || wo.location_notes;
  const locationSection = address
    ? `<div class="section">
        <hr class="divider">
        <div class="section-title">LOCATION</div>
        ${wo.address ? `<div class="field-row"><span class="label">Address:</span> ${escapeHtml(wo.address)}</div>` : ''}
        ${wo.location_notes ? `<div class="text-block">${escapeHtml(wo.location_notes)}</div>` : ''}
      </div>`
    : '';

  const assetsSection =
    assetsHtml
      ? `<div class="section">
          <hr class="divider">
          <div class="section-title">AFFECTED ASSETS</div>
          ${assetsHtml}
        </div>`
      : '';

  const instructionsSection = wo.instructions
    ? `<div class="section">
        <hr class="divider">
        <div class="section-title">INSTRUCTIONS</div>
        <div class="text-block">${escapeHtml(wo.instructions)}</div>
      </div>`
    : '';

  const notesSection = wo.notes
    ? `<div class="section">
        <hr class="divider">
        <div class="section-title">NOTES</div>
        <div class="text-block">${escapeHtml(wo.notes)}</div>
      </div>`
    : '';

  return `
    <div class="header">
      <div class="header-title">WORK ORDER</div>
      <div class="header-number">${escapeHtml(woNumber)}</div>
    </div>
    <div class="header-sub">
      <div>AssetLink</div>
      <div>${todayFormatted()}</div>
    </div>
    <hr class="divider">
    <div class="field-grid">
      <div class="field-row"><span class="label">Priority:</span> ${escapeHtml(priority)}</div>
      <div class="field-row"><span class="label">Status:</span> ${escapeHtml(status)}</div>
      <div class="field-row"><span class="label">Work Type:</span> ${escapeHtml(workType)}</div>
      <div class="field-row"><span class="label">Created:</span> ${escapeHtml(created)}</div>
      <div class="field-row"><span class="label">Due Date:</span> ${escapeHtml(due)}</div>
      <div class="field-row"><span class="label">Assigned To:</span> ${escapeHtml(assigned)}</div>
    </div>
    ${description}
    ${locationSection}
    ${assetsSection}
    ${instructionsSection}
    ${notesSection}
    <div class="crew-section">
      <hr class="divider">
      <div class="section-title">FIELD COMPLETION (to be filled by crew)</div>
      <div style="margin-top: 12px;">
        <div class="blank-field">
          <span class="label">Work Completed:</span>
          <span>____/____/________</span>
        </div>
        <div class="blank-field">
          <span class="label">Materials Used:</span>
          <span class="blank-line"></span>
        </div>
        <div class="full-blank-line"></div>
        <div class="blank-field">
          <span class="label">Crew Notes:</span>
          <span class="blank-line"></span>
        </div>
        <div class="full-blank-line"></div>
        <div class="full-blank-line"></div>
        <div class="blank-field">
          <span class="label">Crew Lead Signature:</span>
          <span class="blank-line"></span>
        </div>
      </div>
    </div>
  `;
}

// --- Inspection Print HTML ---

export function generateInspectionPrintHtml(insp: Inspection): string {
  const inspNumber = insp.inspection_number || 'Inspection';
  const typeLabel = formatEnumLabel(insp.inspection_type);
  const statusLabel = formatEnumLabel(insp.status);
  const inspDate = formatDatePrint(insp.inspection_date);
  const conditionStr = insp.condition_rating ? `${insp.condition_rating}/5` : '\u2014';

  let assetsHtml = '';
  if (insp.assets && insp.assets.length > 0) {
    assetsHtml = insp.assets
      .map((ia) => {
        const label = ia.asset_label || formatEnumLabel(ia.asset_type);
        const conditionCircles = [1, 2, 3, 4, 5]
          .map((n) => {
            const filled = ia.condition_rating === n;
            return filled ? `<strong>${n}</strong>` : `\u25CB${n}`;
          })
          .join(' ');
        const action = ia.action_recommended ? formatEnumLabel(ia.action_recommended) : '\u2014';
        const findings = ia.findings || '\u2014';

        let retroLine = '';
        if (ia.retroreflectivity_value !== null && ia.retroreflectivity_value !== undefined) {
          const passes =
            ia.passes_minimum_retro === true
              ? 'Yes'
              : ia.passes_minimum_retro === false
                ? 'No'
                : '\u2014';
          retroLine = `
  <br>&nbsp;&nbsp;Retro Reading: ${ia.retroreflectivity_value} mcd/lux/m\u00B2
  <br>&nbsp;&nbsp;Passes Minimum: ${passes}`;
        }

        return `<div class="asset-item" style="margin-bottom: 8px;">
  <strong>Asset:</strong> ${escapeHtml(label)}
  <br>&nbsp;&nbsp;Condition: <span class="condition-circles">${conditionCircles}</span>
  ${retroLine}
  <br>&nbsp;&nbsp;Findings: ${escapeHtml(findings)}
  <br>&nbsp;&nbsp;Action: ${escapeHtml(action)}
</div>`;
      })
      .join('\n');
  }

  const assetsSection = assetsHtml
    ? `<div class="section">
        <hr class="divider">
        <div class="section-title">INSPECTED ASSETS</div>
        ${assetsHtml}
      </div>`
    : '';

  const findingsSection = insp.findings
    ? `<div class="section">
        <hr class="divider">
        <div class="section-title">OVERALL FINDINGS</div>
        <div class="text-block">${escapeHtml(insp.findings)}</div>
      </div>`
    : '';

  const recsSection = insp.recommendations
    ? `<div class="section">
        <hr class="divider">
        <div class="section-title">RECOMMENDATIONS</div>
        <div class="text-block">${escapeHtml(insp.recommendations)}</div>
      </div>`
    : '';

  const followUpRequired = insp.follow_up_required ? 'Yes' : 'No';
  const linkedWO = insp.follow_up_work_order_id
    ? insp.follow_up_work_order_id.slice(0, 8) + '...'
    : '\u2014';

  return `
    <div class="header">
      <div class="header-title">INSPECTION</div>
      <div class="header-number">${escapeHtml(inspNumber)}</div>
    </div>
    <div class="header-sub">
      <div>AssetLink</div>
      <div>${todayFormatted()}</div>
    </div>
    <hr class="divider">
    <div class="field-grid">
      <div class="field-row"><span class="label">Type:</span> ${escapeHtml(typeLabel)}</div>
      <div class="field-row"><span class="label">Status:</span> ${escapeHtml(statusLabel)}</div>
      <div class="field-row"><span class="label">Date:</span> ${escapeHtml(inspDate)}</div>
      <div class="field-row"><span class="label">Overall Condition:</span> ${escapeHtml(conditionStr)}</div>
    </div>
    ${assetsSection}
    ${findingsSection}
    ${recsSection}
    <div class="section">
      <hr class="divider">
      <div class="section-title">FOLLOW-UP</div>
      <div class="field-row"><span class="label">Required:</span> ${followUpRequired}</div>
      <div class="field-row"><span class="label">Work Order:</span> ${linkedWO}</div>
    </div>
  `;
}

// --- Print via hidden iframe (no popup blocker issues) ---

export function openPrintWindow(html: string, title: string): void {
  // Create a hidden iframe for printing — avoids popup blockers entirely
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '800px';
  iframe.style.height = '1000px';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>${html}</body>
</html>`);
  doc.close();

  // Wait for content to render, then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback: open in new tab if iframe print fails
      const blob = new Blob([doc.documentElement.outerHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    // Clean up iframe after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
}

// --- Print preview (renders inline for environments where print isn't available) ---

export function openPrintPreview(html: string, title: string): void {
  // Create a full-screen overlay with the print content
  const overlay = document.createElement('div');
  overlay.id = 'print-preview-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

  const container = document.createElement('div');
  container.style.cssText = 'background:white;width:800px;max-height:90vh;overflow-y:auto;border-radius:8px;box-shadow:0 25px 50px rgba(0,0,0,0.25);position:relative;';

  // Close button bar
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'position:sticky;top:0;background:white;border-bottom:1px solid #e5e7eb;padding:8px 16px;display:flex;justify-content:space-between;align-items:center;z-index:1;';
  toolbar.innerHTML = `
    <span style="font-size:14px;font-weight:600;color:#111827;">Print Preview — ${escapeHtml(title)}</span>
    <div style="display:flex;gap:8px;">
      <button id="print-preview-print" style="padding:4px 12px;font-size:12px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer;">Print</button>
      <button id="print-preview-close" style="padding:4px 12px;font-size:12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;">Close</button>
    </div>
  `;

  const content = document.createElement('div');
  content.style.cssText = 'padding:40px;';
  content.innerHTML = `<style>${PRINT_STYLES}</style>${html}`;

  container.appendChild(toolbar);
  container.appendChild(content);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Event handlers
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
  document.getElementById('print-preview-close')?.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  document.getElementById('print-preview-print')?.addEventListener('click', () => {
    openPrintWindow(html, title);
  });
}

// --- Email HTML generators (adds email wrapper around print content) ---

export function generateWorkOrderEmailHtml(wo: WorkOrder, customMessage?: string): string {
  const body = generateWorkOrderPrintHtml(wo);
  return wrapEmailHtml(body, customMessage);
}

export function generateInspectionEmailHtml(insp: Inspection, customMessage?: string): string {
  const body = generateInspectionPrintHtml(insp);
  return wrapEmailHtml(body, customMessage);
}

function wrapEmailHtml(bodyContent: string, customMessage?: string): string {
  const messageBlock = customMessage
    ? `<div style="background: #f0f4ff; border-left: 3px solid #3b82f6; padding: 12px 16px; margin-bottom: 16px; font-family: Arial, sans-serif; font-size: 14px; color: #1e3a5f;">
        ${escapeHtml(customMessage)}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    max-width: 700px;
    margin: 0 auto;
    padding: 24px;
  }
  ${PRINT_STYLES}
  .email-footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #ddd;
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #888;
  }
</style>
</head>
<body>
  ${messageBlock}
  ${bodyContent}
  <div class="email-footer">
    Sent from AssetLink &mdash; Municipal Asset Management
  </div>
</body>
</html>`;
}
