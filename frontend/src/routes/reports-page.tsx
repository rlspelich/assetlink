import React, { useState } from 'react';
import {
  Printer,
  ClipboardList,
  Eye,
  Users,
  Package,
  Calendar,
} from 'lucide-react';
import {
  todayISO,
  daysAgoISO,
  PRESETS,
  applyPreset,
} from './reports/report-utils';
import type { TabId, PresetId } from './reports/report-utils';
import { WorkOrdersTab } from './reports/work-orders-tab';
import { InspectionsTab } from './reports/inspections-tab';
import { InventoryTab } from './reports/inventory-tab';
import { CrewProductivityTab } from './reports/crew-tab';
import { usePrintReport } from './reports/use-print-report';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'work-orders', label: 'Work Orders', icon: <ClipboardList size={15} /> },
  { id: 'inspections', label: 'Inspections', icon: <Eye size={15} /> },
  { id: 'inventory', label: 'Inventory', icon: <Package size={15} /> },
  { id: 'crew', label: 'Crew Productivity', icon: <Users size={15} /> },
];

// ---------------------------------------------------------------------------
// Main ReportsPage
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('work-orders');
  const [startDate, setStartDate] = useState(() => daysAgoISO(30));
  const [endDate, setEndDate] = useState(() => todayISO());
  const [activePreset, setActivePreset] = useState<PresetId | null>('30d');

  const handlePreset = (id: PresetId) => {
    const [s, e] = applyPreset(id);
    setStartDate(s);
    setEndDate(e);
    setActivePreset(id);
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') setStartDate(value);
    else setEndDate(value);
    setActivePreset(null);
  };

  const { print, isReady: printReady } = usePrintReport(activeTab, startDate, endDate);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Full-width header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Dashboard</h2>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={print}
          disabled={!printReady}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Printer size={14} />
          Print Report
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* Date range controls (hidden for inventory tab which uses as_of_date) */}
        {activeTab !== 'inventory' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <label className="text-xs text-gray-500">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePreset(p.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      activePreset === p.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'work-orders' && <WorkOrdersTab startDate={startDate} endDate={endDate} />}
        {activeTab === 'inspections' && <InspectionsTab startDate={startDate} endDate={endDate} />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'crew' && <CrewProductivityTab startDate={startDate} endDate={endDate} />}
      </div>
      </div>
    </div>
  );
}
