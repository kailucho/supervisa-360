import { describe, expect, it } from 'vitest';
import {
  progressPercent,
  sumIndividualProgress,
  sumJointProgress,
  summarizeProgress,
} from './progressMath';
import type { IndividualProgressRow, JointProgressRow } from '@/shared/types/domain';

function individualRow(overrides: Partial<IndividualProgressRow>): IndividualProgressRow {
  return {
    region_id: 'region-aqp',
    region_name: 'Arequipa',
    supervisor_id: 'sup-1',
    supervisor_name: 'Supervisora 1',
    year: 2026,
    month: 7,
    individual_target: 15,
    individual_done: 0,
    individual_active: 0,
    has_goal: true,
    ...overrides,
  };
}

function jointRow(overrides: Partial<JointProgressRow>): JointProgressRow {
  return {
    region_id: 'region-aqp',
    region_name: 'Arequipa',
    year: 2026,
    month: 7,
    suggested_joint_target: 18,
    configured_joint_target: null,
    effective_joint_target: 18,
    joint_done: 0,
    joint_active: 0,
    is_configured: false,
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

describe('sumIndividualProgress (RN-29: metas por sede)', () => {
  it('devuelve ceros sin filas', () => {
    expect(sumIndividualProgress([])).toEqual({ target: 0, done: 0, active: 0, missing: 0 });
  });

  it('suma las filas de todas las sedes de la supervisora', () => {
    const rows = [
      individualRow({ region_id: 'aqp', individual_target: 10, individual_done: 4 }),
      individualRow({ region_id: 'tac', individual_target: 5, individual_done: 1 }),
    ];
    expect(sumIndividualProgress(rows)).toEqual({ target: 15, done: 5, active: 0, missing: 10 });
  });

  it('las visitas cuentan aunque no exista meta en esa sede (has_goal = false)', () => {
    const rows = [
      individualRow({
        region_id: 'tac',
        individual_target: 0,
        individual_done: 2,
        has_goal: false,
      }),
    ];
    expect(sumIndividualProgress(rows)).toEqual({ target: 0, done: 2, active: 0, missing: 0 });
  });
});

describe('sumJointProgress (RN-30: meta efectiva = configurada o sugerida)', () => {
  it('devuelve ceros sin filas', () => {
    expect(sumJointProgress([])).toEqual({ target: 0, done: 0, active: 0, missing: 0 });
  });

  it('usa la meta efectiva de cada sede (configurada si existe)', () => {
    const rows = [
      jointRow({
        region_id: 'aqp',
        suggested_joint_target: 18,
        configured_joint_target: 20,
        effective_joint_target: 20,
        joint_done: 2,
        is_configured: true,
      }),
      jointRow({
        region_id: 'tac',
        suggested_joint_target: 12,
        configured_joint_target: null,
        effective_joint_target: 12,
        joint_done: 1,
        is_configured: false,
      }),
    ];
    // 20 (configurada AQP) + 12 (sugerida TAC), no 18 + 12.
    expect(sumJointProgress(rows)).toEqual({ target: 32, done: 3, active: 0, missing: 29 });
  });

  it('las visitas de una sede no se mezclan con las de otra', () => {
    const tacna = jointRow({
      region_id: 'tac',
      region_name: 'Tacna',
      effective_joint_target: 12,
      joint_done: 1,
    });
    const arequipa = jointRow({ region_id: 'aqp', effective_joint_target: 20, joint_done: 2 });
    expect(sumJointProgress([arequipa]).done).toBe(2);
    expect(sumJointProgress([tacna]).done).toBe(1);
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
