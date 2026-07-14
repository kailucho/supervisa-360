import { supabase } from './client';
import type { MonthlyGoalRow, MonthlyProgressRow, ProfileRow } from '@/shared/types/domain';

export async function fetchMonthlyProgress(
  year: number,
  month: number,
): Promise<MonthlyProgressRow[]> {
  const { data, error } = await supabase
    .from('v_monthly_progress')
    .select('*')
    .eq('year', year)
    .eq('month', month);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyGoal(
  supervisorId: string,
  year: number,
  month: number,
): Promise<MonthlyGoalRow | null> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('*')
    .eq('supervisor_id', supervisorId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type GoalWithProfile = MonthlyGoalRow & { profile: ProfileRow | null };

export async function fetchGoalsForMonth(year: number, month: number): Promise<GoalWithProfile[]> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('*, profile:profiles(*)')
    .eq('year', year)
    .eq('month', month);
  if (error) throw error;
  return (data ?? []) as unknown as GoalWithProfile[];
}

export async function createGoal(
  supervisorId: string,
  year: number,
  month: number,
  targetVisits: number,
): Promise<MonthlyGoalRow> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .insert({ supervisor_id: supervisorId, year, month, target_visits: targetVisits })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, targetVisits: number): Promise<void> {
  const { error } = await supabase
    .from('monthly_goals')
    .update({ target_visits: targetVisits })
    .eq('id', id);
  if (error) throw error;
}
