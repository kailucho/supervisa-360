import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  createGoal,
  fetchGoalsForMonth,
  fetchMyGoalsForMonth,
  updateGoal,
} from '@/services/supabase/goals';
import { fetchRegions } from '@/services/supabase/regions';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { getLimaNowYearMonth } from '@/shared/utils/date';
import { personalGoalSchema } from '@/shared/utils/schemas';
import type { PersonalGoalFormInput, PersonalGoalFormValues } from '@/shared/utils/schemas';
import { translateError } from '@/services/supabase/errors';
import type { MonthlyGoalRow, RegionRow } from '@/shared/types/domain';
import type { GoalWithProfile } from '@/services/supabase/goals';

function PersonalGoalCard({
  region,
  year,
  month,
  myGoal,
  onSaved,
}: {
  region: RegionRow;
  year: number;
  month: number;
  myGoal: MonthlyGoalRow | null;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<
    PersonalGoalFormInput,
    unknown,
    PersonalGoalFormValues
  >({
    resolver: zodResolver(personalGoalSchema),
    defaultValues: {
      regionId: region.id,
      year,
      month,
      targetVisits: myGoal?.target_visits ?? 0,
    },
  });

  useEffect(() => {
    reset({ regionId: region.id, year, month, targetVisits: myGoal?.target_visits ?? 0 });
  }, [region.id, year, month, myGoal, reset]);

  const submitHandler = handleSubmit(async (values) => {
    if (!profile || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (myGoal) {
        await updateGoal(myGoal.id, values.targetVisits);
      } else {
        await createGoal(
          profile.id,
          values.regionId,
          values.year,
          values.month,
          values.targetVisits,
        );
      }
      onSaved();
    } catch (error) {
      setSubmitError(translateError(error).message);
    } finally {
      setSubmitting(false);
    }
  });

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void submitHandler(event);
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, flex: 1, minWidth: 260 }}>
      <Typography variant="subtitle1" gutterBottom>
        {region.name}
      </Typography>
      <Box component="form" onSubmit={handleFormSubmit} noValidate>
        <input type="hidden" {...register('regionId')} />
        <input type="hidden" {...register('year', { valueAsNumber: true })} />
        <input type="hidden" {...register('month', { valueAsNumber: true })} />
        <TextField
          {...register('targetVisits')}
          label={`Meta de visitas en ${region.name}`}
          type="number"
          fullWidth
          margin="normal"
          error={Boolean(formState.errors.targetVisits)}
          helperText={formState.errors.targetVisits?.message}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
        />
        {submitError ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {submitError}
          </Alert>
        ) : null}
        <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={submitting}>
          {submitting ? 'Guardando…' : myGoal ? 'Actualizar meta' : 'Crear meta'}
        </Button>
      </Box>
    </Paper>
  );
}

export function SupervisorGoalsPage() {
  const { profile } = useAuth();
  const [{ year, month }, setYearMonth] = useState(getLimaNowYearMonth());
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { data: regions, loading: loadingRegions } = useAsyncData(fetchRegions, []);

  const {
    data: myGoals,
    loading: loadingMyGoals,
    error: myGoalsError,
    reload: reloadMyGoals,
  } = useAsyncData(
    () => fetchMyGoalsForMonth(profile!.id, year, month),
    [profile?.id, year, month],
  );

  const {
    data: allGoals,
    loading: loadingAllGoals,
    reload: reloadAllGoals,
  } = useAsyncData(() => fetchGoalsForMonth(year, month), [year, month]);

  const goalsByRegion = useMemo(() => {
    const map = new Map<string, MonthlyGoalRow>();
    for (const goal of myGoals ?? []) {
      map.set(goal.region_id, goal);
    }
    return map;
  }, [myGoals]);

  const allGoalsByRegion = useMemo(() => {
    const map = new Map<string, GoalWithProfile[]>();
    for (const goal of allGoals ?? []) {
      const list = map.get(goal.region_id) ?? [];
      list.push(goal);
      map.set(goal.region_id, list);
    }
    return map;
  }, [allGoals]);

  const handleSaved = () => {
    reloadMyGoals();
    reloadAllGoals();
    setSnackbar('Meta guardada.');
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
        <Typography variant="h5" component="h1">
          Metas mensuales
        </Typography>
        <MonthNavigator year={year} month={month} onChange={setYearMonth} />
      </Box>

      <Typography variant="subtitle1" gutterBottom>
        Tus metas por sede ({profile?.full_name})
      </Typography>

      {myGoalsError ? <ErrorState error={myGoalsError} onRetry={reloadMyGoals} /> : null}
      {(loadingRegions || loadingMyGoals) && !myGoalsError ? (
        <LoadingState label="Cargando tus metas…" />
      ) : null}

      {!loadingRegions && !loadingMyGoals && !myGoalsError ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
          {(regions ?? []).map((region) => (
            <PersonalGoalCard
              key={region.id}
              region={region}
              year={year}
              month={month}
              myGoal={goalsByRegion.get(region.id) ?? null}
              onSaved={handleSaved}
            />
          ))}
        </Box>
      ) : null}

      <Typography variant="subtitle1" gutterBottom>
        Metas de todas las supervisoras (solo lectura)
      </Typography>
      {loadingAllGoals ? (
        <LoadingState label="Cargando metas…" />
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {(regions ?? []).map((region) => {
            const regionGoals = allGoalsByRegion.get(region.id) ?? [];
            const total = regionGoals.reduce((sum, g) => sum + g.target_visits, 0);
            return (
              <Paper key={region.id} variant="outlined" sx={{ p: 1, flex: 1, minWidth: 260 }}>
                <Typography variant="subtitle2" sx={{ px: 2, pt: 1 }}>
                  {region.name}
                </Typography>
                <List dense>
                  {regionGoals.length === 0 ? (
                    <ListItem>
                      <ListItemText secondary="Sin metas registradas este mes." />
                    </ListItem>
                  ) : (
                    regionGoals.map((goal) => (
                      <ListItem key={goal.id}>
                        <ListItemText
                          primary={goal.profile?.full_name ?? 'Supervisora'}
                          secondary={`${goal.target_visits} visitas`}
                        />
                      </ListItem>
                    ))
                  )}
                  <ListItem>
                    <ListItemText primary="Meta sugerida (suma)" secondary={`${total} visitas`} />
                  </ListItem>
                </List>
              </Paper>
            );
          })}
        </Box>
      )}

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
