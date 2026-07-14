import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: '100vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Typography variant="h4">404</Typography>
      <Typography variant="body1" color="text.secondary">
        No encontramos la página que buscas.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Ir al panel inicial
      </Button>
    </Box>
  );
}
