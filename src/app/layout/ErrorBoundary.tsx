import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Los error boundaries de React solo pueden implementarse como clase.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Error no controlado en la interfaz:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

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
        <Typography variant="h6">Ocurrió un error inesperado</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          Algo falló al mostrar esta pantalla. Puedes intentar volver al inicio; si el problema
          persiste, avisa a quien administra Supervisa 360.
        </Typography>
        <Button variant="contained" onClick={this.handleReload}>
          Volver al inicio
        </Button>
      </Box>
    );
  }
}
