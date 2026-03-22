import { HelpCircle, Map, Wrench, ClipboardCheck, BarChart3, Upload, Printer, Mail } from 'lucide-react';

const HELP_TOPICS = [
  {
    icon: Map,
    title: 'Signs & Map',
    description: 'Managing sign inventory, adding signs, supports, and using the map interface.',
    status: 'coming-soon' as const,
  },
  {
    icon: Wrench,
    title: 'Work Orders',
    description: 'Creating, managing, and tracking work orders. Multi-asset work orders for knockdowns.',
    status: 'coming-soon' as const,
  },
  {
    icon: ClipboardCheck,
    title: 'Inspections',
    description: 'Conducting inspections, recording conditions, and creating work orders from findings.',
    status: 'coming-soon' as const,
  },
  {
    icon: BarChart3,
    title: 'Compliance Dashboard',
    description: 'Understanding MUTCD compliance metrics, condition ratings, and priority actions.',
    status: 'coming-soon' as const,
  },
  {
    icon: Upload,
    title: 'Importing Data',
    description: 'Preparing and importing CSV files from existing sign inventories.',
    status: 'coming-soon' as const,
  },
  {
    icon: Printer,
    title: 'Printing & Email',
    description: 'Printing work orders for field crews and emailing to team members.',
    status: 'coming-soon' as const,
  },
  {
    icon: Mail,
    title: 'Getting Started',
    description: 'First-time setup, importing your first inventory, and onboarding your team.',
    status: 'coming-soon' as const,
  },
];

export function HelpPage() {
  return (
    <div className="h-full overflow-auto bg-white">
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle size={24} className="text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Help & Documentation</h2>
        </div>
        <p className="text-sm text-gray-500 mb-8">
          Guides, tutorials, and reference documentation for AssetLink.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HELP_TOPICS.map((topic) => (
            <div
              key={topic.title}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <topic.icon size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{topic.title}</h3>
                    <span className="text-[9px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">Soon</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{topic.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">Need help now?</h3>
          <p className="text-xs text-blue-700">
            Contact support at <span className="font-medium">support@assetlink.com</span>
          </p>
        </div>
      </div>
    </div>
  );
}
