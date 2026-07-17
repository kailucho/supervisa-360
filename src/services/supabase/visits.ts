import { supabase } from './client';
import { getLimaTodayISODate, getMonthRangeISO } from '@/shared/utils/date';
import type {
  AdvisorRow,
  AssociationRow,
  ProfileRow,
  RegionRow,
  VisitCharacteristic,
  VisitModality,
  VisitRow,
  VisitStatus,
  VisitType,
} from '@/shared/types/domain';

export type VisitWithRelations = VisitRow & {
  association: (AssociationRow & { region: RegionRow | null }) | null;
  supervisor: ProfileRow | null;
  scheduled_advisor: AdvisorRow | null;
};

const SUPERVISOR_EMBED = 'supervisor:profiles!visits_supervisor_id_fkey(*)';
const SCHEDULED_ADVISOR_EMBED = 'scheduled_advisor:advisors!visits_scheduled_advisor_id_fkey(*)';
const ASSOCIATION_EMBED = 'association:associations(*, region:regions(*))';
const FULL_EMBED = `*, ${ASSOCIATION_EMBED}, ${SUPERVISOR_EMBED}, ${SCHEDULED_ADVISOR_EMBED}`;

export interface AgendaFilters {
  year: number;
  month: number;
  supervisorId?: string;
  status?: VisitStatus;
  regionId?: string;
}

export async function fetchAgendaVisits(filters: AgendaFilters): Promise<VisitWithRelations[]> {
  const { start, nextMonthStart } = getMonthRangeISO(filters.year, filters.month);
  let query = supabase
    .from('visits')
    .select(FULL_EMBED)
    .gte('scheduled_date', start)
    .lt('scheduled_date', nextMonthStart)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: false });

  if (filters.supervisorId) query = query.eq('supervisor_id', filters.supervisorId);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as unknown as VisitWithRelations[];
  if (filters.regionId) {
    rows = rows.filter((v) => v.association?.region_id === filters.regionId);
  }
  return rows;
}

export async function fetchUpcomingVisits(
  limit = 5,
  regionId?: string,
): Promise<VisitWithRelations[]> {
  const today = getLimaTodayISODate();
  const { data, error } = await supabase
    .from('visits')
    .select(FULL_EMBED)
    .in('status', ['PROGRAMADA', 'REPROGRAMADA'])
    .gte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  let rows = (data ?? []) as unknown as VisitWithRelations[];
  if (regionId) rows = rows.filter((v) => v.association?.region_id === regionId);
  return rows;
}

export async function fetchOverdueActiveVisits(
  limit = 10,
  regionId?: string,
): Promise<VisitWithRelations[]> {
  const today = getLimaTodayISODate();
  const { data, error } = await supabase
    .from('visits')
    .select(FULL_EMBED)
    .in('status', ['PROGRAMADA', 'REPROGRAMADA'])
    .lt('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  let rows = (data ?? []) as unknown as VisitWithRelations[];
  if (regionId) rows = rows.filter((v) => v.association?.region_id === regionId);
  return rows;
}

export async function fetchRescheduledVisits(limit = 10): Promise<VisitWithRelations[]> {
  const { data, error } = await supabase
    .from('visits')
    .select(FULL_EMBED)
    .eq('status', 'REPROGRAMADA')
    .order('scheduled_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as VisitWithRelations[];
}

export async function fetchActiveVisitForAssociation(
  associationId: string,
): Promise<VisitWithRelations | null> {
  const { data, error } = await supabase
    .from('visits')
    .select(`*, ${SUPERVISOR_EMBED}`)
    .eq('association_id', associationId)
    .in('status', ['PROGRAMADA', 'REPROGRAMADA'])
    .maybeSingle();
  if (error) throw error;
  return data as unknown as VisitWithRelations | null;
}

/** Visitas REALIZADA de la asociación cuyo `performed_date` cae en el año indicado (RN-10/RN-11/RN-14). */
export async function fetchRealizedVisitsInYear(
  associationId: string,
  year: number,
  excludeVisitId?: string,
): Promise<Pick<VisitRow, 'id' | 'visit_type'>[]> {
  let query = supabase
    .from('visits')
    .select('id, visit_type')
    .eq('association_id', associationId)
    .eq('status', 'REALIZADA')
    .gte('performed_date', `${year}-01-01`)
    .lt('performed_date', `${year + 1}-01-01`);
  if (excludeVisitId) query = query.neq('id', excludeVisitId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchVisitHistory(associationId: string): Promise<VisitWithRelations[]> {
  const { data, error } = await supabase
    .from('visits')
    .select(`*, ${SUPERVISOR_EMBED}, ${SCHEDULED_ADVISOR_EMBED}`)
    .eq('association_id', associationId)
    .order('scheduled_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VisitWithRelations[];
}

export interface ScheduleVisitInput {
  associationId: string;
  supervisorId: string;
  currentAdvisorId: string;
  visitType: VisitType;
  modality: VisitModality;
  characteristic: VisitCharacteristic;
  scheduledDate: string;
  scheduledTime: string | null;
}

export async function scheduleVisit(input: ScheduleVisitInput): Promise<VisitRow> {
  const { data, error } = await supabase
    .from('visits')
    .insert({
      association_id: input.associationId,
      supervisor_id: input.supervisorId,
      // El trigger BEFORE INSERT sobrescribe este valor con el asesor actual real;
      // se envía igual porque el tipo Insert generado lo exige (ver database-design.md §7).
      scheduled_advisor_id: input.currentAdvisorId,
      visit_type: input.visitType,
      modality: input.modality,
      characteristic: input.characteristic,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface RescheduleVisitInput {
  scheduledDate: string;
  scheduledTime: string | null;
  visitType: VisitType;
  modality: VisitModality;
  characteristic: VisitCharacteristic;
}

export async function rescheduleVisit(id: string, changes: RescheduleVisitInput): Promise<void> {
  const { error } = await supabase
    .from('visits')
    .update({
      status: 'REPROGRAMADA',
      scheduled_date: changes.scheduledDate,
      scheduled_time: changes.scheduledTime,
      visit_type: changes.visitType,
      modality: changes.modality,
      characteristic: changes.characteristic,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelVisit(id: string): Promise<void> {
  const { error } = await supabase.from('visits').update({ status: 'CANCELADA' }).eq('id', id);
  if (error) throw error;
}

export async function markVisitNotDone(id: string): Promise<void> {
  const { error } = await supabase.from('visits').update({ status: 'NO_REALIZADA' }).eq('id', id);
  if (error) throw error;
}

export interface VisitResultInput {
  performedDate: string;
  startTime: string | null;
  endTime: string | null;
  score: number;
  generalComment: string;
}

export async function markVisitDone(id: string, result: VisitResultInput): Promise<void> {
  const { error } = await supabase
    .from('visits')
    .update({
      status: 'REALIZADA',
      performed_date: result.performedDate,
      start_time: result.startTime,
      end_time: result.endTime,
      score: result.score,
      general_comment: result.generalComment,
    })
    .eq('id', id);
  if (error) throw error;
}

/** RN-22: solo el resultado es editable en una visita ya REALIZADA; el estado no cambia. */
export async function editVisitResult(id: string, result: VisitResultInput): Promise<void> {
  const { error } = await supabase
    .from('visits')
    .update({
      performed_date: result.performedDate,
      start_time: result.startTime,
      end_time: result.endTime,
      score: result.score,
      general_comment: result.generalComment,
    })
    .eq('id', id);
  if (error) throw error;
}
