import { alpha, createTheme } from '@mui/material/styles';
import { esES } from '@mui/material/locale';

// Paleta inspirada en el diseño de referencia: verde ADRA como color principal,
// fondos suaves, tarjetas redondeadas y chips tipo píldora con tinte pastel.
const green = {
  main: '#1b9c5a',
  dark: '#0e7a40',
  light: '#4dba83',
  contrastText: '#ffffff',
};

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: green,
      secondary: { main: '#0e5c38', contrastText: '#ffffff' },
      success: { main: '#1b9c5a', dark: '#0e7a40', light: '#4dba83' },
      warning: { main: '#ed9b18', dark: '#a15c00', light: '#f7c266' },
      error: { main: '#d64545', dark: '#a32626', light: '#e58a8a' },
      info: { main: '#2f80ed', dark: '#1b5cb8', light: '#7fb0f5' },
      background: { default: '#f4f7f5', paper: '#ffffff' },
      text: { primary: '#1c2b24', secondary: '#5f6f66' },
      divider: '#e3e9e5',
    },
    typography: {
      fontFamily: ['Inter', 'system-ui', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'].join(','),
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: {
          rounded: { borderRadius: 16 },
          outlined: { borderColor: '#e6ece8' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12 },
          sizeLarge: { paddingTop: 12, paddingBottom: 12 },
        },
      },
      MuiFab: {
        defaultProps: { color: 'primary' },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState, theme: t }) => ({
            fontWeight: 600,
            ...(ownerState.variant === 'filled' &&
              ownerState.color &&
              ownerState.color !== 'default' && {
                backgroundColor: alpha(t.palette[ownerState.color].main, 0.14),
                color: t.palette[ownerState.color].dark,
              }),
            ...(ownerState.variant === 'filled' &&
              (!ownerState.color || ownerState.color === 'default') && {
                backgroundColor: '#eef2ef',
                color: '#42504a',
              }),
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 12, backgroundColor: '#ffffff' },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            height: 8,
            borderRadius: 999,
            backgroundColor: alpha(t.palette.primary.main, 0.14),
          }),
          bar: { borderRadius: 999 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 10,
            '&.Mui-selected': {
              backgroundColor: alpha(t.palette.primary.main, 0.12),
              color: t.palette.primary.dark,
              '&:hover': { backgroundColor: alpha(t.palette.primary.main, 0.18) },
              '& .MuiListItemIcon-root': { color: t.palette.primary.dark },
            },
          }),
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme: t }) => ({
            backgroundColor: t.palette.background.paper,
            color: t.palette.text.primary,
            borderBottom: `1px solid ${t.palette.divider}`,
          }),
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            color: t.palette.text.secondary,
            '&.Mui-selected': { color: t.palette.primary.dark },
          }),
          label: {
            fontWeight: 600,
            '&.Mui-selected': { fontSize: '0.75rem' },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 20 },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            backgroundColor: alpha(t.palette.primary.main, 0.14),
            color: t.palette.primary.dark,
            fontWeight: 600,
          }),
        },
      },
    },
  },
  esES,
);
