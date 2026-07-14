import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { getMonthLabel, shiftMonth } from '@/shared/utils/date';

export interface MonthNavigatorProps {
  year: number;
  month: number;
  onChange: (next: { year: number; month: number }) => void;
}

export function MonthNavigator({ year, month, onChange }: MonthNavigatorProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton
        aria-label="Mes anterior"
        onClick={() => onChange(shiftMonth(year, month, -1))}
        size="small"
      >
        <Typography component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden>
          ‹
        </Typography>
      </IconButton>
      <Typography variant="subtitle1" sx={{ minWidth: 160, textAlign: 'center' }}>
        {getMonthLabel(year, month)}
      </Typography>
      <IconButton
        aria-label="Mes siguiente"
        onClick={() => onChange(shiftMonth(year, month, 1))}
        size="small"
      >
        <Typography component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden>
          ›
        </Typography>
      </IconButton>
    </Box>
  );
}
