import { supabase } from './client';
import { compressImage } from '@/shared/utils/imageCompression';
import type { VisitDocumentFeedbackRow, VisitPhotoRow } from '@/shared/types/domain';

// Evidencias de una visita REALIZADA: fotografías (máx. 10) y un único
// documento PDF de retroalimentación. El bucket `visit-evidence` es privado:
// toda visualización/descarga usa URLs firmadas temporales, nunca públicas.
// Nada de este módulo toca la tabla `visits` ni las metas.

export const VISIT_EVIDENCE_BUCKET = 'visit-evidence';
export const MAX_PHOTOS_PER_VISIT = 10;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

export function photoStoragePath(visitId: string, extension: string): string {
  return `${visitId}/photos/${crypto.randomUUID()}.${extension}`;
}

export function documentStoragePath(visitId: string): string {
  return `${visitId}/document-feedback/${crypto.randomUUID()}.pdf`;
}

// ---------------------------------------------------------------------------
// Fotografías
// ---------------------------------------------------------------------------

export async function fetchVisitPhotos(visitId: string): Promise<VisitPhotoRow[]> {
  const { data, error } = await supabase
    .from('visit_photos')
    .select('*')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Comprime y sube una fotografía, y registra su fila. Si la fila no puede
 * crearse (p. ej. tope de 10), elimina el archivo recién subido para no dejar
 * huérfanos.
 */
export async function uploadVisitPhoto(visitId: string, file: File): Promise<VisitPhotoRow> {
  const compressed = await compressImage(file);
  const path = photoStoragePath(visitId, compressed.extension);

  const { error: uploadError } = await supabase.storage
    .from(VISIT_EVIDENCE_BUCKET)
    .upload(path, compressed.blob, { contentType: compressed.mimeType });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('visit_photos')
    .insert({
      visit_id: visitId,
      storage_path: path,
      original_name: file.name,
      mime_type: compressed.mimeType,
      size_bytes: compressed.blob.size,
      // uploaded_by lo fija la base de datos (default auth.uid() + trigger).
    })
    .select()
    .single();
  if (insertError) {
    await supabase.storage.from(VISIT_EVIDENCE_BUCKET).remove([path]);
    throw insertError;
  }
  return data;
}

/** Elimina primero la fila (autorización RLS) y después el archivo. */
export async function deleteVisitPhoto(photo: VisitPhotoRow): Promise<void> {
  const { error } = await supabase.from('visit_photos').delete().eq('id', photo.id);
  if (error) throw error;
  const { error: storageError } = await supabase.storage
    .from(VISIT_EVIDENCE_BUCKET)
    .remove([photo.storage_path]);
  if (storageError) throw storageError;
}

// ---------------------------------------------------------------------------
// Documento de retroalimentación (un único PDF por visita)
// ---------------------------------------------------------------------------

export async function fetchVisitDocument(
  visitId: string,
): Promise<VisitDocumentFeedbackRow | null> {
  const { data, error } = await supabase
    .from('visit_document_feedback')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function validateDocumentFile(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return 'El documento de retroalimentación debe ser un archivo PDF.';
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return 'El PDF supera el máximo de 10 MB.';
  }
  return null;
}

/**
 * Sube (o reemplaza) el documento de la visita: primero el archivo nuevo,
 * luego la fila; recién entonces se elimina el archivo anterior. Si la fila
 * falla, se borra el archivo nuevo para no dejar huérfanos.
 */
export async function uploadVisitDocument(
  visitId: string,
  file: File,
  current: VisitDocumentFeedbackRow | null,
): Promise<VisitDocumentFeedbackRow> {
  const validation = validateDocumentFile(file);
  if (validation) throw new Error(validation);

  const path = documentStoragePath(visitId);
  const { error: uploadError } = await supabase.storage
    .from(VISIT_EVIDENCE_BUCKET)
    .upload(path, file, { contentType: 'application/pdf' });
  if (uploadError) throw uploadError;

  let row: VisitDocumentFeedbackRow;
  try {
    if (current) {
      const { data, error } = await supabase
        .from('visit_document_feedback')
        .update({
          storage_path: path,
          original_name: file.name,
          mime_type: 'application/pdf',
          size_bytes: file.size,
        })
        .eq('id', current.id)
        .select()
        .single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabase
        .from('visit_document_feedback')
        .insert({
          visit_id: visitId,
          storage_path: path,
          original_name: file.name,
          mime_type: 'application/pdf',
          size_bytes: file.size,
          // uploaded_by lo fija la base de datos (default auth.uid() + trigger).
        })
        .select()
        .single();
      if (error) throw error;
      row = data;
    }
  } catch (error) {
    await supabase.storage.from(VISIT_EVIDENCE_BUCKET).remove([path]);
    throw error;
  }

  if (current && current.storage_path !== path) {
    // Reemplazo: se conserva únicamente el archivo actual.
    await supabase.storage.from(VISIT_EVIDENCE_BUCKET).remove([current.storage_path]);
  }
  return row;
}

export async function deleteVisitDocument(doc: VisitDocumentFeedbackRow): Promise<void> {
  const { error } = await supabase.from('visit_document_feedback').delete().eq('id', doc.id);
  if (error) throw error;
  const { error: storageError } = await supabase.storage
    .from(VISIT_EVIDENCE_BUCKET)
    .remove([doc.storage_path]);
  if (storageError) throw storageError;
}

// ---------------------------------------------------------------------------
// URLs firmadas (bucket privado)
// ---------------------------------------------------------------------------

export async function getSignedEvidenceUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(VISIT_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

export async function getSignedEvidenceUrls(storagePaths: string[]): Promise<Map<string, string>> {
  if (storagePaths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from(VISIT_EVIDENCE_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}
