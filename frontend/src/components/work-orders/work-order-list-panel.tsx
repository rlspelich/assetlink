import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import type { WorkOrder } from '../../api/types';
import { useUsersList } from '../../hooks/use-users';
import {
  getWoStatusOption,
  getWoPriorityMarkerColor,
  formatEnumLabel,
} from '../../lib/constants';

interface WorkOrderListPanelProps {
  workOrders: WorkOrder[];
  total: number;
  isLoading: boolean;
  selectedWOId: string | null;
  onWOSelect: (wo: WorkOrder) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (priority: string) => void;
  workTypeFilter: string;
  onWorkTypeFilterChange: (workType: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function formatDate(dateStr: string | null): string {
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

export function WorkOrderListPanel({
  workOrders,
  isLoading,
  selectedWOId,
  onWOSelect,
  searchQuery,
}: WorkOrderListPanelProps) {
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);
  const { data: usersData } = useUsersList();
  const userMap = new Map(
    (usersData?.users ?? []).map((u) => [u.user_id, `${u.first_name} ${u.last_name}`])
  );

  // Auto-scroll to selected WO
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedWOId]);

  const totalPages = Math.ceil(workOrders.length / PAGE_SIZE);
  const paged = workOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when data changes
  useEffect(() => { setPage(0); }, [workOrders]);

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* WO list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading work orders...</div>
        ) : workOrders.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {searchQuery ? 'No work orders match filters' : 'No work orders yet'}
          </div>
        ) : (
          paged.map((wo) => {
            const isSelected = wo.work_order_id === selectedWOId;

            const statusOpt = getWoStatusOption(wo.status);
            return (
              <div
                key={wo.work_order_id}
                ref={isSelected ? selectedRef : null}
                onClick={() => onWOSelect(wo)}
                className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: getWoPriorityMarkerColor(wo.priority) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-semibold text-gray-900 truncate">
                        {wo.work_order_number || '\u2014'}
                      </span>
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ${statusOpt.color}`}>
                        {statusOpt.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 truncate">
                      {wo.description || 'No description'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{formatEnumLabel(wo.work_type)}</span>
                      {wo.due_date && (
                        <span className="text-[10px] text-gray-400">Due {formatDate(wo.due_date)}</span>
                      )}
                    </div>
                    {wo.assigned_to && userMap.get(wo.assigned_to) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <User size={9} className="text-gray-400" />
                        <span className="text-[10px] text-gray-500">{userMap.get(wo.assigned_to)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50 text-xs text-gray-600 shrink-0">
          <span>{workOrders.length}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={12} />
            </button>
            <span>{page + 1}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
