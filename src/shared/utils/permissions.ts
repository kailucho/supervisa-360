import type { AppRole, ProfileRow, VisitRow } from '@/shared/types/domain';

// RN-28: SUPERVISOR opera visitas, asociaciones y sus metas personales;
// SUPERVISION_MANAGER solo consulta y administra las metas conjuntas por sede.
// Estas comprobaciones espejan las políticas RLS: la interfaz oculta lo que la
// base de datos ya prohíbe.

export function isSupervisor(profile: ProfileRow | null): boolean {
  return profile?.is_active === true && profile.role === 'SUPERVISOR';
}

export function isSupervisionManager(profile: ProfileRow | null): boolean {
  return profile?.is_active === true && profile.role === 'SUPERVISION_MANAGER';
}

export function canManageVisits(profile: ProfileRow | null): boolean {
  return isSupervisor(profile);
}

export function canManageAssociations(profile: ProfileRow | null): boolean {
  return isSupervisor(profile);
}

export function canManagePersonalGoals(profile: ProfileRow | null): boolean {
  return isSupervisor(profile);
}

export function canManageRegionalGoals(profile: ProfileRow | null): boolean {
  return isSupervisionManager(profile);
}

/**
 * Evidencias (fotografías y documento de retroalimentación): solo la
 * supervisora que realizó la visita puede subir/reemplazar/eliminar, y solo
 * cuando la visita está REALIZADA. La jefatura únicamente visualiza. Espeja
 * las políticas RLS de visit_photos / visit_document_feedback y de Storage.
 */
export function canManageVisitEvidence(
  profile: ProfileRow | null,
  visit: Pick<VisitRow, 'supervisor_id' | 'status'>,
): boolean {
  return (
    isSupervisor(profile) && visit.status === 'REALIZADA' && visit.supervisor_id === profile!.id
  );
}

export function canManageMonthlyPlan(profile: ProfileRow | null): boolean {
  return isSupervisor(profile);
}

export function homePathForRole(role: AppRole): string {
  return role === 'SUPERVISION_MANAGER' ? '/jefatura' : '/inicio';
}
