import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { VisitWithRelations } from '@/services/supabase/visits';
import { formatDateEsPE, formatTime } from '@/shared/utils/date';
import { VISIT_STATUS_COLORS, VISIT_STATUS_LABELS } from '@/shared/utils/labels';

export function VisitListSection({
  title,
  visits,
  emptyMessage,
}: {
  title: string;
  visits: VisitWithRelations[];
  emptyMessage: string;
}) {
  const navigate = useNavigate();

  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 280 }}>
      <Typography variant="subtitle1" gutterBottom>
        {title}
      </Typography>
      {visits.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      ) : (
        <List dense disablePadding>
          {visits.map((visit) => (
            <ListItemButton
              key={visit.id}
              onClick={() => navigate(`/asociaciones/${visit.association_id}`)}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText
                primary={visit.association?.name ?? '—'}
                slotProps={{ secondary: { component: 'div' } }}
                secondary={
                  <Box
                    component="span"
                    sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <span>
                      {formatDateEsPE(visit.scheduled_date)} {formatTime(visit.scheduled_time)}
                    </span>
                    <Chip
                      size="small"
                      label={VISIT_STATUS_LABELS[visit.status]}
                      color={VISIT_STATUS_COLORS[visit.status]}
                    />
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
