/**
 * Work Order Print
 *
 * Generates print-optimized HTML and prints via hidden iframe.
 * Falls back to print preview overlay if iframe print fails.
 */

import type { WorkOrder } from '../../api/types';
import { generateWorkOrderPrintHtml, openPrintWindow, openPrintPreview } from '../../lib/print-utils';

export function printWorkOrder(wo: WorkOrder): void {
  const html = generateWorkOrderPrintHtml(wo);
  const title = wo.work_order_number || 'Work Order';
  openPrintWindow(html, title);
}

export function previewWorkOrder(wo: WorkOrder): void {
  const html = generateWorkOrderPrintHtml(wo);
  const title = wo.work_order_number || 'Work Order';
  openPrintPreview(html, title);
}
