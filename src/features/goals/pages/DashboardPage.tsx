import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fetchMonthlyProgress } from '@/services/supabase/goals';
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
import { summarizeIndividualProgress, summarizeJointProgress } from '@/features/goals/progressMath';
import { ProgressCard } from '@/features/goals/components/ProgressCard';
import { VisitListSection } from '@/features/goals/components/VisitListSection';

export function DashboardPage() {
  const { profile } = useAuth();
  const [{ year, month }, setYearMonth] = useState(getLimaNowYearMonth());

  const {
    data: progressRows,
    loading: loadingProgress,
    error: progressError,
    reload: reloadProgress,
  } = useAsyncData(() => fetchMonthlyProgress(year, month), [year, month]);

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

  const individualSummary = useMemo(() => {
    const row = progressRows?.find((r) => r.supervisor_id === profile?.id) ?? null;
    return summarizeIndividualProgress(row);
  }, [progressRows, profile]);

  const jointSummary = useMemo(() => summarizeJointProgress(progressRows ?? []), [progressRows]);

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
        <Typography variant="h5" component="h1">
          Panel inicial
        </Typography>
        <MonthNavigator year={year} month={month} onChange={setYearMonth} />
      </Box>

      {progressError ? <ErrorState error={progressError} onRetry={reloadProgress} /> : null}
      {loadingProgress && !progressError ? (
        <LoadingState label="Cargando avance del mes…" />
      ) : (
        !progressError && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
            <ProgressCard
              title={`Tu avance (${profile?.full_name ?? 'supervisora'})`}
              summary={individualSummary}
            />
            <ProgressCard title="Avance conjunto (ambas supervisoras)" summary={jointSummary} />
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
