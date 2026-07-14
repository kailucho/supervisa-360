import { supabase } from './client';
import type { RegionRow } from '@/shared/types/domain';

export async function fetchRegions(): Promise<RegionRow[]> {
  const { data, error } = await supabase
    .from('regions')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}
