import type { SxProps, Theme } from '@mui/material';

/**
 * Shared look of the dark bars: the page header ("Market Watch & Analytics") and the
 * past-performance toolbar (period radios + Performance button). Dark background,
 * white bold text, compact padding.
 */
export const DARK_TOOLBAR_SX: SxProps<Theme> = {
  px: 2,
  py: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexWrap: 'wrap',
  bgcolor: 'grey.900',
  color: 'common.white',
  fontWeight: 700,
};
