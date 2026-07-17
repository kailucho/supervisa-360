import { describe, expect, it } from 'vitest';
import {
  buildAssociationInsights,
  computeEvolution,
  describeEvolution,
  filterAssociations,
  isOutsidePlan,
  sortAssociations,
  DEFAULT_LIST_FILTERS,
} from './associationInsights';
import type { AssociationWithRelations } from '@/services/supabase/associations';
import type { RealizedVisitSummary } from '@/services/supabase/visits';
import type { VisitRow } from '@/shared/types/domain';

function association(
  id: string,
  overrides: Partial<AssociationWithRelations> = {},
): AssociationWithRelations {
  return {
    id,
    bank_code: '10001',
    name: `Asociación ${id}`,
    region_id: 'region-1',
    status: 'NORMAL',
    advisor_id: 'adv-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    region: null,
    advisor: null,
    ...overrides,
  } as AssociationWithRelations;
}

function realized(
  associationId: string,
  performedDate: string,
  score: number,
): RealizedVisitSummary {
  return {
    id: `${associationId}-${performedDate}`,
    association_id: associationId,
    performed_date: performedDate,
    score,
  };
}

describe('computeEvolution (compara solo las dos últimas visitas)', () => {
  it('cero visitas → NEVER_VISITED ("Nunca visitada")', () => {
    const evolution = computeEvolution([]);
    expect(evolution.kind).toBe('NEVER_VISITED');
    expect(describeEvolution(evolution)).toBe('Nunca visitada');
  });

  it('una visita → NO_TREND ("Sin tendencia todavía")', () => {
    const evolution = computeEvolution([4]);
    expect(evolution.kind).toBe('NO_TREND');
    expect(describeEvolution(evolution)).toBe('Sin tendencia todavía');
  });

  it('subió → IMPROVED con delta ("Mejoró X puntos")', () => {
    const evolution = computeEvolution([5, 3]);
    expect(evolution).toEqual({ kind: 'IMPROVED', delta: 2 });
    expect(describeEvolution(evolution)).toBe('Mejoró 2 puntos');
  });

  it('bajó → DECLINED ("Disminuyó X puntos")', () => {
    const evolution = computeEvolution([2, 5]);
    expect(evolution.kind).toBe('DECLINED');
    expect(describeEvolution(evolution)).toBe('Disminuyó 3 puntos');
  });

  it('igual → STEADY ("Se mantuvo")', () => {
    expect(computeEvolution([3, 3]).kind).toBe('STEADY');
  });

  it('usa un singular correcto para 1 punto', () => {
    expect(describeEvolution(computeEvolution([4, 3]))).toBe('Mejoró 1 punto');
  });

  it('solo considera las dos últimas aunque haya más historial', () => {
    // Última 3, anterior 3 → se mantuvo, aunque antes hubiera un 5.
    expect(computeEvolution([3, 3, 5, 1]).kind).toBe('STEADY');
  });
});

