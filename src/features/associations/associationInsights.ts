import type { AssociationWithRelations } from '@/services/supabase/associations';
import type { RealizedVisitSummary } from '@/services/supabase/visits';
import type { VisitRow } from '@/shared/types/domain';
import { SUPERVISABLE_STATUSES } from '@/shared/types/domain';
import type { AssociationStatus } from '@/shared/types/domain';
import { parseISODate } from '@/shared/utils/date';

// Lógica pura del listado de asociaciones: evolución (comparando solo las dos
// últimas visitas realizadas), orden por prioridad y filtros. Sin dependencias
// de React ni de Supabase para poder probarla de forma aislada.

export type EvolutionKind = 'NEVER_VISITED' | 'NO_TREND' | 'IMPROVED' | 'STEADY' | 'DECLINED';

export interface Evolution {
  kind: EvolutionKind;
  /** Diferencia (última - anterior); solo tiene sentido en IMPROVED/DECLINED. */
  delta: number;
}

export interface AssociationInsights {
  lastVisitDate: string | null;
  lastScore: number | null;
  previousScore: number | null;
  evolution: Evolution;
  /** Visita activa (PROGRAMADA/REPROGRAMADA) pendiente, si existe. */
  pendingVisit: VisitRow | null;
}

export const EVOLUTION_LABELS: Record<EvolutionKind, string> = {
  NEVER_VISITED: 'Nunca visitada',
  NO_TREND: 'Sin tendencia todavía',
  IMPROVED: 'Mejoró',
  STEADY: 'Se mantuvo',
  DECLINED: 'Disminuyó',
};

export function describeEvolution(evolution: Evolution): string {
  switch (evolution.kind) {
    case 'IMPROVED':
      return `Mejoró ${evolution.delta} ${evolution.delta === 1 ? 'punto' : 'puntos'}`;
    case 'DECLINED':
      return `Disminuyó ${Math.abs(evolution.delta)} ${Math.abs(evolution.delta) === 1 ? 'punto' : 'puntos'}`;
    default:
      return EVOLUTION_LABELS[evolution.kind];
  }
}

/**
 * Evolución a partir de las puntuaciones de visitas realizadas ordenadas de la
 * más reciente a la más antigua. Compara únicamente las dos últimas.
 */
export function computeEvolution(scoresDesc: (number | null)[]): Evolution {
  const scores = scoresDesc.filter((s): s is number => s != null);
  if (scores.length === 0) return { kind: 'NEVER_VISITED', delta: 0 };
  if (scores.length === 1) return { kind: 'NO_TREND', delta: 0 };
  const delta = scores[0] - scores[1];
  if (delta > 0) return { kind: 'IMPROVED', delta };
  if (delta < 0) return { kind: 'DECLINED', delta };
  return { kind: 'STEADY', delta: 0 };
}

/**
 * Construye los indicadores por asociación a partir del resumen de visitas
 * realizadas (ordenado por fecha descendente) y de las visitas activas.
 */
export function buildAssociationInsights(
  associationIds: string[],
  realizedDesc: RealizedVisitSummary[],
  activeVisits: VisitRow[],
): Map<string, AssociationInsights> {
  const byAssociation = new Map<string, RealizedVisitSummary[]>();
  for (const visit of realizedDesc) {
    const list = byAssociation.get(visit.association_id) ?? [];
    list.push(visit);
    byAssociation.set(visit.association_id, list);
  }
  const pendingByAssociation = new Map<string, VisitRow>();
  for (const visit of activeVisits) {
    pendingByAssociation.set(visit.association_id, visit);
  }

  const result = new Map<string, AssociationInsights>();
  for (const id of associationIds) {
    const realized = byAssociation.get(id) ?? [];
    result.set(id, {
      lastVisitDate: realized[0]?.performed_date ?? null,
      lastScore: realized[0]?.score ?? null,
      previousScore: realized[1]?.score ?? null,
      evolution: computeEvolution(realized.map((v) => v.score)),
      pendingVisit: pendingByAssociation.get(id) ?? null,
    });
  }
  return result;
}

