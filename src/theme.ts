import { createTheme } from '@mui/material/styles';

/**
 * Brand purple of the favicon, hero and icon sprite. Used as the secondary colour so the
 * Watchlist view can pick it up for accents while the working screens keep the neutral
 * primary/dark-bar look.
 */
export const BRAND_PURPLE = '#863bff';

/** Compact, dashboard-style theme: tighter spacing and slightly smaller type throughout. */
export const theme = createTheme({
  palette: {
    mode: 'light',
    secondary: { main: BRAND_PURPLE },
    background: { default: '#f5f6f8' },
  },
  typography: {
    fontSize: 13,
    h5: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid', borderColor: 'rgba(0,0,0,0.12)' },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
