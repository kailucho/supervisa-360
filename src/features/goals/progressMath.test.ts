import { describe, expect, it } from 'vitest';
import {
  progressPercent,
  summarizeIndividualProgress,
  summarizeJointProgress,
  summarizeProgress,
} from './progressMath';
import type { MonthlyProgressRow } from '@/shared/types/domain';

function row(overrides: Partial<MonthlyProgressRow>): MonthlyProgressRow {
  return {
    supervisor_id: 'sup-1',
    year: 2026,
    month: 7,
    individual_target: 15,
    individual_done: 0,
    individual_active: 0,
    joint_target: 30,
    joint_done: 0,
    joint_active: 0,
    ...overrides,
  };
}

describe('summarizeProgress (RN-25, RN-26)', () => {
  it('el faltante nunca es negativo, aunque se supere la meta', () => {
    expect(summarizeProgress(15, 20, 0).missing).toBe(0);
  });

  it('calcula el faltante como meta menos realizadas', () => {
    expect(summarizeProgress(15, 6, 2).missing).toBe(9);
  });
});

describe('summarizeIndividualProgress', () => {
  it('devuelve ceros cuando no hay fila de meta para esa supervisora', () => {
    const summary = summarizeIndividualProgress(null);
    expect(summary).toEqual({ target: 0, done: 0, active: 0, missing: 0 });
  });

  it('lee los conteos de la fila de progreso individual', () => {
    const summary = summarizeIndividualProgress(
      row({ individual_target: 15, individual_done: 4, individual_active: 2 }),
    );
    expect(summary).toEqual({ target: 15, done: 4, active: 2, missing: 11 });
  });
});

describe('summarizeJointProgress (RN-24: suma de metas individuales)', () => {
  it('devuelve ceros cuando no hay ninguna meta ese mes', () => {
    expect(summarizeJointProgress([])).toEqual({ target: 0, done: 0, active: 0, missing: 0 });
  });

  it('usa los joint_* ya agregados por la vista (mismos en todas las filas del mes)', () => {
    const rows = [
      row({
        supervisor_id: 'a',
        individual_done: 4,
        joint_target: 30,
        joint_done: 6,
        joint_active: 3,
      }),
      row({
        supervisor_id: 'b',
        individual_done: 2,
        joint_target: 30,
        joint_done: 6,
        joint_active: 3,
      }),
    ];
    expect(summarizeJointProgress(rows)).toEqual({ target: 30, done: 6, active: 3, missing: 24 });
  });
});

describe('progressPercent', () => {
  it('es 0 cuando la meta es 0 (evita división por cero)', () => {
    expect(progressPercent({ target: 0, done: 0, active: 0, missing: 0 })).toBe(0);
  });

  it('redondea y limita a 100', () => {
    expect(progressPercent({ target: 15, done: 4, active: 0, missing: 11 })).toBe(27);
    expect(progressPercent({ target: 15, done: 20, active: 0, missing: 0 })).toBe(100);
  });
});
