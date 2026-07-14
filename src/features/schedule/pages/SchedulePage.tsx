import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { fetchAgendaVisits } from '@/services/supabase/visits';
import { fetchActiveProfiles } from '@/services/supabase/profiles';
import { fetchRegions } from '@/services/supabase/regions';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { getLimaNowYearMonth, formatDateEsPE, formatTime } from '@/shared/utils/date';
import type { VisitStatus } from '@/shared/types/domain';
import {
  VISIT_CHARACTERISTIC_LABELS,
  VISIT_MODALITY_LABELS,
  VISIT_STATUS_COLORS,
  VISIT_STATUS_LABELS,
  VISIT_TYPE_LABELS,
} from '@/shared/utils/labels';
import { VisitActionsMenu } from '@/features/visits/components/VisitActionsMenu';
import { ScheduleNewVisitButton } from '@/features/schedule/components/ScheduleNewVisitButton';

export function SchedulePage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [{ year, month }, setYearMonth] = useState(getLimaNowYearMonth());
  const [supervisorId, setSupervisorId] = useState('');
  const [status, setStatus] = useState<VisitStatus | ''>('');
  const [regionId, setRegionId] = useState('');

  const { data: supervisors } = useAsyncData(fetchActiveProfiles, []);
  const { data: regions } = useAsyncData(fetchRegions, []);

  const filters = useMemo(
    () => ({
      year,
      month,
      supervisorId: supervisorId || undefined,
      status: status || undefined,
      regionId: regionId || undefined,
    }),
    [year, month, supervisorId, status, regionId],
  );

  const {
    data: visits,
    loading,
    error,
    reload,
  } = useAsyncData(
    () => fetchAgendaVisits(filters),
    [filters.year, filters.month, filters.supervisorId, filters.status, filters.regionId],
  );

  return (
    <Box>
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
          Agenda compartida
        </Typography>
        <ScheduleNewVisitButton onScheduled={reload} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <MonthNavigator year={year} month={month} onChange={setYearMonth} />
        <TextField
          select
          label="Supervisora"
          value={supervisorId}
          onChange={(event) => setSupervisorId(event.target.value)}
          size="small"
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Ambas</MenuItem>
          {(supervisors ?? []).map((supervisor) => (
            <MenuItem key={supervisor.id} value={supervisor.id}>
              {supervisor.full_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as VisitStatus | '')}
          size="small"
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {Object.entries(VISIT_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Región"
          value={regionId}
          onChange={(event) => setRegionId(event.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(regions ?? []).map((region) => (
            <MenuItem key={region.id} value={region.id}>
              {region.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !error ? <LoadingState label="Cargando agenda…" /> : null}
      {!loading && !error && (visits?.length ?? 0) === 0 ? (
        <EmptyState title="No hay visitas para estos filtros en este mes." />
      ) : null}

      {!loading && !error && visits && visits.length > 0 ? (
        isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {visits.map((visit) => (
              <Card key={visit.id} variant="outlined">
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/asociaciones/${visit.association_id}`)}
                    >
                      <Typography variant="subtitle1">{visit.association?.name ?? '—'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateEsPE(visit.scheduled_date)} {formatTime(visit.scheduled_time)} ·{' '}
                        {visit.association?.region?.name ?? '—'}
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
                      <Chip
                        size="small"
                        sx={{ mt: 1 }}
                        label={VISIT_STATUS_LABELS[visit.status]}
                        color={VISIT_STATUS_COLORS[visit.status]}
                      />
                    </Box>
                    <VisitActionsMenu visit={visit} onChanged={reload} />
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
                  <TableCell>Región</TableCell>
                  <TableCell>Asesor</TableCell>
                  <TableCell>Supervisora</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Modalidad</TableCell>
                  <TableCell>Característica</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visits.map((visit) => (
                  <TableRow key={visit.id} hover>
                    <TableCell>{formatDateEsPE(visit.scheduled_date)}</TableCell>
                    <TableCell>{formatTime(visit.scheduled_time)}</TableCell>
                    <TableCell
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/asociaciones/${visit.association_id}`)}
                    >
                      {visit.association?.name ?? '—'}
                    </TableCell>
                    <TableCell>{visit.association?.region?.name ?? '—'}</TableCell>
                    <TableCell>{visit.scheduled_advisor?.full_name ?? '—'}</TableCell>
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
                    <TableCell align="right">
                      <VisitActionsMenu visit={visit} onChanged={reload} />
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
