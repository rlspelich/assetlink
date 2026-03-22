import { useState } from 'react';
import { Settings, Upload, Database, Users, Bell } from 'lucide-react';
import { ImportPage } from './import-page';
import { UsersPanel } from '../components/settings/users-panel';

type SettingsTab = 'import' | 'data' | 'users' | 'notifications';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType; available: boolean }[] = [
  { id: 'import', label: 'Import Data', icon: Upload, available: true },
  { id: 'data', label: 'Data Management', icon: Database, available: false },
  { id: 'users', label: 'Users & Roles', icon: Users, available: true },
  { id: 'notifications', label: 'Notifications', icon: Bell, available: false },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('import');

  return (
    <div className="h-full flex overflow-hidden bg-white">
      {/* Settings sidebar */}
      <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
          </div>
        </div>
        <nav className="flex-1 py-2">
          {TABS.map(({ id, label, icon: Icon, available }) => (
            <button
              key={id}
              onClick={() => available && setActiveTab(id)}
              disabled={!available}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                activeTab === id
                  ? 'bg-white text-blue-700 border-r-2 border-blue-500 font-medium'
                  : available
                    ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              {label}
              {!available && (
                <span className="ml-auto text-[9px] bg-gray-200 text-gray-500 rounded px-1.5 py-0.5">Soon</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'import' && <ImportPage />}
        {activeTab === 'data' && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Database size={32} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Data Management</p>
              <p className="text-xs mt-1">Seed data, export, backup -- coming soon</p>
            </div>
          </div>
        )}
        {activeTab === 'users' && <UsersPanel />}
        {activeTab === 'notifications' && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Bell size={32} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs mt-1">Email and in-app notification settings -- coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
