import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub encadenable del query builder de PostgREST que registra los filtros.
interface QueryLog {
  table: string;
  filters: [string, unknown][];
  limit: number | null;
}

let log: QueryLog;
let response: { data: unknown; error: unknown };

function chain() {
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      log.filters.push([column, value]);
      return builder;
    },
    in: () => builder,
    gte: () => builder,
    lt: () => builder,
    is: () => builder,
    order: () => builder,
    limit: (n: number) => {
      log.limit = n;
      return builder;
    },
    then: (onFulfilled: (value: typeof response) => unknown) =>
      Promise.resolve(response).then(onFulfilled),
  };
  return builder;
}

vi.mock('./client', () => ({
  supabase: {
    from: (table: string) => {
      log.table = table;
      return chain();
    },
  },
}));

import { fetchRecentRealizedVisits } from './visits';

beforeEach(() => {
  log = { table: '', filters: [], limit: null };
  response = { data: [], error: null };
});

describe('fetchRecentRealizedVisits (últimas visitas del Inicio)', () => {
  it('trae como máximo 10 visitas REALIZADAS por defecto', async () => {
    await fetchRecentRealizedVisits();
    expect(log.table).toBe('visits');
    expect(log.limit).toBe(10);
    expect(log.filters).toContainEqual(['status', 'REALIZADA']);
  });

  it('para una supervisora filtra por sus propias visitas', async () => {
    await fetchRecentRealizedVisits({ supervisorId: 'sup-1' });
    expect(log.filters).toContainEqual(['supervisor_id', 'sup-1']);
  });

  it('sin filtro de supervisora (jefatura) no restringe por supervisor_id', async () => {
    await fetchRecentRealizedVisits({ limit: 10 });
    expect(log.filters.some(([column]) => column === 'supervisor_id')).toBe(false);
  });

  it('mapea la cantidad de fotografías y la existencia del documento', async () => {
    response = {
      data: [
        {
          id: 'v-1',
          association_id: 'a-1',
          visit_photos: [{ count: 3 }],
          visit_document_feedback: { id: 'doc-1' },
        },
        {
          id: 'v-2',
          association_id: 'a-1', // la misma asociación puede repetirse
          visit_photos: [],
          visit_document_feedback: null,
        },
      ],
      error: null,
    };
    const result = await fetchRecentRealizedVisits();
    expect(result).toHaveLength(2);
    expect(result[0].photoCount).toBe(3);
    expect(result[0].hasDocument).toBe(true);
    expect(result[1].photoCount).toBe(0);
    expect(result[1].hasDocument).toBe(false);
    expect(result[0].association_id).toBe(result[1].association_id);
  });
});
