import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import type { IndividualProgressRow } from '@/shared/types/domain';
import { progressPercent, summarizeProgress } from '@/features/goals/progressMath';

export interface SupervisorBreakdownListProps {
  rows: IndividualProgressRow[];
}

/**
 * Desglose por supervisora dentro de una sede: meta individual, realizadas y
 * barra de avance. Solo lectura; se usa en el dashboard del jefe y en el
 * detalle de sede.
 */
export function SupervisorBreakdownList({ rows }: SupervisorBreakdownListProps) {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin metas ni visitas de supervisoras este mes.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map((row) => {
        const summary = summarizeProgress(
          row.individual_target ?? 0,
          row.individual_done ?? 0,
          row.individual_active ?? 0,
        );
        const percent = progressPercent(summary);
        return (
          <Box key={`${row.supervisor_id}-${row.region_id}`}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {row.supervisor_name ?? '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary.done} / {summary.target}
                {row.has_goal === false ? ' (sin meta)' : ''}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
