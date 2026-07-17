import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { fetchIndividualProgress, fetchJointProgress } from '@/services/supabase/goals';
import { fetchRegions } from '@/services/supabase/regions';
import {
  fetchAgendaVisits,
  fetchOverdueActiveVisits,
  fetchUpcomingVisits,
} from '@/services/supabase/visits';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { formatDateEsPE, formatTime } from '@/shared/utils/date';
import {
  VISIT_CHARACTERISTIC_LABELS,
  VISIT_MODALITY_LABELS,
  VISIT_STATUS_COLORS,
  VISIT_STATUS_LABELS,
  VISIT_TYPE_LABELS,
} from '@/shared/utils/labels';
import { progressPercent, summarizeProgress } from '@/features/goals/progressMath';
import { VisitListSection } from '@/features/goals/components/VisitListSection';
import { SupervisorBreakdownList } from '@/features/management/components/SupervisorBreakdownList';
import { useYearMonthParams } from '@/features/management/useYearMonthParams';

function GoalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ minWidth: 96 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}

/** Detalle de una sede para el Jefe de Supervisión. Completamente de lectura. */
export function RegionDetailPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [{ year, month }, setYearMonth] = useYearMonthParams();

  const { data: regions, loading: loadingRegions } = useAsyncData(fetchRegions, []);
  const region = (regions ?? []).find((r) => r.id === regionId) ?? null;

  const {
    data: jointRows,
    loading: loadingJoint,
    error: jointError,
    reload: reloadJoint,
  } = useAsyncData(
    () => fetchJointProgress(year, month, { regionId: regionId! }),
    [year, month, regionId],
  );

  const { data: individualRows, loading: loadingIndividual } = useAsyncData(
    () => fetchIndividualProgress(year, month, { regionId: regionId! }),
    [year, month, regionId],
  );

  const { data: upcoming, loading: loadingUpcoming } = useAsyncData(
    () => fetchUpcomingVisits(5, regionId),
    [regionId],
  );
  const { data: overdue, loading: loadingOverdue } = useAsyncData(
    () => fetchOverdueActiveVisits(10, regionId),
    [regionId],
  );

  const {
    data: monthVisits,
    loading: loadingMonthVisits,
    error: monthVisitsError,
    reload: reloadMonthVisits,
  } = useAsyncData(() => fetchAgendaVisits({ year, month, regionId }), [year, month, regionId]);

  const joint = useMemo(() => (jointRows ?? [])[0] ?? null, [jointRows]);
  const summary = summarizeProgress(
    joint?.effective_joint_target ?? 0,
    joint?.joint_done ?? 0,
    joint?.joint_active ?? 0,
  );
  const percent = progressPercent(summary);
  const isConfigured = joint?.is_configured === true;

  if (!regionId) {
    return <ErrorState error={new Error('Falta el identificador de la sede.')} />;
  }

  const loadingHeader = loadingRegions || loadingJoint || loadingIndividual;

  return (
    <Box>
      <Button onClick={() => navigate(`/jefatura?year=${year}&month=${month}`)} sx={{ mb: 1 }}>
        ← Volver al panel de jefatura
      </Button>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h1">
          {region?.name ?? 'Sede'}
        </Typography>
        <MonthNavigator year={year} month={month} onChange={setYearMonth} />
      </Box>

      {jointError ? <ErrorState error={jointError} onRetry={reloadJoint} /> : null}
      {loadingHeader && !jointError ? <LoadingState label="Cargando avance de la sede…" /> : null}

      {!loadingHeader && !jointError ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h4" component="p" color="primary.dark" sx={{ fontWeight: 700 }}>
                {percent}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary.done} de {summary.target} visitas realizadas
              </Typography>
            </Box>
            <Chip
              size="small"
              label={isConfigured ? 'Meta definida por jefatura' : 'Meta sugerida'}
              color={isConfigured ? 'primary' : 'default'}
              variant={isConfigured ? 'filled' : 'outlined'}
            />
          </Box>

          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 4 } }}>
            <GoalStat label="Meta efectiva" value={summary.target} />
            <GoalStat label="Meta sugerida (suma)" value={joint?.suggested_joint_target ?? 0} />
            <GoalStat label="Meta definida" value={joint?.configured_joint_target ?? '—'} />
            <GoalStat label="Realizadas" value={summary.done} />
            <GoalStat label="Activas" value={summary.active} />
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Avance por supervisora
          </Typography>
          <SupervisorBreakdownList rows={individualRows ?? []} />
        </Paper>
      ) : null}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <VisitListSection
          title="Próximas visitas"
          visits={loadingUpcoming ? [] : (upcoming ?? [])}
          emptyMessage="No hay visitas próximas en esta sede."
        />
        <VisitListSection
          title="Pendientes de cerrar (fecha vencida)"
          visits={loadingOverdue ? [] : (overdue ?? [])}
          emptyMessage="No hay visitas activas con fecha vencida."
        />
      </Box>

      <Typography variant="h6" gutterBottom>
        Visitas del mes
      </Typography>

      {monthVisitsError ? (
        <ErrorState error={monthVisitsError} onRetry={reloadMonthVisits} />
      ) : null}
      {loadingMonthVisits && !monthVisitsError ? (
        <LoadingState label="Cargando visitas del mes…" />
      ) : null}
      {!loadingMonthVisits && !monthVisitsError && (monthVisits?.length ?? 0) === 0 ? (
        <EmptyState title="No hay visitas registradas en esta sede este mes." />
      ) : null}

      {!loadingMonthVisits && !monthVisitsError && monthVisits && monthVisits.length > 0 ? (
        isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {monthVisits.map((visit) => (
              <Card key={visit.id} variant="outlined">
                <CardContent>
                  <Box
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/asociaciones/${visit.association_id}`)}
                  >
                    <Typography variant="subtitle1">{visit.association?.name ?? '—'}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateEsPE(visit.scheduled_date)} {formatTime(visit.scheduled_time)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {VISIT_TYPE_LABELS[visit.visit_type]} ·{' '}
                      {VISIT_MODALITY_LABELS[visit.modality]} ·{' '}
                      {VISIT_CHARACTERISTIC_LABELS[visit.characteristic]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Supervisora: {visit.supervisor?.full_name ?? '—'}
                    </Typography>
                    <Chip
                      size="small"
                      sx={{ mt: 1 }}
                      label={VISIT_STATUS_LABELS[visit.status]}
                      color={VISIT_STATUS_COLORS[visit.status]}
                    />
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Hora</TableCell>
                  <TableCell>Asociación</TableCell>
                  <TableCell>Supervisora</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Modalidad</TableCell>
                  <TableCell>Característica</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthVisits.map((visit) => (
                  <TableRow key={visit.id} hover>
                    <TableCell>{formatDateEsPE(visit.scheduled_date)}</TableCell>
                    <TableCell>{formatTime(visit.scheduled_time)}</TableCell>
                    <TableCell
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/asociaciones/${visit.association_id}`)}
                    >
                      {visit.association?.name ?? '—'}
                    </TableCell>
                    <TableCell>{visit.supervisor?.full_name ?? '—'}</TableCell>
                    <TableCell>{VISIT_TYPE_LABELS[visit.visit_type]}</TableCell>
                    <TableCell>{VISIT_MODALITY_LABELS[visit.modality]}</TableCell>
                    <TableCell>{VISIT_CHARACTERISTIC_LABELS[visit.characteristic]}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={VISIT_STATUS_LABELS[visit.status]}
                        color={VISIT_STATUS_COLORS[visit.status]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : null}
    </Box>
  );
}
