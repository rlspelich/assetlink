import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/app-shell';
import { SignsPage } from './routes/signs-page';
import { WorkOrdersPage } from './routes/work-orders-page';
import { InspectionsPage } from './routes/inspections-page';
import { ImportPage } from './routes/import-page';
import { PlaceholderPage } from './routes/placeholder-page';

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
            <Route path="import" element={<ImportPage />} />
            <Route path="dashboard" element={<PlaceholderPage title="Compliance Dashboard" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
