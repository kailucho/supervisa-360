import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { RoleRoute } from '@/features/auth/RoleRoute';
import { RoleHomeRedirect } from '@/features/auth/RoleHomeRedirect';
import { AppLayout } from '@/app/layout/AppLayout';
import { NotFoundPage } from '@/app/layout/NotFoundPage';
import { DashboardPage } from '@/features/goals/pages/DashboardPage';
import { GoalsPage } from '@/features/goals/pages/GoalsPage';
import { SchedulePage } from '@/features/schedule/pages/SchedulePage';
import { AssociationsListPage } from '@/features/associations/pages/AssociationsListPage';
import { AssociationDetailPage } from '@/features/associations/pages/AssociationDetailPage';
import { ManagerDashboardPage } from '@/features/management/pages/ManagerDashboardPage';
import { RegionDetailPage } from '@/features/management/pages/RegionDetailPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RoleHomeRedirect />} />
          <Route element={<RoleRoute allow={['SUPERVISOR']} />}>
            <Route path="/inicio" element={<DashboardPage />} />
          </Route>
          <Route element={<RoleRoute allow={['SUPERVISION_MANAGER']} />}>
            <Route path="/jefatura" element={<ManagerDashboardPage />} />
            <Route path="/jefatura/sedes/:regionId" element={<RegionDetailPage />} />
          </Route>
          <Route path="/agenda" element={<SchedulePage />} />
          <Route path="/asociaciones" element={<AssociationsListPage />} />
          <Route path="/asociaciones/:id" element={<AssociationDetailPage />} />
          {/* La pantalla de asesores se conserva en el código (AdvisorsListPage)
              pero se retiró de la navegación: /asesores redirige a /inicio. */}
          <Route path="/asesores" element={<Navigate to="/inicio" replace />} />
          <Route path="/metas" element={<GoalsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
