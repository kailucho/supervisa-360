import { supabase } from './client';
import type {
  IndividualProgressRow,
  JointProgressRow,
  MonthlyGoalRow,
  ProfileRow,
  RegionRow,
} from '@/shared/types/domain';

export interface ProgressFilters {
  regionId?: string;
  supervisorId?: string;
}

export async function fetchIndividualProgress(
  year: number,
  month: number,
  filters: ProgressFilters = {},
): Promise<IndividualProgressRow[]> {
  let query = supabase
    .from('v_individual_monthly_progress')
    .select('*')
    .eq('year', year)
    .eq('month', month);
  if (filters.regionId) query = query.eq('region_id', filters.regionId);
  if (filters.supervisorId) query = query.eq('supervisor_id', filters.supervisorId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchJointProgress(
  year: number,
  month: number,
  filters: Pick<ProgressFilters, 'regionId'> = {},
): Promise<JointProgressRow[]> {
  let query = supabase
    .from('v_joint_monthly_progress')
    .select('*')
    .eq('year', year)
    .eq('month', month);
  if (filters.regionId) query = query.eq('region_id', filters.regionId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyGoalsForMonth(
  supervisorId: string,
  year: number,
  month: number,
): Promise<MonthlyGoalRow[]> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('*')
    .eq('supervisor_id', supervisorId)
    .eq('year', year)
    .eq('month', month);
  if (error) throw error;
  return data ?? [];
}

export type GoalWithProfile = MonthlyGoalRow & {
  profile: ProfileRow | null;
  region: RegionRow | null;
};

export async function fetchGoalsForMonth(year: number, month: number): Promise<GoalWithProfile[]> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('*, profile:profiles(*), region:regions(*)')
    .eq('year', year)
    .eq('month', month);
  if (error) throw error;
  return (data ?? []) as unknown as GoalWithProfile[];
}

export async function createGoal(
  supervisorId: string,
  regionId: string,
  year: number,
  month: number,
  targetVisits: number,
): Promise<MonthlyGoalRow> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .insert({
      supervisor_id: supervisorId,
      region_id: regionId,
      year,
      month,
      target_visits: targetVisits,
    })
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
