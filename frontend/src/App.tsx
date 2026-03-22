import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/app-shell';
import { SignsPage } from './routes/signs-page';
import { WorkOrdersPage } from './routes/work-orders-page';
import { InspectionsPage } from './routes/inspections-page';
import { DashboardPage } from './routes/dashboard-page';
import { SettingsPage } from './routes/settings-page';
import { HelpPage } from './routes/help-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/signs" replace />} />
            <Route path="signs" element={<SignsPage />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="inspections" element={<InspectionsPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* Legacy route — redirect to settings */}
            <Route path="import" element={<Navigate to="/settings" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
