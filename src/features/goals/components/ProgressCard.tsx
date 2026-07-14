import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { progressPercent } from '@/features/goals/progressMath';
import type { ProgressSummary } from '@/features/goals/progressMath';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 64,
        textAlign: 'center',
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        px: 1,
        py: 1.25,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}

export function ProgressCard({ title, summary }: { title: string; summary: ProgressSummary }) {
  const theme = useTheme();
  const percent = progressPercent(summary);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        flex: 1,
        minWidth: 260,
        bgcolor: alpha(theme.palette.primary.main, 0.05),
        borderColor: alpha(theme.palette.primary.main, 0.2),
      }}
    >
      <Typography variant="subtitle1" gutterBottom>
        {title}
      </Typography>
      {summary.target === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay meta configurada para este mes.
        </Typography>
      ) : (
        <>
          <Typography variant="h3" component="p" color="primary.dark" sx={{ fontWeight: 700 }}>
            {percent}%
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {summary.done} de {summary.target} visitas realizadas
          </Typography>
          <LinearProgress variant="determinate" value={percent} sx={{ mb: 2 }} />
        </>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: summary.target === 0 ? 1.5 : 0 }}>
        <StatTile label="Meta" value={summary.target} />
        <StatTile label="Realizadas" value={summary.done} />
        <StatTile label="Activas" value={summary.active} />
        <StatTile label="Faltantes" value={summary.missing} />
      </Box>
    </Paper>
  );
}
