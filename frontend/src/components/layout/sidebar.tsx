import { NavLink } from 'react-router-dom';
import { Map, Wrench, ClipboardCheck, BarChart3, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/signs', icon: Map, label: 'Signs' },
  { to: '/work-orders', icon: Wrench, label: 'Work Orders' },
  { to: '/inspections', icon: ClipboardCheck, label: 'Inspections' },
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
];

export function Sidebar() {
  return (
    <aside className="w-14 hover:w-48 bg-gray-900 text-gray-300 flex flex-col shrink-0 transition-all duration-200 group overflow-hidden">
      <div className="px-3 py-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">
          <span className="inline group-hover:hidden">AL</span>
          <span className="hidden group-hover:inline">AssetLink</span>
        </h1>
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-gray-800 text-white border-r-2 border-blue-500'
                  : 'hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
      {/* Bottom: Settings + tenant name */}
      <div className="border-t border-gray-800">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-gray-800 text-white border-r-2 border-blue-500'
                : 'hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          <Settings size={18} className="shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Settings
          </span>
        </NavLink>
        <div className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap overflow-hidden">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Springfield DPW
          </span>
        </div>
      </div>
    </aside>
  );
}
