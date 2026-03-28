import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/app-shell';
import { SignsPage } from './routes/signs-page';
import { WorkOrdersPage } from './routes/work-orders-page';
import { InspectionsPage } from './routes/inspections-page';
import { DashboardPage } from './routes/dashboard-page';
import { SettingsPage } from './routes/settings-page';
import { HelpPage } from './routes/help-page';
import { ReportsPage } from './routes/reports-page';
import { EstimatorPage } from './routes/estimator-page';

// Wrappers force full remount when navigating with route state (e.g. from Reports with filter)
function WorkOrdersPageWrapper() {
  const location = useLocation();
  return <WorkOrdersPage key={location.key} />;
}
function InspectionsPageWrapper() {
  const location = useLocation();
  return <InspectionsPage key={location.key} />;
}

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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<ReportsPage />} />
            <Route path="signs" element={<SignsPage />} />
            <Route path="work-orders" element={<WorkOrdersPageWrapper />} />
            <Route path="inspections" element={<InspectionsPageWrapper />} />
            <Route path="compliance" element={<DashboardPage />} />
            <Route path="estimator" element={<EstimatorPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* Legacy routes — redirect */}
            <Route path="import" element={<Navigate to="/settings" replace />} />
            <Route path="reports" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
