import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fetchIndividualProgress, fetchJointProgress } from '@/services/supabase/goals';
import { fetchRegions } from '@/services/supabase/regions';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { RegionSummaryCard } from '@/features/management/components/RegionSummaryCard';
import { useYearMonthParams } from '@/features/management/useYearMonthParams';

export function ManagerDashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [{ year, month }, setYearMonth] = useYearMonthParams();

  const { data: regions, loading: loadingRegions } = useAsyncData(fetchRegions, []);

  const {
    data: jointRows,
    loading: loadingJoint,
    error: jointError,
    reload: reloadJoint,
  } = useAsyncData(() => fetchJointProgress(year, month), [year, month]);

  const {
    data: individualRows,
    loading: loadingIndividual,
    error: individualError,
    reload: reloadIndividual,
  } = useAsyncData(() => fetchIndividualProgress(year, month), [year, month]);

  const individualByRegion = useMemo(() => {
    const map = new Map<string, NonNullable<typeof individualRows>>();
    for (const row of individualRows ?? []) {
      if (!row.region_id) continue;
      const list = map.get(row.region_id) ?? [];
      list.push(row);
      map.set(row.region_id, list);
    }
    return map;
  }, [individualRows]);

  const loading = loadingRegions || loadingJoint || loadingIndividual;
  const error = jointError ?? individualError;
  const reload = () => {
    reloadJoint();
    reloadIndividual();
  };

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
            Hola, {profile?.full_name?.split(' ')[0] ?? 'jefe'} 👋
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Avance de supervisión por sede
          </Typography>
        </Box>
        <MonthNavigator year={year} month={month} onChange={setYearMonth} />
      </Box>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !error ? <LoadingState label="Cargando avance por sede…" /> : null}
      {!loading && !error && (regions?.length ?? 0) === 0 ? (
        <EmptyState title="No hay sedes activas registradas." />
      ) : null}

      {!loading && !error && regions && regions.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2,
          }}
        >
          {regions.map((region) => (
            <RegionSummaryCard
              key={region.id}
              regionName={region.name}
              joint={(jointRows ?? []).find((row) => row.region_id === region.id) ?? null}
              individualRows={individualByRegion.get(region.id) ?? []}
              onViewDetail={() =>
                navigate(`/jefatura/sedes/${region.id}?year=${year}&month=${month}`)
              }
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
