import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-white">
        <Outlet />
      </main>
    </div>
  );
}
