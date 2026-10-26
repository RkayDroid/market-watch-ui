import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';

export interface TileProps {
  label: string;
  testId: string;
  /** Primary value. */
  children: ReactNode;
  /** Optional supporting line shown under the value (e.g. a full name for a code). */
  secondary?: ReactNode;
  /** Optional adornment rendered beside the value (e.g. a change chip). */
  extra?: ReactNode;
}

/** Compact labelled value card shared by the summary column and the detail grid. */
export default function Tile({ label, testId, children, secondary, extra }: TileProps) {
  return (
    <Paper
      sx={{ px: 1.5, py: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minWidth: 0 }}
    >
      <Typography variant="caption" color="textSecondary" sx={{ lineHeight: 1.2, mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, lineHeight: 1.3, overflowWrap: 'break-word' }}
          data-testid={testId}
        >
          {children}
        </Typography>
        {extra}
      </Box>
      {secondary && (
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ lineHeight: 1.2, mt: 0.25 }}
          data-testid={`${testId}-secondary`}
        >
          {secondary}
        </Typography>
      )}
    </Paper>
  );
}
