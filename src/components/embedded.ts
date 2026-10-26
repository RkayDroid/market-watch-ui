import type { SxProps, Theme } from '@mui/material';

/**
 * Style for a card-like component rendered inside a larger panel: drops its own
 * border, rounding and background so it reads as part of the surrounding group.
 */
export const EMBEDDED_PAPER_SX: SxProps<Theme> = {
  border: 0,
  borderRadius: 0,
  bgcolor: 'transparent',
};
