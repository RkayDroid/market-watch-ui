import { Box, Button, CircularProgress, Divider, Paper, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import DownloadIcon from '@mui/icons-material/Download';
import type { LookupError } from '../errors/lookupError.ts';
import { performancePeriodLabel, type PerformancePeriod } from '../types/performance.ts';
import type { PastPerformance, StockDetails } from '../types/stock.ts';
import { describeInterval } from '../utils/format.ts';
import { LAYOUT } from '../layout.ts';
import ErrorBanner from './ErrorBanner.tsx';
import LoadingIndicator from './LoadingIndicator.tsx';
import PeriodSelector from './PeriodSelector.tsx';
import PriceChart from './PriceChart.tsx';
import HourlyPriceTable from './HourlyPriceTable.tsx';
import StockSummaryCards from './StockSummaryCards.tsx';

export interface PastPerformanceSectionProps {
  details: StockDetails;
  period: PerformancePeriod;
  onPeriodChange: (period: PerformancePeriod) => void;
  /** Requests historic + high/low data for `details.symbol` over `period`. */
  onFetch: () => void;
  /** Loaded performance, if any. May be for a different period than the one selected. */
  performance: PastPerformance | null;
  loading: boolean;
  /** Period of the in-flight request, shown in the loading indicator. */
  pendingPeriod?: PerformancePeriod | null;
  error: LookupError | null;
}

export const PAST_PERFORMANCE_HEADING_ID = 'past-performance-heading';

/**
 * "Past Performance" as one panel: a header bar (title, period selector, Fetch), then —
 * separated by dividers — the summary tiles beside the price chart, and the interval table.
 * Until the first fetch the chart and table render their empty states.
 */
export default function PastPerformanceSection({
  details,
  period,
  onPeriodChange,
  onFetch,
  performance,
  loading,
  pendingPeriod,
  error,
}: PastPerformanceSectionProps) {
  const points = performance?.points ?? [];
  const loadedLabel = performance ? `Past ${performancePeriodLabel(performance.period)}` : null;
  const chartTitle = loadedLabel ? `Price Trend — ${loadedLabel}` : 'Price Trend';
  const tableTitle = loadedLabel
    ? `Price Intervals — ${loadedLabel}${performance?.interval ? ` (${describeInterval(performance.interval)})` : ''}`
    : 'Price Intervals';

  return (
    <Paper
      component="section"
      aria-labelledby={PAST_PERFORMANCE_HEADING_ID}
      data-testid="past-performance"
      sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          bgcolor: 'action.hover',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
          <HistoryIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" component="h2" id={PAST_PERFORMANCE_HEADING_ID}>
            Past Performance
          </Typography>
        </Box>
        <PeriodSelector value={period} onChange={onPeriodChange} disabled={loading} />
        <Button
          variant="contained"
          size="small"
          startIcon={loading ? undefined : <DownloadIcon />}
          disabled={loading}
          onClick={onFetch}
          aria-label="Fetch"
          sx={{ flexShrink: 0, whiteSpace: 'nowrap', minWidth: 88 }}
          data-testid="fetch-performance"
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Fetch'}
        </Button>
      </Box>
      <Divider />

      {error && (
        <Box sx={{ p: 2, pb: 0 }}>
          <ErrorBanner error={error} />
        </Box>
      )}

      {loading ? (
        <Box sx={{ p: 2 }}>
          <LoadingIndicator
            symbol={details.symbol}
            subject="past performance"
            caption={`Retrieving historic prices and high/low for the past ${
              pendingPeriod ? performancePeriodLabel(pendingPeriod).toLowerCase() : 'period'
            }`}
            py={3}
          />
        </Box>
      ) : (
        <>
          <Box
            data-testid="overview-row"
            sx={{
              display: 'flex',
              gap: 2,
              p: 2,
              alignItems: 'stretch',
              flexDirection: { xs: 'column', md: 'row' },
            }}
          >
            {performance && (
              <Box sx={{ width: { xs: '100%', md: LAYOUT.overviewTiles }, flexShrink: 0 }}>
                <StockSummaryCards performance={performance} currency={details.currency} />
              </Box>
            )}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <PriceChart history={points} title={chartTitle} currency={details.currency} embedded />
            </Box>
          </Box>
          <Divider />
          <HourlyPriceTable history={points} title={tableTitle} currency={details.currency} embedded />
        </>
      )}
    </Paper>
  );
}
