import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { homePathForRole } from '@/shared/utils/permissions';
import type { AppRole } from '@/shared/types/domain';

export interface RoleRouteProps {
  allow: readonly AppRole[];
}

/**
 * Restringe un grupo de rutas a determinados roles. Debe anidarse dentro de
 * ProtectedRoute (que ya garantiza sesión y perfil activo). Un rol no permitido
 * se redirige a su pantalla de inicio en lugar de ver una página muerta.
 */
export function RoleRoute({ allow }: RoleRouteProps) {
  const { profile } = useAuth();

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to={homePathForRole(profile.role)} replace />;
  }

  return <Outlet />;
}
