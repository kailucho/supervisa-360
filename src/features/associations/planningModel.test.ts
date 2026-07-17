import { describe, expect, it } from 'vitest';
import {
  buildAdvisorPlanningItems,
  myActiveAdvisorIds,
  removedAdvisorsWithScheduledVisits,
} from './planningModel';
import type { AssociationWithRelations } from '@/services/supabase/associations';
import type {
  AdvisorMonthVisitStats,
  RegionPlanAssignment,
} from '@/services/supabase/monthlyPlans';
import type { AdvisorRow } from '@/shared/types/domain';

function advisor(id: string, name: string, isActive = true): AdvisorRow {
  return {
    id,
    code: `ASE-${id}`,
    full_name: name,
    is_active: isActive,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function associationFor(advisorId: string, id: string): AssociationWithRelations {
  return {
    id,
    bank_code: '10001',
    name: `Asociación ${id}`,
    region_id: 'region-1',
    status: 'NORMAL',
    advisor_id: advisorId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    region: null,
    advisor: null,
  } as AssociationWithRelations;
}

function assignment(
  advisorId: string,
  supervisorId: string,
  supervisorName: string,
): RegionPlanAssignment {
  return {
    id: `as-${advisorId}-${supervisorId}`,
    monthly_plan_id: `plan-${supervisorId}`,
    advisor_id: advisorId,
    region_id: 'region-1',
    year: 2026,
    month: 7,
    selected_by: supervisorId,
    selected_at: '2026-07-01T00:00:00Z',
    removed_by: null,
    removed_at: null,
    plan: {
      id: `plan-${supervisorId}`,
      supervisor_id: supervisorId,
      region_id: 'region-1',
      year: 2026,
      month: 7,
      configured_at: '2026-07-01T00:00:00Z',
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      supervisor: {
        id: supervisorId,
        full_name: supervisorName,
        is_active: true,
        role: 'SUPERVISOR',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
  } as RegionPlanAssignment;
}

const ana = advisor('a1', 'Ana Quispe');
const carlos = advisor('a2', 'Carlos Mamani');
const lucia = advisor('a3', 'Lucía Torres');
const associations = [
  associationFor('a1', 'x1'),
  associationFor('a1', 'x2'),
  associationFor('a2', 'x3'),
  associationFor('a3', 'x4'),
];

describe('buildAdvisorPlanningItems', () => {
  it('ordena seleccionados primero y alfabéticamente dentro de cada grupo', () => {
    const items = buildAdvisorPlanningItems({
      advisors: [lucia, carlos, ana],
      associations,
      assignments: [],
      visitStats: new Map(),
      myProfileId: 'sup-1',
      selectedAdvisorIds: new Set(['a3']),
    });
    expect(items.map((item) => item.advisor.id)).toEqual(['a3', 'a1', 'a2']);
  });

  it('incluye contadores de asociaciones activas y visitas del mes', () => {
    const stats = new Map<string, AdvisorMonthVisitStats>([['a1', { scheduled: 3, realized: 2 }]]);
    const items = buildAdvisorPlanningItems({
      advisors: [ana, carlos],
      associations,
      assignments: [],
      visitStats: stats,
      myProfileId: 'sup-1',
      selectedAdvisorIds: new Set(),
    });
    const anaItem = items.find((item) => item.advisor.id === 'a1')!;
    expect(anaItem.activeAssociations).toBe(2);
    expect(anaItem.scheduledThisMonth).toBe(3);
    expect(anaItem.realizedThisMonth).toBe(2);
  });

  it('marca como tomado (exclusividad) al asesor asignado a otra supervisora', () => {
    const items = buildAdvisorPlanningItems({
      advisors: [ana, carlos],
      associations,
      assignments: [assignment('a2', 'sup-2', 'Supervisora Dos')],
      visitStats: new Map(),
      myProfileId: 'sup-1',
      selectedAdvisorIds: new Set(),
    });
    const carlosItem = items.find((item) => item.advisor.id === 'a2')!;
    expect(carlosItem.takenBy).toBe('Supervisora Dos');
    const anaItem = items.find((item) => item.advisor.id === 'a1')!;
    expect(anaItem.takenBy).toBeNull();
  });

  it('no marca como tomado al asesor asignado a la propia supervisora', () => {
    const items = buildAdvisorPlanningItems({
      advisors: [ana],
      associations,
      assignments: [assignment('a1', 'sup-1', 'Yo misma')],
      visitStats: new Map(),
      myProfileId: 'sup-1',
      selectedAdvisorIds: new Set(['a1']),
    });
    expect(items[0].takenBy).toBeNull();
    expect(items[0].selected).toBe(true);
  });

  it('excluye asesores sin asociaciones activas en la sede (salvo asignados o seleccionados)', () => {
    const sinCartera = advisor('a9', 'Asesor sin cartera');
    const items = buildAdvisorPlanningItems({
      advisors: [ana, sinCartera],
      associations,
      assignments: [],
      visitStats: new Map(),
      myProfileId: 'sup-1',
      selectedAdvisorIds: new Set(),
    });
    expect(items.some((item) => item.advisor.id === 'a9')).toBe(false);
  });
});

describe('myActiveAdvisorIds', () => {
  it('devuelve solo los asesores de la planificación de la supervisora', () => {
    const ids = myActiveAdvisorIds(
      [assignment('a1', 'sup-1', 'Yo'), assignment('a2', 'sup-2', 'Otra')],
      'sup-1',
    );
    expect([...ids]).toEqual(['a1']);
  });
});

describe('removedAdvisorsWithScheduledVisits (retiro con visitas programadas)', () => {
  const stats = new Map<string, AdvisorMonthVisitStats>([
    ['a1', { scheduled: 2, realized: 0 }],
    ['a2', { scheduled: 0, realized: 3 }],
  ]);

  it('detecta al asesor retirado que tiene visitas programadas (requiere confirmación)', () => {
    const removed = removedAdvisorsWithScheduledVisits(new Set(['a1', 'a2']), new Set(), stats, [
      ana,
      carlos,
    ]);
    expect(removed.map((a) => a.id)).toEqual(['a1']);
  });

  it('permite retirar sin confirmación a quien solo tiene visitas realizadas', () => {
    const removed = removedAdvisorsWithScheduledVisits(new Set(['a2']), new Set(), stats, [
      ana,
      carlos,
    ]);
    expect(removed).toEqual([]);
  });

  it('no confunde incorporaciones con retiros', () => {
    const removed = removedAdvisorsWithScheduledVisits(new Set(), new Set(['a1']), stats, [
      ana,
      carlos,
    ]);
    expect(removed).toEqual([]);
  });
});
