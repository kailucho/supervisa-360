import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { useAuth } from './useAuth';
import { loginSchema } from '@/shared/utils/schemas';
import type { LoginFormValues } from '@/shared/utils/schemas';

export function LoginPage() {
  const theme = useTheme();
  const { status, signIn } = useAuth();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${alpha(
          theme.palette.primary.main,
          0.1,
        )} 100%)`,
      }}
    >
      <Box
        aria-hidden
        component="svg"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: { xs: 120, sm: 180 },
          color: 'primary.main',
          opacity: 0.16,
        }}
      >
        <path
          fill="currentColor"
          d="M0,96 C240,180 480,40 720,80 C960,120 1200,200 1440,120 L1440,220 L0,220 Z"
        />
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 400,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 12px 40px rgba(20, 60, 40, 0.08)',
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              mb: 2,
            }}
          >
            <Diversity3RoundedIcon color="primary" sx={{ fontSize: 40 }} />
          </Box>
          <Typography
            variant="h5"
            component="h1"
            color="primary.dark"
            sx={{ letterSpacing: '0.08em' }}
          >
            SUPERVISA 360
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 0.5 }}>
            Seguimiento de visitas de supervisión
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleFormSubmit} noValidate>
          <TextField
            {...register('email')}
            label="Correo electrónico"
            type="email"
            placeholder="tu@correo.com"
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
            type={showPassword ? 'text' : 'password'}
            fullWidth
            margin="normal"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            disabled={submitting}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
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

      <Typography variant="caption" color="text.secondary" sx={{ mt: 4, position: 'relative' }}>
        Supervisa 360 © {new Date().getFullYear()}
      </Typography>
    </Box>
  );
}
