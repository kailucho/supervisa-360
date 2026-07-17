import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDocumentFeedbackRow } from '@/shared/types/domain';

// Mock del cliente: registra qué tablas se tocan y simula Storage.
const fromMock = vi.fn();
const storageUpload = vi.fn();
const storageRemove = vi.fn();

vi.mock('./client', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => storageUpload(...args),
        remove: (...args: unknown[]) => storageRemove(...args),
      }),
    },
  },
}));

// La compresión usa Canvas (no disponible en jsdom): se simula.
vi.mock('@/shared/utils/imageCompression', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/utils/imageCompression')>();
  return {
    ...original,
    compressImage: vi.fn(async () => ({
      blob: new Blob(['x'], { type: 'image/webp' }),
      mimeType: 'image/webp',
      extension: 'webp',
    })),
  };
});

import {
  deleteVisitDocument,
  uploadVisitDocument,
  uploadVisitPhoto,
  validateDocumentFile,
} from './visitEvidence';

interface TableCall {
  insert?: unknown;
  update?: unknown;
  delete?: boolean;
}

let tableCalls: Map<string, TableCall[]>;

function tableStub(table: string, result: { data?: unknown; error?: unknown } = {}) {
  const calls = tableCalls.get(table) ?? [];
  tableCalls.set(table, calls);
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain = {
    insert(payload: unknown) {
      calls.push({ insert: payload });
      return chain;
    },
    update(payload: unknown) {
      calls.push({ update: payload });
      return chain;
    },
    delete() {
      calls.push({ delete: true });
      return chain;
    },
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(resolved),
    maybeSingle: () => Promise.resolve(resolved),
    then: (onFulfilled: (value: typeof resolved) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled),
  };
  return chain;
}

beforeEach(() => {
  tableCalls = new Map();
  fromMock.mockReset();
  storageUpload.mockReset().mockResolvedValue({ data: {}, error: null });
  storageRemove.mockReset().mockResolvedValue({ data: [], error: null });
});

const documentRow: VisitDocumentFeedbackRow = {
  id: 'doc-1',
  visit_id: 'visit-1',
  storage_path: 'visit-1/document-feedback/old.pdf',
  original_name: 'anterior.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1000,
  uploaded_by: 'sup-1',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

describe('validateDocumentFile (un único PDF ≤ 10 MB)', () => {
  it('rechaza formatos que no sean PDF', () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    expect(validateDocumentFile(file)).toMatch(/PDF/);
  });

  it('rechaza PDFs de más de 10 MB', () => {
    const big = new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'grande.pdf', {
      type: 'application/pdf',
    });
    expect(validateDocumentFile(big)).toMatch(/10 MB/);
  });

  it('acepta un PDF válido', () => {
    const ok = new File(['x'], 'retro.pdf', { type: 'application/pdf' });
    expect(validateDocumentFile(ok)).toBeNull();
  });
});

describe('uploadVisitPhoto', () => {
  it('sube el archivo y registra la fila sin tocar la tabla visits (metas intactas)', async () => {
    fromMock.mockImplementation((table: string) => tableStub(table, { data: { id: 'photo-1' } }));
    await uploadVisitPhoto('visit-1', new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(tableCalls.has('visit_photos')).toBe(true);
    // Regresión §9: subir evidencia jamás modifica la visita ni su resultado.
    expect(tableCalls.has('visits')).toBe(false);
  });

  it('si la fila falla (p. ej. tope de 10), elimina el archivo subido (sin huérfanos)', async () => {
    fromMock.mockImplementation((table: string) =>
      tableStub(table, { error: { code: 'P0001', message: 'PHOTO_LIMIT_REACHED: …' } }),
    );
    await expect(
      uploadVisitPhoto('visit-1', new File(['x'], 'foto.jpg', { type: 'image/jpeg' })),
    ).rejects.toMatchObject({ code: 'P0001' });
    expect(storageRemove).toHaveBeenCalledTimes(1);
  });
});

describe('uploadVisitDocument (reemplazo conserva solo el archivo actual)', () => {
  it('en reemplazo: sube el nuevo, actualiza la fila y borra el archivo anterior', async () => {
    fromMock.mockImplementation((table: string) =>
      tableStub(table, {
        data: { ...documentRow, storage_path: 'visit-1/document-feedback/new.pdf' },
      }),
    );
    const file = new File(['x'], 'nuevo.pdf', { type: 'application/pdf' });
    await uploadVisitDocument('visit-1', file, documentRow);

    expect(storageUpload).toHaveBeenCalledTimes(1);
    const updates = (tableCalls.get('visit_document_feedback') ?? []).filter((c) => c.update);
    expect(updates).toHaveLength(1);
    // El archivo anterior se elimina después de actualizar la fila.
    expect(storageRemove).toHaveBeenCalledWith(['visit-1/document-feedback/old.pdf']);
    // Regresión §9: nunca se toca la tabla visits.
    expect(tableCalls.has('visits')).toBe(false);
  });

  it('si la fila falla, borra el archivo nuevo y conserva el anterior', async () => {
    fromMock.mockImplementation((table: string) =>
      tableStub(table, { error: { code: '42501', message: 'permission denied' } }),
    );
    const file = new File(['x'], 'nuevo.pdf', { type: 'application/pdf' });
    await expect(uploadVisitDocument('visit-1', file, documentRow)).rejects.toBeTruthy();
    // Se elimina solo el archivo recién subido, nunca el anterior.
    expect(storageRemove).toHaveBeenCalledTimes(1);
    const removedPaths = storageRemove.mock.calls[0][0] as string[];
    expect(removedPaths[0]).not.toBe('visit-1/document-feedback/old.pdf');
  });

  it('rechaza archivos inválidos sin subir nada', async () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    await expect(uploadVisitDocument('visit-1', file, null)).rejects.toThrow(/PDF/);
    expect(storageUpload).not.toHaveBeenCalled();
  });
});

describe('deleteVisitDocument', () => {
  it('elimina la fila y después el archivo', async () => {
    fromMock.mockImplementation((table: string) => tableStub(table, {}));
    await deleteVisitDocument(documentRow);
    expect(tableCalls.get('visit_document_feedback')?.some((c) => c.delete)).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(['visit-1/document-feedback/old.pdf']);
  });
});