export type AssociationSortOption =
  'PRIORITY' | 'NAME' | 'LOWEST_SCORE' | 'LONGEST_WITHOUT_VISIT' | 'MOST_RECENT_VISIT';

export const ASSOCIATION_SORT_LABELS: Record<AssociationSortOption, string> = {
  PRIORITY: 'Prioridad de atención',
  NAME: 'Nombre',
  LOWEST_SCORE: 'Menor puntuación',
  LONGEST_WITHOUT_VISIT: 'Mayor tiempo sin visitar',
  MOST_RECENT_VISIT: 'Visita más reciente',
};

const EMPTY_INSIGHTS: AssociationInsights = {
  lastVisitDate: null,
  lastScore: null,
  previousScore: null,
  evolution: { kind: 'NEVER_VISITED', delta: 0 },
  pendingVisit: null,
};

function dateValue(isoDate: string | null): number {
  return isoDate ? parseISODate(isoDate).getTime() : 0;
}

/**
 * Orden por prioridad de atención:
 *   1. nunca visitadas;
 *   2. menor puntuación en la última visita;
 *   3. asociaciones cuya puntuación disminuyó;
 *   4. más tiempo sin visitar;
 *   5. nombre alfabético como desempate.
 */
export function compareByPriority(
  a: AssociationWithRelations,
  b: AssociationWithRelations,
  insights: Map<string, AssociationInsights>,
): number {
  const ia = insights.get(a.id) ?? EMPTY_INSIGHTS;
  const ib = insights.get(b.id) ?? EMPTY_INSIGHTS;

  const aNever = ia.evolution.kind === 'NEVER_VISITED';
  const bNever = ib.evolution.kind === 'NEVER_VISITED';
  if (aNever !== bNever) return aNever ? -1 : 1;

  if (!aNever) {
    const scoreDiff = (ia.lastScore ?? 0) - (ib.lastScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;

    const aDeclined = ia.evolution.kind === 'DECLINED';
    const bDeclined = ib.evolution.kind === 'DECLINED';
    if (aDeclined !== bDeclined) return aDeclined ? -1 : 1;

    const dateDiff = dateValue(ia.lastVisitDate) - dateValue(ib.lastVisitDate);
    if (dateDiff !== 0) return dateDiff; // más antigua primero
  }

  return a.name.localeCompare(b.name, 'es');
}

export function sortAssociations(
  associations: AssociationWithRelations[],
  insights: Map<string, AssociationInsights>,
  sortBy: AssociationSortOption,
): AssociationWithRelations[] {
  const sorted = [...associations];
  const byName = (a: AssociationWithRelations, b: AssociationWithRelations) =>
    a.name.localeCompare(b.name, 'es');

  switch (sortBy) {
    case 'PRIORITY':
      sorted.sort((a, b) => compareByPriority(a, b, insights));
      break;
    case 'NAME':
      sorted.sort(byName);
      break;
    case 'LOWEST_SCORE':
      sorted.sort((a, b) => {
        const sa = insights.get(a.id)?.lastScore;
        const sb = insights.get(b.id)?.lastScore;
        // Sin puntuación (nunca visitadas) al final de este orden.
        if ((sa == null) !== (sb == null)) return sa == null ? 1 : -1;
        if (sa != null && sb != null && sa !== sb) return sa - sb;
        return byName(a, b);
      });
      break;
    case 'LONGEST_WITHOUT_VISIT':
      sorted.sort((a, b) => {
        const da = insights.get(a.id)?.lastVisitDate ?? null;
        const db = insights.get(b.id)?.lastVisitDate ?? null;
        // Nunca visitadas primero: llevan "más tiempo" sin visita.
        if ((da == null) !== (db == null)) return da == null ? -1 : 1;
        const diff = dateValue(da) - dateValue(db);
        if (diff !== 0) return diff;
        return byName(a, b);
      });
      break;
    case 'MOST_RECENT_VISIT':
      sorted.sort((a, b) => {
        const diff =
          dateValue(insights.get(b.id)?.lastVisitDate ?? null) -
          dateValue(insights.get(a.id)?.lastVisitDate ?? null);
        if (diff !== 0) return diff;
        return byName(a, b);
      });
      break;
  }
  return sorted;
}

export type LastVisitFilter = '' | 'NEVER' | 'OVER_30' | 'OVER_60' | 'OVER_90';

export const LAST_VISIT_FILTER_LABELS: Record<Exclude<LastVisitFilter, ''>, string> = {
  NEVER: 'Nunca visitada',
  OVER_30: 'Más de 30 días',
  OVER_60: 'Más de 60 días',
  OVER_90: 'Más de 90 días',
};

export interface AssociationListFilters {
  search: string;
  advisorId: string;
  evolution: EvolutionKind | '';
  lastVisit: LastVisitFilter;
  status: AssociationStatus | '';
  score: number | null;
  sortBy: AssociationSortOption;
  /** "Buscar también fuera de mi planificación". */
  includeOutsidePlan: boolean;
}

export const DEFAULT_LIST_FILTERS: AssociationListFilters = {
  search: '',
  advisorId: '',
  evolution: '',
  lastVisit: '',
  status: '',
  score: null,
  sortBy: 'PRIORITY',
  includeOutsidePlan: false,
};

export function isActiveAssociation(association: AssociationWithRelations): boolean {
  return (SUPERVISABLE_STATUSES as AssociationStatus[]).includes(association.status);
}

function matchesSearch(association: AssociationWithRelations, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return association.name.toLowerCase().includes(term) || association.bank_code.includes(term);
}

function daysSince(isoDate: string, todayISO: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(
    (parseISODate(todayISO).getTime() - parseISODate(isoDate).getTime()) / msPerDay,
  );
}

function matchesLastVisit(
  insights: AssociationInsights,
  filter: LastVisitFilter,
  todayISO: string,
): boolean {
  if (!filter) return true;
  if (filter === 'NEVER') return insights.lastVisitDate == null;
  if (insights.lastVisitDate == null) return true; // nunca visitada supera cualquier umbral
  const days = daysSince(insights.lastVisitDate, todayISO);
  if (filter === 'OVER_30') return days > 30;
  if (filter === 'OVER_60') return days > 60;
  return days > 90;
}

/**
 * Aplica los filtros del listado. `plannedAdvisorIds` son los asesores
 * seleccionados en la planificación vigente: por defecto solo se muestran
 * asociaciones activas de esos asesores; con `includeOutsidePlan` se busca
 * entre todas las asociaciones activas de la sede.
 */
export function filterAssociations(
  associations: AssociationWithRelations[],
  insights: Map<string, AssociationInsights>,
  filters: AssociationListFilters,
  plannedAdvisorIds: Set<string>,
  todayISO: string,
): AssociationWithRelations[] {
  return associations.filter((association) => {
    if (!isActiveAssociation(association)) return false;
    if (!filters.includeOutsidePlan && !plannedAdvisorIds.has(association.advisor_id)) {
      return false;
    }
    if (!matchesSearch(association, filters.search)) return false;
    if (filters.advisorId && association.advisor_id !== filters.advisorId) return false;
    if (filters.status && association.status !== filters.status) return false;

    const info = insights.get(association.id) ?? EMPTY_INSIGHTS;
    if (filters.evolution && info.evolution.kind !== filters.evolution) return false;
    if (!matchesLastVisit(info, filters.lastVisit, todayISO)) return false;
    if (filters.score != null && info.lastScore !== filters.score) return false;
    return true;
  });
}

export function isOutsidePlan(
  association: AssociationWithRelations,
  plannedAdvisorIds: Set<string>,
): boolean {
  return !plannedAdvisorIds.has(association.advisor_id);
}
