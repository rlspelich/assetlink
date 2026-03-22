/**
 * Inspection Print Component
 *
 * Not rendered in the UI — generates print-optimized HTML and opens
 * a new window with window.print(). Designed for 8.5x11 paper.
 *
 * Layout: monospaced, black-on-white, condition rating circles,
 * retro readings, follow-up status.
 */

import type { Inspection } from '../../api/types';
import { generateInspectionPrintHtml, openPrintWindow } from '../../lib/print-utils';

export function printInspection(insp: Inspection): void {
  const html = generateInspectionPrintHtml(insp);
  const title = insp.inspection_number || 'Inspection';
  openPrintWindow(html, title);
}
