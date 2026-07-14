import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
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
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { fetchAssociations } from '@/services/supabase/associations';
import { fetchRegions } from '@/services/supabase/regions';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { ASSOCIATION_STATUSES } from '@/shared/types/domain';
import type { AssociationStatus } from '@/shared/types/domain';
import { ASSOCIATION_STATUS_COLORS, ASSOCIATION_STATUS_LABELS } from '@/shared/utils/labels';

export function AssociationsListPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [search, setSearch] = useState('');
  const [regionId, setRegionId] = useState('');
  const [status, setStatus] = useState<AssociationStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search);

  const { data: regions } = useAsyncData(fetchRegions, []);
  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      regionId: regionId || undefined,
      status: status || undefined,
    }),
    [debouncedSearch, regionId, status],
  );
  const {
    data: associations,
    loading,
    error,
    reload,
  } = useAsyncData(
    () => fetchAssociations(filters),
    [filters.search, filters.regionId, filters.status],
  );

  const hasFilters = Boolean(search || regionId || status);
  const clearFilters = () => {
    setSearch('');
    setRegionId('');
    setStatus('');
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Asociaciones
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField
          label="Buscar por código o nombre"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          size="small"
          sx={{ minWidth: 240, flexGrow: 1 }}
        />
        <TextField
          select
          label="Región"
          value={regionId}
          onChange={(event) => setRegionId(event.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(regions ?? []).map((region) => (
            <MenuItem key={region.id} value={region.id}>
              {region.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as AssociationStatus | '')}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {ASSOCIATION_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {ASSOCIATION_STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={clearFilters} disabled={!hasFilters}>
          Limpiar filtros
        </Button>
      </Box>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {loading && !error ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={40} />
          ))}
        </Paper>
      ) : null}

      {!loading && !error && (associations?.length ?? 0) === 0 ? (
        <EmptyState
          title="Ninguna asociación coincide con los filtros"
          description="Prueba ajustando la búsqueda, la región o el estado."
        />
      ) : null}

      {!loading && !error && associations && associations.length > 0 ? (
        isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {associations.map((association) => (
              <Card key={association.id} variant="outlined">
                <CardActionArea onClick={() => navigate(`/asociaciones/${association.id}`)}>
                  <CardContent>
                    <Typography variant="subtitle1">{association.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Código {association.bank_code} · {association.region?.name ?? 'Sin región'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Asesor: {association.advisor?.full_name ?? 'Sin asesor'}
                    </Typography>
                    <Chip
                      size="small"
                      sx={{ mt: 1 }}
                      label={ASSOCIATION_STATUS_LABELS[association.status]}
                      color={ASSOCIATION_STATUS_COLORS[association.status]}
                    />
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Región</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Asesor actual</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {associations.map((association) => (
                  <TableRow
                    key={association.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/asociaciones/${association.id}`)}
                  >
                    <TableCell>{association.bank_code}</TableCell>
                    <TableCell>{association.name}</TableCell>
                    <TableCell>{association.region?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={ASSOCIATION_STATUS_LABELS[association.status]}
                        color={ASSOCIATION_STATUS_COLORS[association.status]}
                      />
                    </TableCell>
                    <TableCell>{association.advisor?.full_name ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : null}
    </Box>
  );
}
