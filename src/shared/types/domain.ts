import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];

export type ProfileRow = Tables['profiles']['Row'];
export type RegionRow = Tables['regions']['Row'];
export type AdvisorRow = Tables['advisors']['Row'];
export type AssociationRow = Tables['associations']['Row'];
export type VisitRow = Tables['visits']['Row'];
export type MonthlyGoalRow = Tables['monthly_goals']['Row'];
export type MonthlyProgressRow = Database['public']['Views']['v_monthly_progress']['Row'];

export type AssociationStatus = Database['public']['Enums']['association_status'];
export type VisitType = Database['public']['Enums']['visit_type'];
export type VisitModality = Database['public']['Enums']['visit_modality'];
export type VisitCharacteristic = Database['public']['Enums']['visit_characteristic'];
export type VisitStatus = Database['public']['Enums']['visit_status'];

export const ASSOCIATION_STATUSES: readonly AssociationStatus[] = [
  'NUEVA',
  'NORMAL',
  'MORA',
  'DESERCION',
  'REORGANIZACION',
  'PROCESO_DISOLUCION',
  'DISUELTA',
];

// RN-01 / RN-02: solo estas cuatro pueden recibir una visita nueva.
export const SUPERVISABLE_STATUSES: readonly AssociationStatus[] = [
  'NUEVA',
  'NORMAL',
  'MORA',
  'DESERCION',
];

export const VISIT_TYPES: readonly VisitType[] = [
  'ORDINARIA',
  'SEGUIMIENTO',
  'MORA',
  'DESERCION',
  'CIERRE',
];

export const VISIT_MODALITIES: readonly VisitModality[] = ['VIRTUAL', 'PRESENCIAL'];

export const VISIT_CHARACTERISTICS: readonly VisitCharacteristic[] = [
  'ANUNCIADA',
  'ANONIMA',
  'SORPRESIVA',
];

// RN-15: combinaciones válidas de modalidad/característica (visits_modality_characteristic).
export const CHARACTERISTICS_BY_MODALITY: Record<VisitModality, readonly VisitCharacteristic[]> = {
  VIRTUAL: ['ANUNCIADA', 'ANONIMA'],
  PRESENCIAL: ['ANUNCIADA', 'SORPRESIVA'],
};

// RN-05 / RN-06: estados activos vs. finales de una visita.
export const ACTIVE_VISIT_STATUSES: readonly VisitStatus[] = ['PROGRAMADA', 'REPROGRAMADA'];
export const FINAL_VISIT_STATUSES: readonly VisitStatus[] = [
  'CANCELADA',
  'REALIZADA',
  'NO_REALIZADA',
];

export function isSupervisable(status: AssociationStatus): boolean {
  return (SUPERVISABLE_STATUSES as AssociationStatus[]).includes(status);
}

export function isActiveVisitStatus(status: VisitStatus): boolean {
  return (ACTIVE_VISIT_STATUSES as VisitStatus[]).includes(status);
}
