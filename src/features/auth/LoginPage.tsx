import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from './useAuth';
import { loginSchema } from '@/shared/utils/schemas';
import type { LoginFormValues } from '@/shared/utils/schemas';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'signed-in') {
    const state = location.state as { from?: { pathname?: string } } | null;
    const redirectTo = state?.from?.pathname ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const error = await signIn(values.email, values.password);
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
    }
  });

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void onSubmit(event);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper elevation={2} sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Supervisa 360
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Inicia sesión con tu cuenta de supervisora.
        </Typography>

        <Box component="form" onSubmit={handleFormSubmit} noValidate>
          <TextField
            {...register('email')}
            label="Correo electrónico"
            type="email"
            fullWidth
            margin="normal"
            autoComplete="username"
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            disabled={submitting}
          />
          <TextField
            {...register('password')}
            label="Contraseña"
            type="password"
            fullWidth
            margin="normal"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            disabled={submitting}
          />

          {submitError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {submitError}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3 }}
            disabled={submitting}
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
