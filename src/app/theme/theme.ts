import { createTheme } from '@mui/material/styles';
import { esES } from '@mui/material/locale';

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: '#1f5c4d' },
      secondary: { main: '#b5651d' },
      background: { default: '#f4f6f5' },
    },
    typography: {
      fontFamily: ['system-ui', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'].join(','),
    },
    shape: { borderRadius: 10 },
  },
  esES,
);
