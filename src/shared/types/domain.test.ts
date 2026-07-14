import { describe, expect, it } from 'vitest';
import { isActiveVisitStatus, isSupervisable } from './domain';

describe('isSupervisable (RN-01, RN-02)', () => {
  it('permite programar visitas a asociaciones en estados activos', () => {
    expect(isSupervisable('NUEVA')).toBe(true);
    expect(isSupervisable('NORMAL')).toBe(true);
    expect(isSupervisable('MORA')).toBe(true);
    expect(isSupervisable('DESERCION')).toBe(true);
  });

  it('bloquea asociaciones en estados no supervisables', () => {
    expect(isSupervisable('REORGANIZACION')).toBe(false);
    expect(isSupervisable('PROCESO_DISOLUCION')).toBe(false);
    expect(isSupervisable('DISUELTA')).toBe(false);
  });
});

describe('isActiveVisitStatus (RN-05, RN-06)', () => {
  it('PROGRAMADA y REPROGRAMADA son activas', () => {
    expect(isActiveVisitStatus('PROGRAMADA')).toBe(true);
    expect(isActiveVisitStatus('REPROGRAMADA')).toBe(true);
  });

  it('CANCELADA, REALIZADA y NO_REALIZADA son finales', () => {
    expect(isActiveVisitStatus('CANCELADA')).toBe(false);
    expect(isActiveVisitStatus('REALIZADA')).toBe(false);
    expect(isActiveVisitStatus('NO_REALIZADA')).toBe(false);
  });
});
