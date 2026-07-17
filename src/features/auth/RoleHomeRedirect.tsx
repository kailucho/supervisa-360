import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { homePathForRole } from '@/shared/utils/permissions';

/** La raíz ("/") redirige a la pantalla de inicio que corresponde al rol. */
export function RoleHomeRedirect() {
  const { profile } = useAuth();

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={homePathForRole(profile.role)} replace />;
}
