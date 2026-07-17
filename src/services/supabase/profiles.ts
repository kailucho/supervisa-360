import { supabase } from './client';
import type { ProfileRow } from '@/shared/types/domain';

export async function fetchProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchActiveProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

// Solo perfiles operativos: el Jefe de Supervisión nunca aparece en los
// selectores de supervisora (agenda, filtros).
export async function fetchActiveSupervisors(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .eq('role', 'SUPERVISOR')
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}
