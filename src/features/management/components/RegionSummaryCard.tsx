import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { IndividualProgressRow, JointProgressRow } from '@/shared/types/domain';
import { progressPercent, summarizeProgress } from '@/features/goals/progressMath';
import { SupervisorBreakdownList } from './SupervisorBreakdownList';

export interface RegionSummaryCardProps {
  regionName: string;
  joint: JointProgressRow | null;
  individualRows: IndividualProgressRow[];
  onViewDetail: () => void;
}

/**
 * Tarjeta de una sede en el dashboard de jefatura: meta efectiva (con
 * indicador de si es definida por el jefe o sugerida), realizadas, % de avance
 * y desglose por supervisora (RN-30).
 */
export function RegionSummaryCard({
  regionName,
  joint,
  individualRows,
  onViewDetail,
}: RegionSummaryCardProps) {
  const summary = summarizeProgress(
    joint?.effective_joint_target ?? 0,
    joint?.joint_done ?? 0,
    joint?.joint_active ?? 0,
  );
  const percent = progressPercent(summary);
  const isConfigured = joint?.is_configured === true;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" component="h2">
          {regionName}
        </Typography>
        <Chip
          size="small"
          label={isConfigured ? 'Meta definida' : 'Meta sugerida'}
          color={isConfigured ? 'primary' : 'default'}
          variant={isConfigured ? 'filled' : 'outlined'}
        />
      </Box>

      {summary.target === 0 && summary.done === 0 && summary.active === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sin metas ni visitas registradas este mes.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h4" component="p" color="primary.dark" sx={{ fontWeight: 700 }}>
              {percent}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {summary.done} de {summary.target} visitas realizadas · {summary.active} activas
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={percent} />
        </>
      )}

      <Divider />
      <SupervisorBreakdownList rows={individualRows} />

      <Button variant="outlined" onClick={onViewDetail} sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
        Ver detalle
      </Button>
    </Paper>
  );
}
