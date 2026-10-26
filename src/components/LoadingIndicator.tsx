import { Box, CircularProgress, Paper, Typography } from '@mui/material';

interface LoadingIndicatorProps {
  symbol?: string | null;
  /** What is being fetched, e.g. "results" or "past performance". */
  subject?: string;
  /** Secondary line describing what the request retrieves. */
  caption?: string;
  /** Vertical padding in theme spacing units. */
  py?: number;
}

export default function LoadingIndicator({
  symbol,
  subject = 'results',
  caption = 'Retrieving stock details',
  py = 5,
}: LoadingIndicatorProps) {
  return (
    <Paper
      role="status"
      aria-live="polite"
      data-testid="loading-indicator"
      sx={{ py, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}
    >
      <CircularProgress size={36} thickness={4} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="subtitle1">
          Fetching {subject}
          {symbol ? ` for ${symbol}` : ''}…
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {caption}
        </Typography>
      </Box>
    </Paper>
  );
}
