// Utilidades de fecha para Supervisa 360.
//
// La app se usa en Perú y las columnas `date` de PostgreSQL (scheduled_date,
// performed_date) son fechas de calendario sin zona horaria. `new Date('YYYY-MM-DD')`
// las interpreta como medianoche UTC, lo que en horario peruano (UTC-5) las corre un
// día hacia atrás al mostrarlas. Por eso aquí nunca se parsean fechas ISO con el
// constructor `Date` directamente: siempre se descompone el string y se construye un
// `Date` en horario local con año/mes/día explícitos.

const LIMA_TIME_ZONE = 'America/Lima';

export function getLimaTodayISODate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getLimaNowYearMonth(): { year: number; month: number } {
  const [year, month] = getLimaTodayISODate().split('-').map(Number);
  return { year, month };
}

/** Convierte una fecha `YYYY-MM-DD` en un `Date` a medianoche en horario local del navegador. */
export function parseISODate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateEsPE(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  return parseISODate(isoDate).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** `HH:MM:SS` (o `HH:MM`) de Postgres → `HH:MM` para mostrar. */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '—';
  return time.slice(0, 5);
}

export function getMonthRangeISO(
  year: number,
  month: number,
): { start: string; nextMonthStart: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, nextMonthStart };
}

export function getMonthLabel(year: number, month: number): string {
  const label = new Date(year, month - 1, 1).toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}
