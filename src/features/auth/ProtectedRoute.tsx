import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { FullPageSpinner } from '@/shared/components/FullPageSpinner';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  if (status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
