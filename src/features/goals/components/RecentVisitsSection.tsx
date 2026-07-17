import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import type { RecentRealizedVisit } from '@/services/supabase/visits';
import { formatDateEsPE } from '@/shared/utils/date';

// "Últimas visitas" del Inicio: las 10 más recientes REALIZADAS. Una misma
// asociación puede repetirse (no se agrupa). El acceso lleva al detalle exacto
// de la visita (ancla #visita-{id} en el historial de la asociación).

export function RecentVisitsSection({
  title,
  visits,
  emptyMessage,
  showSupervisor = false,
}: {
  title: string;
  visits: RecentRealizedVisit[];
  emptyMessage: string;
  showSupervisor?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 280 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" component="h2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip size="small" label={visits.length} />
      </Box>
      {visits.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      ) : (
        <List dense disablePadding>
          {visits.map((visit) => (
            <ListItemButton
              key={visit.id}
              onClick={() => navigate(`/asociaciones/${visit.association_id}#visita-${visit.id}`)}
            >
              <ListItemText
                primary={`${visit.association?.name ?? '—'} · ${visit.association?.bank_code ?? ''}`}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontWeight: 600 } },
                  secondary: { component: 'div' },
                }}
                secondary={
                  <Box
                    component="span"
                    sx={{
                      display: 'flex',
                      gap: 1,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      mt: 0.5,
                    }}
                  >
                    <span>
                      {formatDateEsPE(visit.performed_date)} · Asesor:{' '}
                      {visit.scheduled_advisor?.full_name ?? '—'}
                      {showSupervisor
                        ? ` · Supervisora: ${visit.supervisor?.full_name ?? '—'}`
                        : ''}
                    </span>
                    <Chip size="small" label={`Puntuación ${visit.score ?? '—'}`} />
                    {visit.photoCount > 0 ? (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.25,
                          color: 'text.secondary',
                        }}
                        aria-label={`${visit.photoCount} fotografías`}
                      >
                        <PhotoLibraryRoundedIcon sx={{ fontSize: 16 }} aria-hidden />
                        {visit.photoCount}
                      </Box>
                    ) : null}
                    {visit.hasDocument ? (
                      <Tooltip title="Tiene documento de retroalimentación">
                        <PictureAsPdfRoundedIcon
                          sx={{ fontSize: 16, color: 'text.secondary' }}
                          aria-label="Tiene documento de retroalimentación"
                        />
                      </Tooltip>
                    ) : null}
                  </Box>
                }
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}
