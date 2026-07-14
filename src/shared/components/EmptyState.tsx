import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        py: 6,
        px: 2,
        color: 'text.secondary',
      }}
    >
      <Typography variant="subtitle1" color="text.primary">
        {title}
      </Typography>
      {description ? <Typography variant="body2">{description}</Typography> : null}
      {action}
    </Box>
  );
}