describe('sortAssociations por prioridad', () => {
  const nuncaVisitadaZ = association('a-never-z', { name: 'Zeta nunca' });
  const nuncaVisitadaA = association('a-never-a', { name: 'Alfa nunca' });
  const bajaPuntuacion = association('a-low', { name: 'Baja puntuación' });
  const disminuyo = association('a-declined', { name: 'Disminuyó' });
  const mantuvo = association('a-steady', { name: 'Se mantuvo' });
  const antigua = association('a-old', { name: 'Visita antigua' });
  const reciente = association('a-recent', { name: 'Visita reciente' });

  const all = [
    reciente,
    mantuvo,
    antigua,
    disminuyo,
    bajaPuntuacion,
    nuncaVisitadaZ,
    nuncaVisitadaA,
  ];
  const insights = buildAssociationInsights(
    all.map((a) => a.id),
    [
      realized('a-low', '2026-07-01', 1),
      // disminuyó: última 3 (bajó desde 5)
      realized('a-declined', '2026-07-02', 3),
      realized('a-declined', '2026-03-01', 5),
      // se mantuvo en 3
      realized('a-steady', '2026-07-03', 3),
      realized('a-steady', '2026-02-01', 3),
      // misma puntuación (4) pero fechas distintas
      realized('a-old', '2026-01-10', 4),
      realized('a-recent', '2026-07-10', 4),
    ],
    [],
  );

  it('ordena: nunca visitadas, menor puntuación, disminuyó, más tiempo sin visitar, nombre', () => {
    const sorted = sortAssociations(all, insights, 'PRIORITY').map((a) => a.id);
    expect(sorted).toEqual([
      'a-never-a', // nunca visitadas primero, alfabético
      'a-never-z',
      'a-low', // menor puntuación (1)
      'a-declined', // puntuación 3, pero disminuyó
      'a-steady', // puntuación 3, se mantuvo
      'a-old', // puntuación 4, más tiempo sin visitar
      'a-recent',
    ]);
  });

  it('permite ordenar por nombre', () => {
    const sorted = sortAssociations(all, insights, 'NAME').map((a) => a.name);
    expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('permite ordenar por mayor tiempo sin visitar (nunca visitadas primero)', () => {
    const sorted = sortAssociations(all, insights, 'LONGEST_WITHOUT_VISIT').map((a) => a.id);
    expect(sorted.slice(0, 2)).toEqual(['a-never-a', 'a-never-z']);
    expect(sorted[2]).toBe('a-old');
  });

  it('permite ordenar por visita más reciente', () => {
    const sorted = sortAssociations(all, insights, 'MOST_RECENT_VISIT').map((a) => a.id);
    expect(sorted[0]).toBe('a-recent');
  });
});

describe('filterAssociations (planificación y búsqueda fuera de ella)', () => {
  const planned = association('planned', { advisor_id: 'adv-plan', name: 'Planificada' });
  const outside = association('outside', { advisor_id: 'adv-out', name: 'Fuera del plan' });
  const inactive = association('inactive', {
    advisor_id: 'adv-plan',
    status: 'DISUELTA',
    name: 'Disuelta',
  });
  const all = [planned, outside, inactive];
  const insights = buildAssociationInsights(
    all.map((a) => a.id),
    [],
    [],
  );
  const plannedIds = new Set(['adv-plan']);
  const today = '2026-07-17';

  it('por defecto solo muestra asociaciones activas de los asesores planificados', () => {
    const result = filterAssociations(all, insights, DEFAULT_LIST_FILTERS, plannedIds, today);
    expect(result.map((a) => a.id)).toEqual(['planned']);
  });

  it('con "buscar fuera de mi planificación" incluye todas las activas de la sede', () => {
    const result = filterAssociations(
      all,
      insights,
      { ...DEFAULT_LIST_FILTERS, includeOutsidePlan: true },
      plannedIds,
      today,
    );
    expect(result.map((a) => a.id).sort()).toEqual(['outside', 'planned']);
    expect(isOutsidePlan(outside, plannedIds)).toBe(true);
    expect(isOutsidePlan(planned, plannedIds)).toBe(false);
  });

  it('nunca incluye asociaciones no activas (p. ej. disueltas)', () => {
    const result = filterAssociations(
      all,
      insights,
      { ...DEFAULT_LIST_FILTERS, includeOutsidePlan: true },
      plannedIds,
      today,
    );
    expect(result.some((a) => a.id === 'inactive')).toBe(false);
  });

  it('busca por nombre o código de banca', () => {
    const byName = filterAssociations(
      all,
      insights,
      { ...DEFAULT_LIST_FILTERS, includeOutsidePlan: true, search: 'fuera' },
      plannedIds,
      today,
    );
    expect(byName.map((a) => a.id)).toEqual(['outside']);
  });

  it('filtra por evolución y última visita', () => {
    const visited = association('visited', { advisor_id: 'adv-plan', name: 'Visitada' });
    const withVisits = buildAssociationInsights(
      ['planned', 'visited'],
      [realized('visited', '2026-01-01', 2)],
      [],
    );
    const never = filterAssociations(
      [planned, visited],
      withVisits,
      { ...DEFAULT_LIST_FILTERS, evolution: 'NEVER_VISITED' },
      plannedIds,
      today,
    );
    expect(never.map((a) => a.id)).toEqual(['planned']);

    const over90 = filterAssociations(
      [planned, visited],
      withVisits,
      { ...DEFAULT_LIST_FILTERS, lastVisit: 'OVER_90' },
      plannedIds,
      today,
    );
    // La visitada hace >90 días y la nunca visitada superan el umbral.
    expect(over90.map((a) => a.id).sort()).toEqual(['planned', 'visited']);
  });

  it('registra la visita pendiente para impedir duplicados desde la interfaz', () => {
    const pending = {
      id: 'v-1',
      association_id: 'planned',
      status: 'PROGRAMADA',
      scheduled_date: '2026-07-20',
    } as unknown as VisitRow;
    const withPending = buildAssociationInsights(['planned'], [], [pending]);
    expect(withPending.get('planned')?.pendingVisit?.id).toBe('v-1');
  });
});
