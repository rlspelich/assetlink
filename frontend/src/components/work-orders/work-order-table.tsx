import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { WorkOrder } from '../../api/types';
import {
  getWoStatusOption,
  getWoPriorityOption,
  formatEnumLabel,
} from '../../lib/constants';

interface WorkOrderTableProps {
  workOrders: WorkOrder[];
  selectedWOId: string | null;
  onWOSelect: (wo: WorkOrder) => void;
}

type SortField = 'work_order_number' | 'priority' | 'status' | 'due_date' | 'created_at';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  routine: 2,
  planned: 3,
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  assigned: 1,
  in_progress: 2,
  on_hold: 3,
  completed: 4,
  cancelled: 5,
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

export function WorkOrderTable({ workOrders, selectedWOId, onWOSelect }: WorkOrderTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const selectedRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedWOId]);

  const sorted = useMemo(() => {
    const items = [...workOrders];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'work_order_number':
          cmp = (a.work_order_number ?? '').localeCompare(b.work_order_number ?? '');
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case 'due_date':
          cmp = (a.due_date ?? '').localeCompare(b.due_date ?? '');
          break;
        case 'created_at':
          cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [workOrders, sortField, sortDir]);

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

  if (workOrders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        No work orders match filters
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className={thClass('work_order_number')} onClick={() => handleSort('work_order_number')}>
              <span className="flex items-center gap-1">WO # <SortIcon field="work_order_number" /></span>
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Description
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Work Type
            </th>
            <th className={thClass('priority')} onClick={() => handleSort('priority')}>
              <span className="flex items-center gap-1">Priority <SortIcon field="priority" /></span>
            </th>
            <th className={thClass('status')} onClick={() => handleSort('status')}>
              <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Assets
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Assigned To
            </th>
            <th className={thClass('due_date')} onClick={() => handleSort('due_date')}>
              <span className="flex items-center gap-1">Due Date <SortIcon field="due_date" /></span>
            </th>
            <th className={thClass('created_at')} onClick={() => handleSort('created_at')}>
              <span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((wo) => {
            const isSelected = wo.work_order_id === selectedWOId;
            const priorityOpt = getWoPriorityOption(wo.priority);
            const statusOpt = getWoStatusOption(wo.status);
            const assetCount = wo.assets?.length ?? 0;
            const firstAssetLabel = wo.assets?.[0]?.asset_label;

            return (
              <tr
                key={wo.work_order_id}
                ref={isSelected ? selectedRef : null}
                onClick={() => onWOSelect(wo)}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
                  {wo.work_order_number || '\u2014'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate">
                  {wo.description || 'No description'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                  {formatEnumLabel(wo.work_type)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${priorityOpt.color}`}>
                    {priorityOpt.label}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusOpt.color}`}>
                    {statusOpt.label}
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
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                  {wo.assigned_to || <span className="text-gray-300">\u2014</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                  {wo.due_date ? formatShortDate(wo.due_date) : <span className="text-gray-300">\u2014</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(wo.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
