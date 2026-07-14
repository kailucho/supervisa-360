import { describe, expect, it } from 'vitest';
import { evaluateScheduleGuard } from './scheduleGuard';
import type { VisitRow } from '@/shared/types/domain';

const activeVisit = { id: 'v1', status: 'PROGRAMADA' } as VisitRow;

describe('evaluateScheduleGuard (RN-01/02, RN-12/13, RN-10/11/14)', () => {
  it('bloquea asociaciones no supervisables', () => {
    const result = evaluateScheduleGuard({
      associationStatus: 'DISUELTA',
      activeVisit: null,
      realizedVisitsThisYear: [],
      visitType: 'ORDINARIA',
    });
    expect(result.status).toBe('BLOCKED_NOT_SUPERVISABLE');
  });

  it('bloquea cuando ya existe una visita activa para la asociación', () => {
    const result = evaluateScheduleGuard({
      associationStatus: 'NORMAL',
      activeVisit,
      realizedVisitsThisYear: [],
      visitType: 'ORDINARIA',
    });
    expect(result.status).toBe('BLOCKED_ACTIVE_VISIT_EXISTS');
    if (result.status === 'BLOCKED_ACTIVE_VISIT_EXISTS') {
      expect(result.activeVisit).toBe(activeVisit);
    }
  });

  it('bloquea una segunda visita ORDINARIA cuando ya hubo una realizada este año', () => {
    const result = evaluateScheduleGuard({
      associationStatus: 'NORMAL',
      activeVisit: null,
      realizedVisitsThisYear: [{ visit_type: 'ORDINARIA' }],
      visitType: 'ORDINARIA',
    });
    expect(result.status).toBe('BLOCKED_ORDINARIA_ALREADY_DONE_THIS_YEAR');
  });

  it('permite SEGUIMIENTO con advertencia cuando ya hubo una visita realizada este año', () => {
    const result = evaluateScheduleGuard({
      associationStatus: 'NORMAL',
      activeVisit: null,
      realizedVisitsThisYear: [{ visit_type: 'ORDINARIA' }],
      visitType: 'SEGUIMIENTO',
    });
    expect(result.status).toBe('WARN_ALREADY_VISITED_THIS_YEAR');
  });

  it('permite ORDINARIA con advertencia si lo realizado este año no fue ORDINARIA', () => {
    const result = evaluateScheduleGuard({
      associationStatus: 'NORMAL',
      activeVisit: null,
      realizedVisitsThisYear: [{ visit_type: 'SEGUIMIENTO' }],
      visitType: 'ORDINARIA',
    });
    expect(result.status).toBe('WARN_ALREADY_VISITED_THIS_YEAR');
  });

  it('permite programar sin advertencias cuando no hay conflictos', () => {
    const result = evaluateScheduleGuard({
      associationStatus: 'NUEVA',
      activeVisit: null,
      realizedVisitsThisYear: [],
      visitType: 'ORDINARIA',
    });
    expect(result.status).toBe('OK');
  });
});
