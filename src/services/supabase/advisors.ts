import { supabase } from './client';
import type { AdvisorRow } from '@/shared/types/domain';

export async function fetchAdvisors(): Promise<AdvisorRow[]> {
  const { data, error } = await supabase.from('advisors').select('*').order('full_name');
  if (error) throw error;
  return data ?? [];
}
