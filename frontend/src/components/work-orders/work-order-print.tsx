/**
 * Work Order Print Component
 *
 * Not rendered in the UI — generates print-optimized HTML and opens
 * a new window with window.print(). Designed for 8.5x11 paper.
 *
 * Layout: monospaced, black-on-white, checkboxes for field crew,
 * blank lines for crew completion notes and signature.
 */

import type { WorkOrder } from '../../api/types';
import { generateWorkOrderPrintHtml, openPrintWindow } from '../../lib/print-utils';

export function printWorkOrder(wo: WorkOrder): void {
  const html = generateWorkOrderPrintHtml(wo);
  const title = wo.work_order_number || 'Work Order';
  openPrintWindow(html, title);
}
