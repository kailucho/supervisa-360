import { Suspense, lazy, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { fetchAssociationById, updateAssociation } from '@/services/supabase/associations';
import { fetchVisitHistory } from '@/services/supabase/visits';
import { fetchAdvisors } from '@/services/supabase/advisors';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { isSupervisable } from '@/shared/types/domain';
import { canManageAssociations, canManageVisits } from '@/shared/utils/permissions';
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
import { VisitEvidenceSection } from '@/features/visits/components/VisitEvidenceSection';

// Recharts solo se usa en este gráfico: se carga de forma diferida para que no
// entre en el bundle inicial (login, dashboard, listado no lo necesitan).
const AssociationEvolutionChart = lazy(() =>
  import('@/features/associations/components/AssociationEvolutionChart').then((module) => ({
    default: module.AssociationEvolutionChart,
  })),
);

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
  const canEdit = canManageAssociations(profile);
  const canOperateVisits = canManageVisits(profile);

  const handleReload = () => {
    reloadAssociation();
    reloadHistory();
  };

  return (
    <Box>
      <Button onClick={() => navigate('/asociaciones')} sx={{ mb: 1 }}>
        ← Volver al listado
      </Button>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
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

        {canEdit || canOperateVisits ? (
          <Box
            sx={{
              mt: 3,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            {canEdit ? (
              <Button
                variant="outlined"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
                onClick={() => setEditOpen(true)}
              >
                Editar estado / asesor
              </Button>
            ) : null}
            {canOperateVisits ? (
              <Button
                variant="contained"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
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
            ) : null}
          </Box>
        ) : null}
        {!supervisable ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Esta asociación está en estado {ASSOCIATION_STATUS_LABELS[association.status]} y no
            admite nuevas visitas (RN-01/RN-02).
          </Alert>
        ) : null}
      </Paper>

      <Suspense
        fallback={
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
            <Skeleton variant="text" width={220} height={32} />
            <Skeleton variant="rectangular" height={220} sx={{ mt: 1, borderRadius: 1 }} />
          </Paper>
        }
      >
        <AssociationEvolutionChart history={history ?? []} />
      </Suspense>

      <Typography variant="h6" gutterBottom>
        Historial de visitas
      </Typography>

      {historyError ? <ErrorState error={historyError} onRetry={reloadHistory} /> : null}
      {loadingHistory && !historyError ? <LoadingState label="Cargando historial…" /> : null}
      {!loadingHistory && !historyError && (history?.length ?? 0) === 0 ? (
        <EmptyState title="Todavía no hay visitas registradas para esta asociación." />
      ) : null}

      {!loadingHistory && !historyError && history && history.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {history.map((visit) => (
            <Card key={visit.id} variant="outlined" id={`visita-${visit.id}`}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1">
                      {formatDateEsPE(visit.scheduled_date)}
                      {visit.performed_date
                        ? ` → realizada ${formatDateEsPE(visit.performed_date)}`
                        : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {VISIT_TYPE_LABELS[visit.visit_type]} ·{' '}
                      {VISIT_MODALITY_LABELS[visit.modality]} ·{' '}
                      {VISIT_CHARACTERISTIC_LABELS[visit.characteristic]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Supervisora: {visit.supervisor?.full_name ?? '—'} · Asesor:{' '}
                      {visit.scheduled_advisor?.full_name ?? '—'}
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        size="small"
                        label={VISIT_STATUS_LABELS[visit.status]}
                        color={VISIT_STATUS_COLORS[visit.status]}
                      />
                      {visit.score != null ? (
                        <Typography variant="body2">Puntuación: {visit.score}</Typography>
                      ) : null}
                    </Box>
                    {visit.general_comment ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {visit.general_comment}
                      </Typography>
                    ) : null}
                  </Box>
                  {canOperateVisits ? (
                    <VisitActionsMenu visit={visit} onChanged={handleReload} />
                  ) : null}
                </Box>
              </CardContent>
              {visit.status === 'REALIZADA' ? (
                <Accordion
                  disableGutters
                  elevation={0}
                  slotProps={{ transition: { unmountOnExit: true } }}
                  sx={{ '&::before': { display: 'none' }, borderTop: 1, borderColor: 'divider' }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                    <Typography variant="body2">
                      Evidencias (fotografías y documento de retroalimentación)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <VisitEvidenceSection visit={visit} />
                  </AccordionDetails>
                </Accordion>
              ) : null}
            </Card>
          ))}
        </Box>
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
