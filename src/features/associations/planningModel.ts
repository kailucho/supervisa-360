import type { AssociationWithRelations } from '@/services/supabase/associations';
import type { RegionPlanAssignment } from '@/services/supabase/monthlyPlans';
import type { AdvisorMonthVisitStats } from '@/services/supabase/monthlyPlans';
import type { AdvisorRow } from '@/shared/types/domain';
import { isActiveAssociation } from './associationInsights';

// Modelo puro del bloque "Mi planificación del mes": qué asesores se muestran,
// con qué contadores, quién está tomado por otra supervisora y en qué orden.

export interface AdvisorPlanningItem {
  advisor: AdvisorRow;
  /** Asociaciones activas del asesor en la sede seleccionada. */
  activeAssociations: number;
  scheduledThisMonth: number;
  realizedThisMonth: number;
  /** Está en la selección (edición en curso) de la supervisora. */
  selected: boolean;
  /** Nombre de la otra supervisora que ya lo tiene asignado, si aplica. */
  takenBy: string | null;
}

export interface BuildPlanningItemsInput {
  advisors: AdvisorRow[];
  /** Asociaciones de la sede seleccionada (todas; aquí se filtran las activas). */
  associations: AssociationWithRelations[];
  /** Asignaciones ACTIVAS de todas las supervisoras para la sede y periodo. */
  assignments: RegionPlanAssignment[];
  visitStats: Map<string, AdvisorMonthVisitStats>;
  myProfileId: string;
  /** Selección en edición (ids de asesores marcados por la supervisora). */
  selectedAdvisorIds: Set<string>;
}

/**
 * Asesores relevantes = los que tienen al menos una asociación activa en la
 * sede, más los que ya forman parte de alguna selección del periodo (para que
 * una asignación previa nunca desaparezca de la lista).
 * Orden: seleccionados primero, luego no seleccionados; alfabético dentro de
 * cada grupo.
 */
export function buildAdvisorPlanningItems(input: BuildPlanningItemsInput): AdvisorPlanningItem[] {
  const activeCountByAdvisor = new Map<string, number>();
  for (const association of input.associations) {
    if (!isActiveAssociation(association)) continue;
    activeCountByAdvisor.set(
      association.advisor_id,
      (activeCountByAdvisor.get(association.advisor_id) ?? 0) + 1,
    );
  }

  const takenByOther = new Map<string, string>();
  const assignedAdvisorIds = new Set<string>();
  for (const assignment of input.assignments) {
    assignedAdvisorIds.add(assignment.advisor_id);
    const supervisorId = assignment.plan?.supervisor_id;
    if (supervisorId && supervisorId !== input.myProfileId) {
      takenByOther.set(
        assignment.advisor_id,
        assignment.plan?.supervisor?.full_name ?? 'otra supervisora',
      );
    }
  }

  const relevant = input.advisors.filter(
    (advisor) =>
      advisor.is_active &&
      ((activeCountByAdvisor.get(advisor.id) ?? 0) > 0 ||
        assignedAdvisorIds.has(advisor.id) ||
        input.selectedAdvisorIds.has(advisor.id)),
  );

  const items = relevant.map((advisor) => ({
    advisor,
    activeAssociations: activeCountByAdvisor.get(advisor.id) ?? 0,
    scheduledThisMonth: input.visitStats.get(advisor.id)?.scheduled ?? 0,
    realizedThisMonth: input.visitStats.get(advisor.id)?.realized ?? 0,
    selected: input.selectedAdvisorIds.has(advisor.id),
    takenBy: takenByOther.get(advisor.id) ?? null,
  }));

  items.sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return a.advisor.full_name.localeCompare(b.advisor.full_name, 'es');
  });
  return items;
}

/** Ids de asesores asignados activamente a la supervisora en este periodo. */
export function myActiveAdvisorIds(
  assignments: RegionPlanAssignment[],
  myProfileId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.plan?.supervisor_id === myProfileId) {
      ids.add(assignment.advisor_id);
    }
  }
  return ids;
}

/**
 * Asesores que serían retirados por el guardado y que tienen visitas
 * programadas este mes: requieren confirmación (las visitas se mantienen).
 */
export function removedAdvisorsWithScheduledVisits(
  previousIds: Set<string>,
  nextIds: Set<string>,
  visitStats: Map<string, AdvisorMonthVisitStats>,
  advisors: AdvisorRow[],
): AdvisorRow[] {
  return advisors.filter(
    (advisor) =>
      previousIds.has(advisor.id) &&
      !nextIds.has(advisor.id) &&
      (visitStats.get(advisor.id)?.scheduled ?? 0) > 0,
  );
}
