import type { AppRole, ProfileRow } from '@/shared/types/domain';

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

export function homePathForRole(role: AppRole): string {
  return role === 'SUPERVISION_MANAGER' ? '/jefatura' : '/inicio';
}
