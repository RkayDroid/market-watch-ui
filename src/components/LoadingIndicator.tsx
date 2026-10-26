import { Box, CircularProgress, Paper, Typography } from '@mui/material';

interface LoadingIndicatorProps {
  symbol?: string | null;
}

export default function LoadingIndicator({ symbol }: LoadingIndicatorProps) {
  return (
    <Paper
      role="status"
      aria-live="polite"
      data-testid="loading-indicator"
      sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}
    >
      <CircularProgress size={36} thickness={4} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="subtitle1">Fetching results{symbol ? ` for ${symbol}` : ''}…</Typography>
        <Typography variant="caption" color="textSecondary">
          Retrieving stock details
        </Typography>
      </Box>
    </Paper>
  );
}
