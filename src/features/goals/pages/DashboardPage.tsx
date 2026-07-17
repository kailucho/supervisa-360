import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fetchIndividualProgress, fetchJointProgress } from '@/services/supabase/goals';
import {
  fetchOverdueActiveVisits,
  fetchRescheduledVisits,
  fetchUpcomingVisits,
} from '@/services/supabase/visits';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { getLimaNowYearMonth } from '@/shared/utils/date';
import { sumIndividualProgress, sumJointProgress } from '@/features/goals/progressMath';
import { ProgressCard } from '@/features/goals/components/ProgressCard';
import { VisitListSection } from '@/features/goals/components/VisitListSection';

export function DashboardPage() {
  const { profile } = useAuth();
  const [{ year, month }, setYearMonth] = useState(getLimaNowYearMonth());

  const {
    data: individualRows,
    loading: loadingProgress,
    error: progressError,
    reload: reloadProgress,
  } = useAsyncData(
    () => fetchIndividualProgress(year, month, { supervisorId: profile!.id }),
    [year, month, profile?.id],
  );

  const { data: jointRows, loading: loadingJoint } = useAsyncData(
    () => fetchJointProgress(year, month),
    [year, month],
  );

  const { data: upcoming, loading: loadingUpcoming } = useAsyncData(
    () => fetchUpcomingVisits(5),
    [],
  );
  const { data: overdue, loading: loadingOverdue } = useAsyncData(
    () => fetchOverdueActiveVisits(10),
    [],
  );
  const { data: rescheduled, loading: loadingRescheduled } = useAsyncData(
    () => fetchRescheduledVisits(10),
    [],
  );

  const individualSummary = useMemo(
    () => sumIndividualProgress(individualRows ?? []),
    [individualRows],
  );

  const jointSummary = useMemo(() => sumJointProgress(jointRows ?? []), [jointRows]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" component="h1">
            Hola, {profile?.full_name?.split(' ')[0] ?? 'supervisora'} 👋
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Este es tu avance de supervisión
          </Typography>
        </Box>
        <MonthNavigator year={year} month={month} onChange={setYearMonth} />
      </Box>

      {progressError ? <ErrorState error={progressError} onRetry={reloadProgress} /> : null}
      {(loadingProgress || loadingJoint) && !progressError ? (
        <LoadingState label="Cargando avance del mes…" />
      ) : (
        !progressError && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
            <ProgressCard
              title={`Tu avance (${profile?.full_name ?? 'supervisora'}, todas las sedes)`}
              summary={individualSummary}
            />
            <ProgressCard title="Avance conjunto (todas las sedes)" summary={jointSummary} />
          </Box>
        )
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <VisitListSection
          title="Próximas visitas"
          visits={loadingUpcoming ? [] : (upcoming ?? [])}
          emptyMessage="No hay visitas próximas programadas."
        />
        <VisitListSection
          title="Pendientes de cerrar (fecha vencida)"
          visits={loadingOverdue ? [] : (overdue ?? [])}
          emptyMessage="No hay visitas activas con fecha vencida."
        />
        <VisitListSection
          title="Reprogramadas"
          visits={loadingRescheduled ? [] : (rescheduled ?? [])}
          emptyMessage="No hay visitas reprogramadas."
        />
      </Box>
    </Box>
  );
}
