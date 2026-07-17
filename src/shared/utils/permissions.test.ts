import { describe, expect, it } from 'vitest';
import {
  canManageAssociations,
  canManagePersonalGoals,
  canManageRegionalGoals,
  canManageVisits,
  homePathForRole,
  isSupervisionManager,
  isSupervisor,
} from './permissions';
import type { ProfileRow } from '@/shared/types/domain';

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

describe('homePathForRole', () => {
  it('la supervisora entra a /inicio y el jefe a /jefatura', () => {
    expect(homePathForRole('SUPERVISOR')).toBe('/inicio');
    expect(homePathForRole('SUPERVISION_MANAGER')).toBe('/jefatura');
  });
});
