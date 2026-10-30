import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

export interface SectionTitleProps {
  /** Id for `aria-labelledby` on the owning section. */
  id?: string;
  icon: ReactNode;
  children: ReactNode;
  /** Optional controls rendered at the right end of the title row. */
  action?: ReactNode;
}

/** Small bold heading with a leading icon, used by the Watchlist view. */
export default function SectionTitle({ id, icon, children, action }: SectionTitleProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
      {icon}
      <Typography id={id} variant="subtitle1" component="h2" sx={{ lineHeight: 1.3, flexGrow: 1 }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}
