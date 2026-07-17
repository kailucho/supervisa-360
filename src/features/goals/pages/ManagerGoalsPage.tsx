import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { fetchGoalsForMonth } from '@/services/supabase/goals';
import {
  createRegionalGoal,
  fetchRegionalGoalsForMonth,
  updateRegionalGoal,
} from '@/services/supabase/regionalGoals';
import { fetchRegions } from '@/services/supabase/regions';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { getLimaNowYearMonth } from '@/shared/utils/date';
import { regionalGoalSchema } from '@/shared/utils/schemas';
import type { RegionalGoalFormInput, RegionalGoalFormValues } from '@/shared/utils/schemas';
import { translateError } from '@/services/supabase/errors';
import type { RegionalMonthlyGoalRow, RegionRow } from '@/shared/types/domain';
import type { GoalWithProfile } from '@/services/supabase/goals';

function RegionalGoalCard({
  region,
  year,
  month,
  personalGoals,
  regionalGoal,
  onSaved,
}: {
  region: RegionRow;
  year: number;
  month: number;
  personalGoals: GoalWithProfile[];
  regionalGoal: RegionalMonthlyGoalRow | null;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const suggested = personalGoals.reduce((sum, g) => sum + g.target_visits, 0);
  const isConfigured = regionalGoal !== null;

  const { register, handleSubmit, reset, formState } = useForm<
    RegionalGoalFormInput,
    unknown,
    RegionalGoalFormValues
  >({
    resolver: zodResolver(regionalGoalSchema),
    defaultValues: {
      regionId: region.id,
      year,
      month,
      targetVisits: regionalGoal?.target_visits ?? suggested,
    },
  });

  useEffect(() => {
    reset({
      regionId: region.id,
      year,
      month,
      targetVisits: regionalGoal?.target_visits ?? suggested,
    });
  }, [region.id, year, month, regionalGoal, suggested, reset]);

  const submitHandler = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // RN-30: la fila solo se crea cuando el jefe confirma el valor.
      if (regionalGoal) {
        await updateRegionalGoal(regionalGoal.id, values.targetVisits);
      } else {
        await createRegionalGoal(values.regionId, values.year, values.month, values.targetVisits);
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
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, flex: 1, minWidth: 280 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1">{region.name}</Typography>
        <Chip
          size="small"
          label={isConfigured ? 'Meta definida' : 'Meta sugerida'}
          color={isConfigured ? 'primary' : 'default'}
          variant={isConfigured ? 'filled' : 'outlined'}
        />
      </Box>

      <List dense>
        {personalGoals.length === 0 ? (
          <ListItem disableGutters>
            <ListItemText secondary="Sin metas personales registradas este mes." />
          </ListItem>
        ) : (
          personalGoals.map((goal) => (
            <ListItem key={goal.id} disableGutters>
              <ListItemText
                primary={goal.profile?.full_name ?? 'Supervisora'}
                secondary={`${goal.target_visits} visitas`}
              />
            </ListItem>
          ))
        )}
      </List>

      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Meta sugerida (suma): <strong>{suggested}</strong>
      </Typography>

      <Box component="form" onSubmit={handleFormSubmit} noValidate>
        <input type="hidden" {...register('regionId')} />
        <input type="hidden" {...register('year', { valueAsNumber: true })} />
        <input type="hidden" {...register('month', { valueAsNumber: true })} />
        <TextField
          {...register('targetVisits')}
          label="Meta conjunta"
          type="number"
          fullWidth
          margin="dense"
          error={Boolean(formState.errors.targetVisits)}
          helperText={formState.errors.targetVisits?.message}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
        />
        {submitError ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {submitError}
          </Alert>
        ) : null}
        <Button type="submit" variant="contained" sx={{ mt: 1.5 }} disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar meta conjunta'}
        </Button>
      </Box>
    </Paper>
  );
}

/** Metas para el Jefe de Supervisión: consulta personales y define conjuntas. */
export function ManagerGoalsPage() {
  const [{ year, month }, setYearMonth] = useState(getLimaNowYearMonth());
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { data: regions, loading: loadingRegions } = useAsyncData(fetchRegions, []);

  const {
    data: personalGoals,
    loading: loadingPersonal,
    error: personalError,
    reload: reloadPersonal,
  } = useAsyncData(() => fetchGoalsForMonth(year, month), [year, month]);

  const {
    data: regionalGoals,
    loading: loadingRegional,
    error: regionalError,
    reload: reloadRegional,
  } = useAsyncData(() => fetchRegionalGoalsForMonth(year, month), [year, month]);

  const personalByRegion = useMemo(() => {
    const map = new Map<string, GoalWithProfile[]>();
    for (const goal of personalGoals ?? []) {
      const list = map.get(goal.region_id) ?? [];
      list.push(goal);
      map.set(goal.region_id, list);
    }
    return map;
  }, [personalGoals]);

  const regionalByRegion = useMemo(() => {
    const map = new Map<string, RegionalMonthlyGoalRow>();
    for (const goal of regionalGoals ?? []) {
      map.set(goal.region_id, goal);
    }
    return map;
  }, [regionalGoals]);

  const loading = loadingRegions || loadingPersonal || loadingRegional;
  const error = personalError ?? regionalError;
  const reload = () => {
    reloadPersonal();
    reloadRegional();
  };

  const handleSaved = () => {
    reload();
    setSnackbar('Meta conjunta guardada.');
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
          Metas por sede
        </Typography>
        <MonthNavigator year={year} month={month} onChange={setYearMonth} />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Las metas personales de cada supervisora son de solo lectura. Aquí defines la meta conjunta
        mensual de cada sede; si no la configuras, se usa la suma sugerida.
      </Typography>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !error ? <LoadingState label="Cargando metas por sede…" /> : null}

      {!loading && !error ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {(regions ?? []).map((region) => (
            <RegionalGoalCard
              key={region.id}
              region={region}
              year={year}
              month={month}
              personalGoals={personalByRegion.get(region.id) ?? []}
              regionalGoal={regionalByRegion.get(region.id) ?? null}
              onSaved={handleSaved}
            />
          ))}
        </Box>
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
