import { supabase } from './client';
import { getMonthRangeISO } from '@/shared/utils/date';
import type { MonthlyPlanAssignmentRow, MonthlyPlanRow, ProfileRow } from '@/shared/types/domain';

export type MonthlyPlanWithSupervisor = MonthlyPlanRow & {
  supervisor: ProfileRow | null;
};

/** Asignación activa de un asesor, con la planificación (y supervisora) a la que pertenece. */
export type RegionPlanAssignment = MonthlyPlanAssignmentRow & {
  plan: MonthlyPlanWithSupervisor | null;
};

/**
 * Asignaciones ACTIVAS de todas las supervisoras para una sede y periodo.
 * Permite mostrar la exclusividad ("asignado a X") en la interfaz.
 */
export async function fetchRegionActiveAssignments(
  regionId: string,
  year: number,
  month: number,
): Promise<RegionPlanAssignment[]> {
  const { data, error } = await supabase
    .from('monthly_plan_advisor_assignments')
    .select('*, plan:monthly_plans(*, supervisor:profiles(*))')
    .eq('region_id', regionId)
    .eq('year', year)
    .eq('month', month)
    .is('removed_at', null);
  if (error) throw error;
  return (data ?? []) as unknown as RegionPlanAssignment[];
}

/** Cabecera de la planificación de una supervisora (o null si nunca guardó el periodo). */
export async function fetchMyPlan(
  supervisorId: string,
  regionId: string,
  year: number,
  month: number,
): Promise<MonthlyPlanRow | null> {
  const { data, error } = await supabase
    .from('monthly_plans')
    .select('*')
    .eq('supervisor_id', supervisorId)
    .eq('region_id', regionId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Historial completo (incorporaciones y retiros) de una planificación. */
export async function fetchPlanAssignmentHistory(
  planId: string,
): Promise<MonthlyPlanAssignmentRow[]> {
  const { data, error } = await supabase
    .from('monthly_plan_advisor_assignments')
    .select('*')
    .eq('monthly_plan_id', planId)
    .order('selected_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Guarda la selección completa del periodo mediante la RPC transaccional
 * (crea la cabecera si no existe, cierra retiros y crea incorporaciones).
 * Una selección vacía es válida. Devuelve el id de la planificación.
 */
export async function saveMonthlyPlan(
  regionId: string,
  year: number,
  month: number,
  advisorIds: string[],
): Promise<string> {
  const { data, error } = await supabase.rpc('save_monthly_plan', {
    p_region_id: regionId,
    p_year: year,
    p_month: month,
    p_advisor_ids: advisorIds,
  });
  if (error) throw error;
  return data;
}

/**
 * Incorpora un solo asesor a la planificación de la supervisora autenticada
 * (flujo "programar una asociación fuera de mi planificación").
 */
export async function addAdvisorToMonthlyPlan(
  regionId: string,
  year: number,
  month: number,
  advisorId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('add_advisor_to_monthly_plan', {
    p_region_id: regionId,
    p_year: year,
    p_month: month,
    p_advisor_id: advisorId,
  });
  if (error) throw error;
  return data;
}

export interface AdvisorMonthVisitStats {
  scheduled: number;
  realized: number;
}

/**
 * Visitas del mes por asesor (snapshot `scheduled_advisor_id`) dentro de una
 * sede: programadas/reprogramadas por `scheduled_date` y realizadas por
 * `performed_date`. Se usa en el bloque "Mi planificación del mes".
 */
export async function fetchAdvisorMonthVisitStats(
  regionId: string,
  year: number,
  month: number,
): Promise<Map<string, AdvisorMonthVisitStats>> {
  const { start, nextMonthStart } = getMonthRangeISO(year, month);

  const [activeRes, realizedRes] = await Promise.all([
    supabase
      .from('visits')
      .select('scheduled_advisor_id, association:associations!inner(region_id)')
      .in('status', ['PROGRAMADA', 'REPROGRAMADA'])
      .gte('scheduled_date', start)
      .lt('scheduled_date', nextMonthStart)
      .eq('association.region_id', regionId),
    supabase
      .from('visits')
      .select('scheduled_advisor_id, association:associations!inner(region_id)')
      .eq('status', 'REALIZADA')
      .gte('performed_date', start)
      .lt('performed_date', nextMonthStart)
      .eq('association.region_id', regionId),
  ]);
  if (activeRes.error) throw activeRes.error;
  if (realizedRes.error) throw realizedRes.error;

  const stats = new Map<string, AdvisorMonthVisitStats>();
  const bump = (advisorId: string, key: keyof AdvisorMonthVisitStats) => {
    const entry = stats.get(advisorId) ?? { scheduled: 0, realized: 0 };
    entry[key] += 1;
    stats.set(advisorId, entry);
  };
  for (const row of activeRes.data ?? []) bump(row.scheduled_advisor_id, 'scheduled');
  for (const row of realizedRes.data ?? []) bump(row.scheduled_advisor_id, 'realized');
  return stats;
}
