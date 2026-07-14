import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { fetchAdvisors } from '@/services/supabase/advisors';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';

export function AdvisorsListPage() {
  const [search, setSearch] = useState('');
  const { data: advisors, loading, error, reload } = useAsyncData(fetchAdvisors, []);

  const filtered = useMemo(() => {
    if (!advisors) return [];
    const term = search.trim().toLowerCase();
    if (!term) return advisors;
    return advisors.filter(
      (advisor) =>
        advisor.code.toLowerCase().includes(term) || advisor.full_name.toLowerCase().includes(term),
    );
  }, [advisors, search]);

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Asesores
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Catálogo de asesores. Es de solo lectura: la creación y edición se hace por importación de
        CSV fuera de la aplicación.
      </Typography>

      <TextField
        label="Buscar por código o nombre"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        size="small"
        sx={{ mb: 2, maxWidth: 360, width: '100%' }}
      />

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {loading && !error ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={40} />
          ))}
        </Paper>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          title={
            advisors && advisors.length > 0
              ? 'Ningún asesor coincide con la búsqueda'
              : 'Todavía no hay asesores cargados'
          }
          description={
            advisors && advisors.length > 0
              ? 'Prueba con otro código o nombre.'
              : 'El catálogo de asesores se carga por importación de CSV.'
          }
        />
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((advisor) => (
                <TableRow key={advisor.id} hover>
                  <TableCell>{advisor.code}</TableCell>
                  <TableCell>{advisor.full_name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={advisor.is_active ? 'Activo' : 'Inactivo'}
                      color={advisor.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  );
}
