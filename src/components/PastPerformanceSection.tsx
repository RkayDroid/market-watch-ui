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
 * "Past Performance" as one panel: a header bar (title, period selector, Fetch) and — only
 * once a fetch is in flight, failed or loaded — the summary tiles beside the price chart and
 * the interval table. Before the first fetch the panel is just its header.
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
  const loadedLabel = performance ? `Past ${performancePeriodLabel(performance.period)}` : '';
  const chartTitle = `Price Trend — ${loadedLabel}`;
  const tableTitle = `Price Intervals — ${loadedLabel}${
    performance?.interval ? ` (${describeInterval(performance.interval)})` : ''
  }`;

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6" component="h2" id={PAST_PERFORMANCE_HEADING_ID} sx={{ fontWeight: 600 }}>
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

      {error && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <ErrorBanner error={error} />
          </Box>
        </>
      )}

      {loading && (
        <Box sx={{ p: 2, pt: 0 }}>
          <LoadingIndicator
            symbol={details.symbol}
            subject="past performance"
            caption={`Retrieving historic prices and high/low for the past ${
              pendingPeriod ? performancePeriodLabel(pendingPeriod).toLowerCase() : 'period'
            }`}
            py={3}
          />
        </Box>
      )}

      {performance && !loading && (
        <>
          <Divider />
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
            <Box sx={{ width: { xs: '100%', md: LAYOUT.overviewTiles }, flexShrink: 0 }}>
              <StockSummaryCards performance={performance} currency={details.currency} />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <PriceChart history={performance.points} title={chartTitle} currency={details.currency} embedded />
            </Box>
          </Box>
          <Divider />
          <HourlyPriceTable history={performance.points} title={tableTitle} currency={details.currency} embedded />
        </>
      )}
    </Paper>
  );
}
