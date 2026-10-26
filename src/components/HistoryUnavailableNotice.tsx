import { Paper, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/**
 * Shown in place of the chart and hourly table when the data source has no
 * historic prices for the symbol (e.g. the live `GET /stock/{symbol}` endpoint).
 */
export default function HistoryUnavailableNotice() {
  return (
    <Paper
      role="note"
      data-testid="history-unavailable"
      sx={{ px: 2, py: 1.5, display: 'flex', gap: 1.5, alignItems: 'center' }}
    >
      <InfoOutlinedIcon color="action" fontSize="small" />
      <Typography variant="body2" color="textSecondary">
        This data source does not provide historic prices, so the 24-hour chart and hourly breakdown
        are not shown.
      </Typography>
    </Paper>
  );
}
