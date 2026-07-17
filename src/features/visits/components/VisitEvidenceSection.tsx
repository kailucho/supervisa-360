import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { canManageVisitEvidence } from '@/shared/utils/permissions';
import { translateError } from '@/services/supabase/errors';
import {
  MAX_PHOTOS_PER_VISIT,
  deleteVisitDocument,
  deleteVisitPhoto,
  fetchVisitDocument,
  fetchVisitPhotos,
  getSignedEvidenceUrl,
  getSignedEvidenceUrls,
  uploadVisitDocument,
  uploadVisitPhoto,
  validateDocumentFile,
} from '@/services/supabase/visitEvidence';
import type { VisitPhotoRow, VisitRow } from '@/shared/types/domain';

// Evidencias de una visita REALIZADA. Las fechas de estas evidencias jamás
// intervienen en las metas: el avance se calcula solo con visits.status y
// visits.performed_date.

export function VisitEvidenceSection({ visit }: { visit: VisitRow }) {
  const { profile } = useAuth();
  const canEdit = canManageVisitEvidence(profile, visit);

  if (visit.status !== 'REALIZADA') return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <VisitPhotos visitId={visit.id} canEdit={canEdit} />
      <VisitDocument visitId={visit.id} canEdit={canEdit} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Fotografías
// ---------------------------------------------------------------------------

interface UploadProgress {
  total: number;
  done: number;
  failures: string[];
}

function VisitPhotos({ visitId, canEdit }: { visitId: string; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<VisitPhotoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    data: photos,
    loading,
    reload,
  } = useAsyncData(() => fetchVisitPhotos(visitId), [visitId]);

  const { data: urls } = useAsyncData(async () => {
    const paths = (photos ?? []).map((photo) => photo.storage_path);
    return getSignedEvidenceUrls(paths);
  }, [photos]);

  const remaining = MAX_PHOTOS_PER_VISIT - (photos?.length ?? 0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = [...files].slice(0, Math.max(0, remaining));
    const skipped = files.length - selected.length;
    setError(null);
    setProgress({ total: selected.length, done: 0, failures: [] });

    const failures: string[] = [];
    for (const file of selected) {
      try {
        await uploadVisitPhoto(visitId, file);
      } catch (err) {
        // Una foto fallida no cancela las demás.
        failures.push(`${file.name}: ${translateError(err).message}`);
      } finally {
        setProgress((current) =>
          current ? { ...current, done: current.done + 1, failures } : current,
        );
      }
    }
    setProgress(null);
    if (skipped > 0) {
      failures.push(
        `Se omitieron ${skipped} archivo(s): se alcanzó el máximo de ${MAX_PHOTOS_PER_VISIT} fotografías.`,
      );
    }
    if (failures.length > 0) setError(failures.join(' · '));
    reload();
  };

  const handleDelete = async () => {
    if (!photoToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteVisitPhoto(photoToDelete);
      setPhotoToDelete(null);
      reload();
    } catch (err) {
      setError(translateError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="subtitle2" component="h3">
          Fotografías
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {photos?.length ?? 0} de {MAX_PHOTOS_PER_VISIT}
        </Typography>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <Button
              size="small"
              startIcon={<AddPhotoAlternateRoundedIcon />}
              disabled={remaining <= 0 || progress != null}
              onClick={() => inputRef.current?.click()}
            >
              Subir fotos
            </Button>
          </>
        ) : null}
      </Box>

      {progress ? (
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={(progress.done / progress.total) * 100}
            aria-label="Progreso de subida de fotografías"
          />
          <Typography variant="caption" color="text.secondary">
            Subiendo {progress.done} de {progress.total}…
          </Typography>
        </Box>
      ) : null}

      {error ? (
        <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <CircularProgress size={20} sx={{ mt: 1 }} />
      ) : (photos?.length ?? 0) === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {canEdit
            ? 'Todavía no hay fotografías de esta visita.'
            : 'Esta visita no tiene fotografías.'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {(photos ?? []).map((photo) => {
            const url = urls?.get(photo.storage_path);
            return (
              <Box
                key={photo.id}
                sx={{
                  position: 'relative',
                  width: 96,
                  height: 96,
                  borderRadius: 1,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                }}
              >
                {url ? (
                  <Link href={url} target="_blank" rel="noopener">
                    <Box
                      component="img"
                      src={url}
                      alt={`Fotografía ${photo.original_name}`}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </Link>
                ) : (
                  <CircularProgress size={20} sx={{ m: 'auto', mt: 4 }} />
                )}
                {canEdit ? (
                  <IconButton
                    size="small"
                    aria-label={`Eliminar fotografía ${photo.original_name}`}
                    onClick={() => setPhotoToDelete(photo)}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}

      <ConfirmDialog
        open={Boolean(photoToDelete)}
        title="Eliminar fotografía"
        description="La fotografía se eliminará definitivamente de la visita. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={deleting}
        onCancel={() => setPhotoToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Documento de retroalimentación (un único PDF)
// ---------------------------------------------------------------------------

function VisitDocument({ visitId, canEdit }: { visitId: string; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: doc, loading, reload } = useAsyncData(() => fetchVisitDocument(visitId), [visitId]);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const validation = validateDocumentFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadVisitDocument(visitId, file, doc ?? null);
      reload();
    } catch (err) {
      setError(translateError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    if (!doc) return;
    setError(null);
    try {
      const url = await getSignedEvidenceUrl(doc.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(translateError(err).message);
    }
  };

  const handleDelete = async () => {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      await deleteVisitDocument(doc);
      setConfirmDelete(false);
      reload();
    } catch (err) {
      setError(translateError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" component="h3">
        Retroalimentación de documentos
      </Typography>

      {error ? (
        <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {canEdit ? (
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(event) => {
            void handleFile(event.target.files);
            event.target.value = '';
          }}
        />
      ) : null}

      {loading ? (
        <CircularProgress size={20} sx={{ mt: 1 }} />
      ) : doc ? (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
          <PictureAsPdfRoundedIcon color="error" fontSize="small" aria-hidden />
          <Link component="button" type="button" onClick={() => void handleOpen()}>
            {doc.original_name}
          </Link>
          {canEdit ? (
            <>
              <Button size="small" disabled={busy} onClick={() => inputRef.current?.click()}>
                Reemplazar
              </Button>
              <Button
                size="small"
                color="error"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Eliminar
              </Button>
            </>
          ) : null}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Esta visita no tiene documento de retroalimentación.
          </Typography>
          {canEdit ? (
            <Button
              size="small"
              startIcon={<UploadFileRoundedIcon />}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Subiendo…' : 'Subir PDF'}
            </Button>
          ) : null}
        </Box>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar documento"
        description="El documento de retroalimentación se eliminará definitivamente. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </Box>
  );
}
