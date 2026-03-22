import { Navigate } from 'react-router-dom';

/**
 * Map is now integrated into the Signs page.
 * Redirect to /signs for the unified map + list + detail view.
 */
export function MapPage() {
  return <Navigate to="/signs" replace />;
}
