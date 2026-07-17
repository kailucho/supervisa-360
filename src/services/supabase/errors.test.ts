import { describe, expect, it } from 'vitest';
import { translateAuthError, translateError } from './errors';

describe('translateError', () => {
  it('detecta la violación de visita activa única (RN-12) por el nombre del índice', () => {
    const result = translateError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "visits_one_active_per_association"',
    });
    expect(result.code).toBe('ACTIVE_VISIT_CONFLICT');
  });

  it('detecta meta personal duplicada por el nombre de la restricción (por sede)', () => {
    const result = translateError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "monthly_goals_supervisor_region_period_unique"',
    });
    expect(result.code).toBe('DUPLICATE_GOAL');
    expect(result.message).toContain('sede');
  });

  it('detecta meta conjunta duplicada por el nombre de la restricción', () => {
    const result = translateError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "regional_monthly_goals_region_period_unique"',
    });
    expect(result.code).toBe('DUPLICATE_GOAL');
    expect(result.message).toContain('conjunta');
  });

  it('detecta la exclusividad de asesor por sede y periodo (índice único parcial)', () => {
    const result = translateError({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "monthly_plan_assignments_active_unique"',
    });
    expect(result.code).toBe('ADVISOR_TAKEN');
  });

  it('traduce ADVISOR_TAKEN de la RPC conservando el nombre de la supervisora', () => {
    const result = translateError({
      code: 'P0001',
      message:
        'ADVISOR_TAKEN: El asesor Ana María Quispe ya está asignado a Supervisora de prueba 1 en esta sede y periodo',
    });
    expect(result.code).toBe('ADVISOR_TAKEN');
    expect(result.message).toContain('Supervisora de prueba 1');
    expect(result.message).not.toMatch(/^ADVISOR_TAKEN/);
  });

  it('detecta el tope de 10 fotografías por visita', () => {
    const result = translateError({
      code: 'P0001',
      message: 'PHOTO_LIMIT_REACHED: La visita ya tiene el máximo de 10 fotografías',
    });
    expect(result.code).toBe('PHOTO_LIMIT_REACHED');
    expect(result.message).toContain('10');
  });

  it('detecta evidencias sobre visitas no realizadas', () => {
    const result = translateError({
      code: 'P0001',
      message: 'EVIDENCE_VISIT_NOT_DONE: Solo se pueden subir fotografías a una visita realizada',
    });
    expect(result.code).toBe('EVIDENCE_VISIT_NOT_DONE');
  });

  it('detecta resultado incompleto (visits_result_completeness)', () => {
    const result = translateError({
      code: '23514',
      message:
        'new row for relation "visits" violates check constraint "visits_result_completeness"',
    });
    expect(result.code).toBe('INCOMPLETE_RESULT');
  });

  it('detecta horas inválidas (visits_hours_order)', () => {
    const result = translateError({
      code: '23514',
      message: 'new row for relation "visits" violates check constraint "visits_hours_order"',
    });
    expect(result.code).toBe('INVALID_TIME_RANGE');
  });

  it('detecta falta de permisos', () => {
    const result = translateError({ code: '42501', message: 'permission denied for table visits' });
    expect(result.code).toBe('PERMISSION_DENIED');
  });

  it('nunca expone el mensaje crudo de Postgres para errores desconocidos', () => {
    const result = translateError({
      code: '99999',
      message: 'ERROR: something internal at line 42',
    });
    expect(result.message).not.toContain('ERROR:');
    expect(result.code).toBe('UNKNOWN');
  });

  it('devuelve un error genérico ante entradas irreconocibles', () => {
    const result = translateError('boom');
    expect(result.code).toBe('UNKNOWN');
  });
});

describe('translateAuthError', () => {
  it('nunca revela si el correo existe o no', () => {
    const result = translateAuthError();
    expect(result.code).toBe('INVALID_CREDENTIALS');
    expect(result.message.toLowerCase()).not.toContain('no existe');
  });
});
