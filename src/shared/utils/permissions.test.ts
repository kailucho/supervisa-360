import { describe, expect, it } from 'vitest';
import {
  canManageAssociations,
  canManageMonthlyPlan,
  canManagePersonalGoals,
  canManageRegionalGoals,
  canManageVisitEvidence,
  canManageVisits,
  homePathForRole,
  isSupervisionManager,
  isSupervisor,
} from './permissions';
import type { ProfileRow, VisitStatus } from '@/shared/types/domain';

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'user-1',
    full_name: 'Persona de prueba',
    is_active: true,
    role: 'SUPERVISOR',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const supervisor = profile();
const manager = profile({ role: 'SUPERVISION_MANAGER' });
const inactiveSupervisor = profile({ is_active: false });
const inactiveManager = profile({ role: 'SUPERVISION_MANAGER', is_active: false });

describe('isSupervisor / isSupervisionManager (RN-28)', () => {
  it('identifica cada rol activo', () => {
    expect(isSupervisor(supervisor)).toBe(true);
    expect(isSupervisor(manager)).toBe(false);
    expect(isSupervisionManager(manager)).toBe(true);
    expect(isSupervisionManager(supervisor)).toBe(false);
  });

  it('un perfil inactivo no tiene ningún rol efectivo', () => {
    expect(isSupervisor(inactiveSupervisor)).toBe(false);
    expect(isSupervisionManager(inactiveManager)).toBe(false);
  });

  it('un perfil null no tiene permisos', () => {
    expect(isSupervisor(null)).toBe(false);
    expect(isSupervisionManager(null)).toBe(false);
  });
});

describe('permisos operativos', () => {
  it('solo la supervisora gestiona visitas, asociaciones y metas personales', () => {
    expect(canManageVisits(supervisor)).toBe(true);
    expect(canManageAssociations(supervisor)).toBe(true);
    expect(canManagePersonalGoals(supervisor)).toBe(true);

    expect(canManageVisits(manager)).toBe(false);
    expect(canManageAssociations(manager)).toBe(false);
    expect(canManagePersonalGoals(manager)).toBe(false);
  });

  it('solo el jefe gestiona metas conjuntas', () => {
    expect(canManageRegionalGoals(manager)).toBe(true);
    expect(canManageRegionalGoals(supervisor)).toBe(false);
    expect(canManageRegionalGoals(null)).toBe(false);
  });
});

describe('canManageVisitEvidence (fotografías y documento)', () => {
  const visit = (supervisorId: string, status: VisitStatus) => ({
    supervisor_id: supervisorId,
    status,
  });

  it('la supervisora que realizó la visita puede gestionar evidencias', () => {
    expect(canManageVisitEvidence(supervisor, visit('user-1', 'REALIZADA'))).toBe(true);
  });

  it('otra supervisora no puede gestionar evidencias de una visita ajena', () => {
    expect(canManageVisitEvidence(supervisor, visit('otra-supervisora', 'REALIZADA'))).toBe(false);
  });

  it('la jefatura solo visualiza: nunca sube, reemplaza ni elimina', () => {
    expect(canManageVisitEvidence(manager, visit(manager.id, 'REALIZADA'))).toBe(false);
  });

  it('solo se permiten evidencias en visitas REALIZADAS', () => {
    expect(canManageVisitEvidence(supervisor, visit('user-1', 'PROGRAMADA'))).toBe(false);
    expect(canManageVisitEvidence(supervisor, visit('user-1', 'CANCELADA'))).toBe(false);
  });

  it('un perfil inactivo o null no gestiona evidencias', () => {
    expect(canManageVisitEvidence(inactiveSupervisor, visit('user-1', 'REALIZADA'))).toBe(false);
    expect(canManageVisitEvidence(null, visit('user-1', 'REALIZADA'))).toBe(false);
  });
});

describe('canManageMonthlyPlan (planificación mensual)', () => {
  it('solo la supervisora activa gestiona su planificación; la jefatura consulta', () => {
    expect(canManageMonthlyPlan(supervisor)).toBe(true);
    expect(canManageMonthlyPlan(manager)).toBe(false);
    expect(canManageMonthlyPlan(inactiveSupervisor)).toBe(false);
    expect(canManageMonthlyPlan(null)).toBe(false);
  });
});

describe('homePathForRole', () => {
  it('la supervisora entra a /inicio y el jefe a /jefatura', () => {
    expect(homePathForRole('SUPERVISOR')).toBe('/inicio');
    expect(homePathForRole('SUPERVISION_MANAGER')).toBe('/jefatura');
  });
});
