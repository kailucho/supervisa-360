import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLimaNowYearMonth } from '@/shared/utils/date';

export interface YearMonth {
  year: number;
  month: number;
}

function parseIntParam(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/**
 * Año y mes persistidos en query params (?year=2026&month=7) para que el
 * periodo se conserve al navegar entre el dashboard de jefatura y el detalle
 * de sede. Valores ausentes o inválidos usan el mes actual de Lima.
 */
export function useYearMonthParams(): [YearMonth, (next: YearMonth) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = getLimaNowYearMonth();

  const year = parseIntParam(searchParams.get('year'), 2025, 2100) ?? now.year;
  const month = parseIntParam(searchParams.get('month'), 1, 12) ?? now.month;

  const setYearMonth = useCallback(
    (next: YearMonth) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('year', String(next.year));
          params.set('month', String(next.month));
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [{ year, month }, setYearMonth];
}
