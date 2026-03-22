import { Map, Table2, Columns3 } from 'lucide-react';

export type ViewMode = 'map' | 'table' | 'split';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const modes: Array<{ value: ViewMode; label: string; icon: typeof Map }> = [
  { value: 'map', label: 'Map', icon: Map },
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'split', label: 'Split', icon: Columns3 },
];

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex items-center bg-gray-100 rounded-full p-0.5">
      {modes.map(({ value, label, icon: Icon }) => {
        const isActive = mode === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            title={`${label} View`}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
