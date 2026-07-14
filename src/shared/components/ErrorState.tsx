import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import { translateError } from '@/services/supabase/errors';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { message } = translateError(error);

  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Reintentar
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>No se pudo cargar la información</AlertTitle>
      {message}
    </Alert>
  );
}
