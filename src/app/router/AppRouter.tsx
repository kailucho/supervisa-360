import { Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppLayout } from '@/app/layout/AppLayout';
import { NotFoundPage } from '@/app/layout/NotFoundPage';
import { DashboardPage } from '@/features/goals/pages/DashboardPage';
import { GoalsPage } from '@/features/goals/pages/GoalsPage';
import { SchedulePage } from '@/features/schedule/pages/SchedulePage';
import { AssociationsListPage } from '@/features/associations/pages/AssociationsListPage';
import { AssociationDetailPage } from '@/features/associations/pages/AssociationDetailPage';
import { AdvisorsListPage } from '@/features/advisors/pages/AdvisorsListPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agenda" element={<SchedulePage />} />
          <Route path="/asociaciones" element={<AssociationsListPage />} />
          <Route path="/asociaciones/:id" element={<AssociationDetailPage />} />
          <Route path="/asesores" element={<AdvisorsListPage />} />
          <Route path="/metas" element={<GoalsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
