import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export function FullPageSpinner() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress aria-label="Cargando" />
    </Box>
  );
}
