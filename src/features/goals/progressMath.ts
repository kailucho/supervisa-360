import type { MonthlyProgressRow } from '@/shared/types/domain';

export interface ProgressSummary {
  target: number;
  done: number;
  active: number;
  missing: number;
}

// RN-25, RN-26: solo REALIZADA cuenta para lo hecho; faltante nunca es negativo.
export function summarizeProgress(target: number, done: number, active: number): ProgressSummary {
  return {
    target,
    done,
    active,
    missing: Math.max(target - done, 0),
  };
}

export function summarizeIndividualProgress(row: MonthlyProgressRow | null): ProgressSummary {
  return summarizeProgress(
    row?.individual_target ?? 0,
    row?.individual_done ?? 0,
    row?.individual_active ?? 0,
  );
}

// RN-24: la meta conjunta es la suma de las metas individuales, no un valor guardado aparte.
// Todas las filas de v_monthly_progress para un mismo (year, month) ya traen el mismo
// joint_* (window function), así que basta con leer la primera fila disponible.
export function summarizeJointProgress(rows: MonthlyProgressRow[]): ProgressSummary {
  const [first] = rows;
  return summarizeProgress(
    first?.joint_target ?? 0,
    first?.joint_done ?? 0,
    first?.joint_active ?? 0,
  );
}

export function progressPercent(summary: ProgressSummary): number {
  if (summary.target <= 0) return 0;
  return Math.min(100, Math.round((summary.done / summary.target) * 100));
}
