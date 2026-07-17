import { supabase } from './client';
import type { RegionalMonthlyGoalRow } from '@/shared/types/domain';

// RN-30: meta conjunta mensual por sede. Solo el Jefe de Supervisión puede
// escribir (política RLS regional_monthly_goals_insert/update/delete); los
// perfiles activos pueden consultarlas.

export async function fetchRegionalGoalsForMonth(
  year: number,
  month: number,
): Promise<RegionalMonthlyGoalRow[]> {
  const { data, error } = await supabase
    .from('regional_monthly_goals')
    .select('*')
    .eq('year', year)
    .eq('month', month);
  if (error) throw error;
  return data ?? [];
}

export async function createRegionalGoal(
  regionId: string,
  year: number,
  month: number,
  targetVisits: number,
): Promise<RegionalMonthlyGoalRow> {
  const { data, error } = await supabase
    .from('regional_monthly_goals')
    .insert({ region_id: regionId, year, month, target_visits: targetVisits })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRegionalGoal(id: string, targetVisits: number): Promise<void> {
  const { error } = await supabase
    .from('regional_monthly_goals')
    .update({ target_visits: targetVisits })
    .eq('id', id);
  if (error) throw error;
}
