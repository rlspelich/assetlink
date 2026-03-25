import { useState, useRef, useEffect } from 'react';
import { Search, Filter, ChevronDown, User } from 'lucide-react';
import type { WorkOrder } from '../../api/types';
import { useUsersList } from '../../hooks/use-users';
import {
  WO_STATUS_OPTIONS,
  WO_PRIORITY_OPTIONS,
  WO_WORK_TYPE_OPTIONS,
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
  total,
  isLoading,
  selectedWOId,
  onWOSelect,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  workTypeFilter,
  onWorkTypeFilterChange,
  searchQuery,
  onSearchChange,
}: WorkOrderListPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
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

  const hasActiveFilters = statusFilter || priorityFilter || workTypeFilter;

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Work Orders</h3>
          <span className="text-xs text-gray-500">{total} total</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search WO #, description, address..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 mt-2 text-xs transition-colors ${
            hasActiveFilters ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Filter size={12} />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 text-[10px]">
              {[statusFilter, priorityFilter, workTypeFilter].filter(Boolean).length}
            </span>
          )}
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-2 space-y-2">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {WO_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => onPriorityFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All priorities</option>
              {WO_PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={workTypeFilter}
              onChange={(e) => onWorkTypeFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All types</option>
              {WO_WORK_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { onStatusFilterChange(''); onPriorityFilterChange(''); onWorkTypeFilterChange(''); }}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* WO list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading work orders...</div>
        ) : workOrders.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {hasActiveFilters || searchQuery ? 'No work orders match filters' : 'No work orders yet'}
          </div>
        ) : (
          workOrders.map((wo) => {
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
    </div>
  );
}
