import { useEffect, useState } from 'react';
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
import { createGoal, fetchGoalsForMonth, fetchMyGoal, updateGoal } from '@/services/supabase/goals';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { getLimaNowYearMonth } from '@/shared/utils/date';
import { monthlyGoalSchema } from '@/shared/utils/schemas';
import type { MonthlyGoalFormInput, MonthlyGoalFormValues } from '@/shared/utils/schemas';
import { translateError } from '@/services/supabase/errors';

const SUGGESTED_DEFAULT_TARGET = 15;

export function GoalsPage() {
  const { profile } = useAuth();
  const [{ year, month }, setYearMonth] = useState(getLimaNowYearMonth());
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    data: myGoal,
    loading: loadingMyGoal,
    error: myGoalError,
    reload: reloadMyGoal,
  } = useAsyncData(() => fetchMyGoal(profile!.id, year, month), [profile?.id, year, month]);

  const {
    data: allGoals,
    loading: loadingAllGoals,
    reload: reloadAllGoals,
  } = useAsyncData(() => fetchGoalsForMonth(year, month), [year, month]);

  const { register, handleSubmit, reset } = useForm<
    MonthlyGoalFormInput,
    unknown,
    MonthlyGoalFormValues
  >({
    resolver: zodResolver(monthlyGoalSchema),
    defaultValues: { targetVisits: SUGGESTED_DEFAULT_TARGET },
  });

  useEffect(() => {
    reset({ targetVisits: myGoal ? myGoal.target_visits : SUGGESTED_DEFAULT_TARGET });
  }, [myGoal, reset]);

  const submitHandler = handleSubmit(async (values) => {
    if (!profile || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (myGoal) {
        await updateGoal(myGoal.id, values.targetVisits);
      } else {
        await createGoal(profile.id, year, month, values.targetVisits);
      }
      reloadMyGoal();
      reloadAllGoals();
      setSnackbar('Meta guardada.');
    } catch (error) {
      setSubmitError(translateError(error).message);
    } finally {
      setSubmitting(false);
    }
  });

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void submitHandler(event);
  };

  const jointTotal = (allGoals ?? []).reduce((sum, g) => sum + g.target_visits, 0);

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

      <Paper variant="outlined" sx={{ p: 3, mb: 3, maxWidth: 420 }}>
        <Typography variant="subtitle1" gutterBottom>
          Tu meta ({profile?.full_name})
        </Typography>

        {myGoalError ? <ErrorState error={myGoalError} onRetry={reloadMyGoal} /> : null}
        {loadingMyGoal && !myGoalError ? (
          <LoadingState label="Cargando tu meta…" />
        ) : (
          <Box component="form" onSubmit={handleFormSubmit} noValidate>
            {!myGoal ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Todavía no hay una meta para este mes. Valor de referencia:{' '}
                {SUGGESTED_DEFAULT_TARGET}
                visitas; ajústalo si corresponde.
              </Typography>
            ) : null}
            <TextField
              {...register('targetVisits')}
              label="Meta de visitas del mes"
              type="number"
              fullWidth
              margin="normal"
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
        )}
      </Paper>

      <Typography variant="subtitle1" gutterBottom>
        Metas de ambas supervisoras (solo lectura)
      </Typography>
      {loadingAllGoals ? (
        <LoadingState label="Cargando metas…" />
      ) : (
        <Paper variant="outlined" sx={{ p: 1, maxWidth: 420 }}>
          <List dense>
            {(allGoals ?? []).map((goal) => (
              <ListItem key={goal.id}>
                <ListItemText
                  primary={goal.profile?.full_name ?? 'Supervisora'}
                  secondary={`${goal.target_visits} visitas`}
                />
              </ListItem>
            ))}
            <ListItem>
              <ListItemText primary="Meta conjunta (suma)" secondary={`${jointTotal} visitas`} />
            </ListItem>
          </List>
        </Paper>
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
