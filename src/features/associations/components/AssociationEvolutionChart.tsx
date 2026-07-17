import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { VisitWithRelations } from '@/services/supabase/visits';
import { computeEvolution } from '@/features/associations/associationInsights';
import { formatDateEsPE, parseISODate } from '@/shared/utils/date';
import { VISIT_MODALITY_LABELS, VISIT_TYPE_LABELS } from '@/shared/utils/labels';

// "Evolución de la asociación": línea de puntuaciones (0-5) de las últimas
// seis visitas realizadas. Una sola serie: color primario del tema, sin
// leyenda; el resumen textual compara únicamente las dos últimas visitas.

interface ChartPoint {
  dateISO: string;
  score: number;
  visit: VisitWithRelations;
}

function summarizeLastTwo(pointsAsc: ChartPoint[]): string | null {
  const evolution = computeEvolution([...pointsAsc].reverse().map((point) => point.score));
  switch (evolution.kind) {
    case 'IMPROVED':
      return `Mejoró ${evolution.delta} ${evolution.delta === 1 ? 'punto' : 'puntos'} respecto a la visita anterior`;
    case 'DECLINED':
      return `Disminuyó ${Math.abs(evolution.delta)} ${Math.abs(evolution.delta) === 1 ? 'punto' : 'puntos'} respecto a la visita anterior`;
    case 'STEADY':
      return 'Se mantuvo respecto a la visita anterior';
    default:
      return null;
  }
}

function EvolutionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const visit = point.visit;
  return (
    <Paper elevation={3} sx={{ p: 1.5, maxWidth: 260 }}>
      <Typography variant="subtitle2">{formatDateEsPE(point.dateISO)}</Typography>
      <Typography variant="body2">Puntuación: {point.score}</Typography>
      <Typography variant="body2" color="text.secondary">
        {VISIT_TYPE_LABELS[visit.visit_type]} · {VISIT_MODALITY_LABELS[visit.modality]}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Supervisora: {visit.supervisor?.full_name ?? '—'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Asesor: {visit.scheduled_advisor?.full_name ?? '—'}
      </Typography>
    </Paper>
  );
}

export function AssociationEvolutionChart({ history }: { history: VisitWithRelations[] }) {
  const theme = useTheme();

  // Últimas 6 visitas realizadas, en orden cronológico ascendente para el eje X.
  const points = useMemo<ChartPoint[]>(() => {
    return history
      .filter((visit) => visit.status === 'REALIZADA' && visit.performed_date != null)
      .sort(
        (a, b) =>
          parseISODate(b.performed_date!).getTime() - parseISODate(a.performed_date!).getTime(),
      )
      .slice(0, 6)
      .reverse()
      .map((visit) => ({
        dateISO: visit.performed_date!,
        score: visit.score ?? 0,
        visit,
      }));
  }, [history]);

  const summary = summarizeLastTwo(points);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: 1,
        }}
      >
        <Typography variant="h6" component="h2">
          Evolución de la asociación
        </Typography>
        {summary ? <Chip size="small" variant="outlined" label={summary} /> : null}
      </Box>

      {points.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Esta asociación todavía no ha sido visitada.
        </Typography>
      ) : (
        <>
          {points.length === 1 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Sin tendencia todavía
            </Typography>
          ) : null}
          <Box sx={{ width: '100%', height: { xs: 220, sm: 260 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  dataKey="dateISO"
                  tickFormatter={(value: string) => formatDateEsPE(value)}
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  tickMargin={8}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  allowDecimals={false}
                />
                <Tooltip content={<EvolutionTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={{ r: 4, fill: theme.palette.primary.main }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
    </Paper>
  );
}
