import { useState, useRef, useEffect } from 'react';
import { Search, Filter, ChevronDown, AlertCircle } from 'lucide-react';
import type { Inspection } from '../../api/types';
import {
  INSPECTION_TYPE_OPTIONS,
  INSPECTION_STATUS_OPTIONS,
  CONDITION_COLORS,
  UNRATED_COLOR,
  getInspectionTypeOption,
  getInspectionStatusOption,
  getInspectionMarkerColor,
} from '../../lib/constants';

interface InspectionListPanelProps {
  inspections: Inspection[];
  total: number;
  isLoading: boolean;
  selectedInspId: string | null;
  onInspSelect: (insp: Inspection) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  followUpFilter: string;
  onFollowUpFilterChange: (val: string) => void;
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

export function InspectionListPanel({
  inspections,
  total,
  isLoading,
  selectedInspId,
  onInspSelect,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  followUpFilter,
  onFollowUpFilterChange,
  searchQuery,
  onSearchChange,
}: InspectionListPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected inspection
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedInspId]);

  const hasActiveFilters = statusFilter || typeFilter || followUpFilter;

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Inspections</h3>
          <span className="text-xs text-gray-500">{total} total</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search INS #, findings..."
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
              {[statusFilter, typeFilter, followUpFilter].filter(Boolean).length}
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
              {INSPECTION_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All types</option>
              {INSPECTION_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={followUpFilter}
              onChange={(e) => onFollowUpFilterChange(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All follow-up</option>
              <option value="true">Follow-up Required</option>
              <option value="false">No Follow-up</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { onStatusFilterChange(''); onTypeFilterChange(''); onFollowUpFilterChange(''); }}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inspection list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading inspections...</div>
        ) : inspections.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {hasActiveFilters || searchQuery ? 'No inspections match filters' : 'No inspections yet'}
          </div>
        ) : (
          inspections.map((insp) => {
            const isSelected = insp.inspection_id === selectedInspId;
            const condColor = insp.condition_rating
              ? CONDITION_COLORS[insp.condition_rating]
              : UNRATED_COLOR;
            const typeOpt = getInspectionTypeOption(insp.inspection_type);
            const statusOpt = getInspectionStatusOption(insp.status);
            const assetCount = insp.assets?.length ?? 0;
            const markerColor = getInspectionMarkerColor(
              insp.follow_up_required,
              insp.follow_up_work_order_id,
              insp.status,
            );

            return (
              <div
                key={insp.inspection_id}
                ref={isSelected ? selectedRef : null}
                onClick={() => onInspSelect(insp)}
                className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: markerColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono font-semibold text-gray-900 truncate">
                        {insp.inspection_number || '\u2014'}
                      </span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${typeOpt.color}`}>
                        {typeOpt.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-500">{formatDate(insp.inspection_date)}</span>
                      {assetCount > 0 && (
                        <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
                          {assetCount} asset{assetCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px]"
                        style={{ color: condColor.hex }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: condColor.hex }} />
                        {insp.condition_rating ? `${insp.condition_rating}/5` : 'Unrated'}
                      </span>
                      {insp.follow_up_required && !insp.follow_up_work_order_id && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-red-600 font-medium">
                          <AlertCircle size={8} />
                          Follow-up
                        </span>
                      )}
                    </div>
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
