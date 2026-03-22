/**
 * Inspection Print
 *
 * Generates print-optimized HTML and prints via hidden iframe.
 * Falls back to print preview overlay if iframe print fails.
 */

import type { Inspection } from '../../api/types';
import { generateInspectionPrintHtml, openPrintWindow, openPrintPreview } from '../../lib/print-utils';

export function printInspection(insp: Inspection): void {
  const html = generateInspectionPrintHtml(insp);
  const title = insp.inspection_number || 'Inspection';
  openPrintWindow(html, title);
}

export function previewInspection(insp: Inspection): void {
  const html = generateInspectionPrintHtml(insp);
  const title = insp.inspection_number || 'Inspection';
  openPrintPreview(html, title);
}
