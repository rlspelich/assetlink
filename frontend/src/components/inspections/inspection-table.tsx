import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import type { Inspection } from '../../api/types';
import {
  CONDITION_COLORS,
  UNRATED_COLOR,
  getInspectionTypeOption,
  getInspectionStatusOption,
} from '../../lib/constants';

interface InspectionTableProps {
  inspections: Inspection[];
  selectedInspId: string | null;
  onInspSelect: (insp: Inspection) => void;
}

type SortField = 'inspection_number' | 'inspection_date' | 'condition_rating' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  in_progress: 1,
  completed: 2,
  cancelled: 3,
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
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

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function InspectionTable({ inspections, selectedInspId, onInspSelect }: InspectionTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const selectedRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedInspId]);

  const sorted = useMemo(() => {
    const items = [...inspections];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'inspection_number':
          cmp = (a.inspection_number ?? '').localeCompare(b.inspection_number ?? '');
          break;
        case 'inspection_date':
          cmp = (a.inspection_date ?? '').localeCompare(b.inspection_date ?? '');
          break;
        case 'condition_rating':
          cmp = (a.condition_rating ?? 0) - (b.condition_rating ?? 0);
          break;
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case 'created_at':
          cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [inspections, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="w-3" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-600" />
      : <ChevronDown size={12} className="text-blue-600" />;
  };

  const thClass = (field: SortField) =>
    `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap ${
      sortField === field ? 'text-blue-700' : 'text-gray-500'
    }`;

  if (inspections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        No inspections match filters
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className={thClass('inspection_number')} onClick={() => handleSort('inspection_number')}>
              <span className="flex items-center gap-1">INS # <SortIcon field="inspection_number" /></span>
            </th>
            <th className={thClass('inspection_date')} onClick={() => handleSort('inspection_date')}>
              <span className="flex items-center gap-1">Date <SortIcon field="inspection_date" /></span>
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Type
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Assets
            </th>
            <th className={thClass('condition_rating')} onClick={() => handleSort('condition_rating')}>
              <span className="flex items-center gap-1">Condition <SortIcon field="condition_rating" /></span>
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Follow-up
            </th>
            <th className={thClass('status')} onClick={() => handleSort('status')}>
              <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
            </th>
            <th className={thClass('created_at')} onClick={() => handleSort('created_at')}>
              <span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((insp) => {
            const isSelected = insp.inspection_id === selectedInspId;
            const typeOpt = getInspectionTypeOption(insp.inspection_type);
            const statusOpt = getInspectionStatusOption(insp.status);
            const condColor = insp.condition_rating
              ? CONDITION_COLORS[insp.condition_rating]
              : UNRATED_COLOR;
            const assetCount = insp.assets?.length ?? 0;
            const firstAssetLabel = insp.assets?.[0]?.asset_label;

            let followUpBadge: { label: string; classes: string };
            if (insp.follow_up_required && insp.follow_up_work_order_id) {
              followUpBadge = { label: 'WO Linked', classes: 'bg-blue-100 text-blue-800' };
            } else if (insp.follow_up_required) {
              followUpBadge = { label: 'Required', classes: 'bg-red-100 text-red-800' };
            } else {
              followUpBadge = { label: 'No', classes: 'bg-gray-100 text-gray-500' };
            }

            return (
              <tr
                key={insp.inspection_id}
                ref={isSelected ? selectedRef : null}
                onClick={() => onInspSelect(insp)}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                  {insp.inspection_number || '\u2014'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                  {formatShortDate(insp.inspection_date)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${typeOpt.color}`}>
                    {typeOpt.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                  {assetCount > 0 ? (
                    <span>
                      <span className="font-medium">{assetCount}</span>
                      {firstAssetLabel && (
                        <span className="text-gray-400 ml-1 truncate max-w-[100px] inline-block align-bottom">
                          {firstAssetLabel}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-300">\u2014</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-xs" style={{ color: condColor.hex }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: condColor.hex }} />
                    {insp.condition_rating ? `${insp.condition_rating}/5` : 'Unrated'}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${followUpBadge.classes}`}>
                    {insp.follow_up_required && !insp.follow_up_work_order_id && (
                      <AlertCircle size={9} />
                    )}
                    {followUpBadge.label}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusOpt.color}`}>
                    {statusOpt.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(insp.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
