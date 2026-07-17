import { useAuth } from '@/features/auth/useAuth';
import { isSupervisionManager } from '@/shared/utils/permissions';
import { SupervisorGoalsPage } from './SupervisorGoalsPage';
import { ManagerGoalsPage } from './ManagerGoalsPage';

/**
 * /metas comparte ruta entre roles: la supervisora administra sus metas
 * personales por sede; el jefe consulta las personales y define la meta
 * conjunta por sede (RN-29 / RN-30).
 */
export function GoalsPage() {
  const { profile } = useAuth();
  return isSupervisionManager(profile) ? <ManagerGoalsPage /> : <SupervisorGoalsPage />;
}
