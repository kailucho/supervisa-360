import { describe, expect, it } from 'vitest';
import { getMonthRangeISO, parseISODate, shiftMonth } from './date';

describe('parseISODate', () => {
  it('no desplaza la fecha un día (evita el bug de new Date(iso) en UTC-5)', () => {
    const date = parseISODate('2026-07-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // julio = índice 6
    expect(date.getDate()).toBe(1);
  });
});

describe('getMonthRangeISO', () => {
  it('el rango es [inicio de mes, inicio del mes siguiente)', () => {
    expect(getMonthRangeISO(2026, 7)).toEqual({
      start: '2026-07-01',
      nextMonthStart: '2026-08-01',
    });
  });

  it('diciembre pasa correctamente al año siguiente', () => {
    expect(getMonthRangeISO(2026, 12)).toEqual({
      start: '2026-12-01',
      nextMonthStart: '2027-01-01',
    });
  });
});

describe('shiftMonth', () => {
  it('avanza un mes dentro del mismo año', () => {
    expect(shiftMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
  });

  it('retrocede de enero a diciembre del año anterior', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('avanza de diciembre a enero del año siguiente', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
});
