import type { IndividualProgressRow, JointProgressRow } from '@/shared/types/domain';

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

/**
 * Suma las filas de v_individual_monthly_progress (una por sede) de una misma
 * supervisora. Las visitas cuentan aunque la fila no tenga meta (has_goal=false).
 */
export function sumIndividualProgress(rows: IndividualProgressRow[]): ProgressSummary {
  return summarizeProgress(
    rows.reduce((acc, row) => acc + (row.individual_target ?? 0), 0),
    rows.reduce((acc, row) => acc + (row.individual_done ?? 0), 0),
    rows.reduce((acc, row) => acc + (row.individual_active ?? 0), 0),
  );
}

/**
 * RN-30: cada fila de v_joint_monthly_progress ya trae la meta efectiva de su
 * sede (configurada por el jefe si existe; sugerida en caso contrario). La suma
 * entre sedes usa siempre la efectiva.
 */
export function sumJointProgress(rows: JointProgressRow[]): ProgressSummary {
  return summarizeProgress(
    rows.reduce((acc, row) => acc + (row.effective_joint_target ?? 0), 0),
    rows.reduce((acc, row) => acc + (row.joint_done ?? 0), 0),
    rows.reduce((acc, row) => acc + (row.joint_active ?? 0), 0),
  );
}

export function progressPercent(summary: ProgressSummary): number {
  if (summary.target <= 0) return 0;
  return Math.min(100, Math.round((summary.done / summary.target) * 100));
}
