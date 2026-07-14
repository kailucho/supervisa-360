import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { fetchAssociationById, updateAssociation } from '@/services/supabase/associations';
import { fetchVisitHistory } from '@/services/supabase/visits';
import { fetchAdvisors } from '@/services/supabase/advisors';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { isSupervisable } from '@/shared/types/domain';
import {
  ASSOCIATION_STATUS_COLORS,
  ASSOCIATION_STATUS_LABELS,
  VISIT_CHARACTERISTIC_LABELS,
  VISIT_MODALITY_LABELS,
  VISIT_STATUS_COLORS,
  VISIT_STATUS_LABELS,
  VISIT_TYPE_LABELS,
} from '@/shared/utils/labels';
import { formatDateEsPE } from '@/shared/utils/date';
import { EditAssociationDialog } from '@/features/associations/components/EditAssociationDialog';
import { ScheduleVisitDialog } from '@/features/visits/components/ScheduleVisitDialog';
import { VisitActionsMenu } from '@/features/visits/components/VisitActionsMenu';

export function AssociationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const {
    data: association,
    loading: loadingAssociation,
    error: associationError,
    reload: reloadAssociation,
  } = useAsyncData(() => fetchAssociationById(id!), [id]);

  const {
    data: history,
    loading: loadingHistory,
    error: historyError,
    reload: reloadHistory,
  } = useAsyncData(() => fetchVisitHistory(id!), [id]);

  const { data: advisors } = useAsyncData(fetchAdvisors, []);

  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  if (!id) {
    return <ErrorState error={new Error('Falta el identificador de la asociación.')} />;
  }

  if (loadingAssociation) {
    return <LoadingState label="Cargando asociación…" />;
  }

  if (associationError) {
    return <ErrorState error={associationError} onRetry={reloadAssociation} />;
  }

  if (!association) {
    return (
      <EmptyState
        title="No se encontró la asociación"
        description="Puede que el enlace sea incorrecto."
        action={
          <Button variant="outlined" onClick={() => navigate('/asociaciones')}>
            Volver al listado
          </Button>
        }
      />
    );
  }

  const supervisable = isSupervisable(association.status);

  const handleReload = () => {
    reloadAssociation();
    reloadHistory();
  };

  return (
    <Box>
      <Button onClick={() => navigate('/asociaciones')} sx={{ mb: 1 }}>
        ← Volver al listado
      </Button>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" component="h1">
              {association.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Código de banca {association.bank_code} · {association.region?.name ?? 'Sin región'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Chip
              label={ASSOCIATION_STATUS_LABELS[association.status]}
              color={ASSOCIATION_STATUS_COLORS[association.status]}
            />
            <Chip
              variant="outlined"
              label={supervisable ? 'Supervisable' : 'No supervisable'}
              color={supervisable ? 'success' : 'default'}
            />
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Asesor actual
            </Typography>
            <Typography variant="body1">{association.advisor?.full_name ?? '—'}</Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => setEditOpen(true)}>
            Editar estado / asesor
          </Button>
          <Button
            variant="contained"
            disabled={!supervisable}
            onClick={() => setScheduleOpen(true)}
            title={
              supervisable
                ? undefined
                : 'No se puede programar: la asociación no está en un estado supervisable.'
            }
          >
            Programar visita
          </Button>
        </Box>
        {!supervisable ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Esta asociación está en estado {ASSOCIATION_STATUS_LABELS[association.status]} y no
            admite nuevas visitas (RN-01/RN-02).
          </Alert>
        ) : null}
      </Paper>

      <Typography variant="h6" gutterBottom>
        Historial de visitas
      </Typography>

      {historyError ? <ErrorState error={historyError} onRetry={reloadHistory} /> : null}
      {loadingHistory && !historyError ? <LoadingState label="Cargando historial…" /> : null}
      {!loadingHistory && !historyError && (history?.length ?? 0) === 0 ? (
        <EmptyState title="Todavía no hay visitas registradas para esta asociación." />
      ) : null}

      {!loadingHistory && !historyError && history && history.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Programada</TableCell>
                <TableCell>Realizada</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Modalidad</TableCell>
                <TableCell>Característica</TableCell>
                <TableCell>Supervisora</TableCell>
                <TableCell>Asesor (en ese momento)</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Puntuación</TableCell>
                <TableCell>Comentario</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell>{formatDateEsPE(visit.scheduled_date)}</TableCell>
                  <TableCell>{formatDateEsPE(visit.performed_date)}</TableCell>
                  <TableCell>{VISIT_TYPE_LABELS[visit.visit_type]}</TableCell>
                  <TableCell>{VISIT_MODALITY_LABELS[visit.modality]}</TableCell>
                  <TableCell>{VISIT_CHARACTERISTIC_LABELS[visit.characteristic]}</TableCell>
                  <TableCell>{visit.supervisor?.full_name ?? '—'}</TableCell>
                  <TableCell>{visit.scheduled_advisor?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={VISIT_STATUS_LABELS[visit.status]}
                      color={VISIT_STATUS_COLORS[visit.status]}
                    />
                  </TableCell>
                  <TableCell>{visit.score ?? '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 240, whiteSpace: 'normal' }}>
                    {visit.general_comment ?? '—'}
                  </TableCell>
                  <TableCell align="right">
                    <VisitActionsMenu visit={visit} onChanged={handleReload} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {editOpen ? (
        <EditAssociationDialog
          open
          currentStatus={association.status}
          currentAdvisorId={association.advisor_id}
          advisors={advisors ?? []}
          onClose={() => setEditOpen(false)}
          onSubmit={async (changes) => {
            await updateAssociation(association.id, changes);
            reloadAssociation();
            setSnackbar('Asociación actualizada.');
          }}
        />
      ) : null}

      {scheduleOpen && profile ? (
        <ScheduleVisitDialog
          open
          association={{
            id: association.id,
            name: association.name,
            status: association.status,
            advisorId: association.advisor_id,
          }}
          supervisorId={profile.id}
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => {
            setScheduleOpen(false);
            handleReload();
            setSnackbar('Visita programada.');
          }}
        />
      ) : null}

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar}
      />
    </Box>
  );
}
