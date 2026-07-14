import type {
  AssociationStatus,
  VisitCharacteristic,
  VisitModality,
  VisitStatus,
  VisitType,
} from '@/shared/types/domain';

export const ASSOCIATION_STATUS_LABELS: Record<AssociationStatus, string> = {
  NUEVA: 'Nueva',
  NORMAL: 'Normal',
  MORA: 'Mora',
  DESERCION: 'Deserción',
  REORGANIZACION: 'Reorganización',
  PROCESO_DISOLUCION: 'Proceso de disolución',
  DISUELTA: 'Disuelta',
};

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export const ASSOCIATION_STATUS_COLORS: Record<AssociationStatus, ChipColor> = {
  NUEVA: 'info',
  NORMAL: 'success',
  MORA: 'warning',
  DESERCION: 'error',
  REORGANIZACION: 'default',
  PROCESO_DISOLUCION: 'default',
  DISUELTA: 'default',
};

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  PROGRAMADA: 'Programada',
  REPROGRAMADA: 'Reprogramada',
  CANCELADA: 'Cancelada',
  REALIZADA: 'Realizada',
  NO_REALIZADA: 'No realizada',
};

export const VISIT_STATUS_COLORS: Record<VisitStatus, ChipColor> = {
  PROGRAMADA: 'primary',
  REPROGRAMADA: 'warning',
  CANCELADA: 'default',
  REALIZADA: 'success',
  NO_REALIZADA: 'error',
};

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  ORDINARIA: 'Ordinaria',
  SEGUIMIENTO: 'Seguimiento',
  MORA: 'Mora',
  DESERCION: 'Deserción',
  CIERRE: 'Cierre',
};

export const VISIT_MODALITY_LABELS: Record<VisitModality, string> = {
  VIRTUAL: 'Virtual',
  PRESENCIAL: 'Presencial',
};

export const VISIT_CHARACTERISTIC_LABELS: Record<VisitCharacteristic, string> = {
  ANUNCIADA: 'Anunciada',
  ANONIMA: 'Anónima',
  SORPRESIVA: 'Sorpresiva',
};
