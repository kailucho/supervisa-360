import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { progressPercent } from '@/features/goals/progressMath';
import type { ProgressSummary } from '@/features/goals/progressMath';

export function ProgressCard({ title, summary }: { title: string; summary: ProgressSummary }) {
  const percent = progressPercent(summary);

  return (
    <Paper variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 260 }}>
      <Typography variant="subtitle1" gutterBottom>
        {title}
      </Typography>
      {summary.target === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay meta configurada para este mes.
        </Typography>
      ) : (
        <>
          <LinearProgress
            variant="determinate"
            value={percent}
            sx={{ height: 8, borderRadius: 4, mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {summary.done} de {summary.target} realizadas ({percent}%)
          </Typography>
        </>
      )}
      <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Meta
          </Typography>
          <Typography variant="h6">{summary.target}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Realizadas
          </Typography>
          <Typography variant="h6">{summary.done}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Activas
          </Typography>
          <Typography variant="h6">{summary.active}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Faltantes
          </Typography>
          <Typography variant="h6">{summary.missing}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}
