import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  monthlyGoalSchema,
  scoreSchema,
  visitResultSchema,
  visitScheduleSchema,
} from './schemas';

describe('scoreSchema (RN-19)', () => {
  it('acepta enteros entre 0 y 5', () => {
    for (const value of [0, 1, 2, 3, 4, 5]) {
      expect(scoreSchema.safeParse(value).success).toBe(true);
    }
  });

  it('rechaza valores negativos', () => {
    const result = scoreSchema.safeParse(-1);
    expect(result.success).toBe(false);
  });

  it('rechaza valores mayores a 5', () => {
    const result = scoreSchema.safeParse(6);
    expect(result.success).toBe(false);
  });

  it('rechaza decimales', () => {
    expect(scoreSchema.safeParse(4.5).success).toBe(false);
    expect(scoreSchema.safeParse('4.5').success).toBe(false);
  });

  it('acepta strings numéricas enteras (entrada de formulario)', () => {
    const result = scoreSchema.safeParse('3');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(3);
  });
});

describe('visitResultSchema (RN-16, RN-19, RN-21)', () => {
  const base = {
    performedDate: '2026-07-10',
    startTime: '09:00',
    endTime: '10:00',
    score: 4,
    generalComment: 'Todo en orden.',
  };

  it('acepta un resultado completo y válido', () => {
    expect(visitResultSchema.safeParse(base).success).toBe(true);
  });

  it('exige fecha realizada', () => {
    const result = visitResultSchema.safeParse({ ...base, performedDate: '' });
    expect(result.success).toBe(false);
  });

  it('exige puntuación', () => {
    const result = visitResultSchema.safeParse({ ...base, score: undefined });
    expect(result.success).toBe(false);
  });

  it('exige comentario no vacío ni solo espacios', () => {
    expect(visitResultSchema.safeParse({ ...base, generalComment: '' }).success).toBe(false);
    expect(visitResultSchema.safeParse({ ...base, generalComment: '   ' }).success).toBe(false);
  });

  it('permite horas vacías (son opcionales e independientes)', () => {
    const result = visitResultSchema.safeParse({ ...base, startTime: '', endTime: '' });
    expect(result.success).toBe(true);
  });

  it('rechaza cuando la hora de fin es anterior a la de inicio', () => {
    const result = visitResultSchema.safeParse({ ...base, startTime: '10:00', endTime: '09:00' });
    expect(result.success).toBe(false);
  });

  it('acepta cuando solo hay una de las dos horas', () => {
    expect(visitResultSchema.safeParse({ ...base, startTime: '09:00', endTime: '' }).success).toBe(
      true,
    );
    expect(visitResultSchema.safeParse({ ...base, startTime: '', endTime: '10:00' }).success).toBe(
      true,
    );
  });
});

describe('visitScheduleSchema (RN-15)', () => {
  it('acepta VIRTUAL + ANUNCIADA o ANONIMA', () => {
    const okAnunciada = visitScheduleSchema.safeParse({
      scheduledDate: '2026-07-10',
      scheduledTime: '',
      visitType: 'ORDINARIA',
      modality: 'VIRTUAL',
      characteristic: 'ANUNCIADA',
    });
    expect(okAnunciada.success).toBe(true);
  });

  it('rechaza VIRTUAL + SORPRESIVA', () => {
    const result = visitScheduleSchema.safeParse({
      scheduledDate: '2026-07-10',
      scheduledTime: '',
      visitType: 'ORDINARIA',
      modality: 'VIRTUAL',
      characteristic: 'SORPRESIVA',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza PRESENCIAL + ANONIMA', () => {
    const result = visitScheduleSchema.safeParse({
      scheduledDate: '2026-07-10',
      scheduledTime: '',
      visitType: 'ORDINARIA',
      modality: 'PRESENCIAL',
      characteristic: 'ANONIMA',
    });
    expect(result.success).toBe(false);
  });

  it('acepta PRESENCIAL + SORPRESIVA', () => {
    const result = visitScheduleSchema.safeParse({
      scheduledDate: '2026-07-10',
      scheduledTime: '',
      visitType: 'ORDINARIA',
      modality: 'PRESENCIAL',
      characteristic: 'SORPRESIVA',
    });
    expect(result.success).toBe(true);
  });
});

describe('monthlyGoalSchema (RN-23)', () => {
  it('acepta cero', () => {
    expect(monthlyGoalSchema.safeParse({ targetVisits: 0 }).success).toBe(true);
  });

  it('rechaza negativos', () => {
    expect(monthlyGoalSchema.safeParse({ targetVisits: -1 }).success).toBe(false);
  });

  it('rechaza decimales', () => {
    expect(monthlyGoalSchema.safeParse({ targetVisits: 1.5 }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('rechaza correo inválido', () => {
    expect(loginSchema.safeParse({ email: 'no-es-correo', password: 'x' }).success).toBe(false);
  });

  it('exige contraseña no vacía', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('acepta credenciales bien formadas', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secreta' }).success).toBe(true);
  });
});
