import { supabase } from './client';
import type {
  AdvisorRow,
  AssociationRow,
  AssociationStatus,
  RegionRow,
} from '@/shared/types/domain';

export type AssociationWithRelations = AssociationRow & {
  region: RegionRow | null;
  advisor: AdvisorRow | null;
};

export interface AssociationFilters {
  search?: string;
  regionId?: string;
  status?: AssociationStatus;
}

const WITH_RELATIONS = '*, region:regions(*), advisor:advisors(*)';

/** Sanea el término de búsqueda para usarlo dentro de un filtro `.or()` de PostgREST. */
function sanitizeSearchTerm(term: string): string {
  return term.trim().replace(/[,()]/g, ' ').trim();
}

export async function fetchAssociations(
  filters: AssociationFilters = {},
): Promise<AssociationWithRelations[]> {
  let query = supabase.from('associations').select(WITH_RELATIONS).order('name');

  const term = filters.search ? sanitizeSearchTerm(filters.search) : '';
  if (term) {
    query = query.or(`name.ilike.%${term}%,bank_code.ilike.%${term}%`);
  }
  if (filters.regionId) {
    query = query.eq('region_id', filters.regionId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AssociationWithRelations[];
}

export async function fetchAssociationById(id: string): Promise<AssociationWithRelations | null> {
  const { data, error } = await supabase
    .from('associations')
    .select(WITH_RELATIONS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as AssociationWithRelations | null;
}

export interface AssociationUpdateInput {
  status?: AssociationStatus;
  advisor_id?: string;
}

export async function updateAssociation(
  id: string,
  changes: AssociationUpdateInput,
): Promise<void> {
  const { error } = await supabase.from('associations').update(changes).eq('id', id);
  if (error) throw error;
}
