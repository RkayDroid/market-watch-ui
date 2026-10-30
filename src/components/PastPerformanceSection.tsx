import { Box, Divider, Paper } from '@mui/material';
import type { LookupError } from '../errors/lookupError.ts';
import { performancePeriodLabel, type PerformancePeriod } from '../types/performance.ts';
import type { PastPerformance, StockDetails } from '../types/stock.ts';
import { describeInterval } from '../utils/format.ts';
import { LAYOUT } from '../layout.ts';
import ErrorBanner from './ErrorBanner.tsx';
import LoadingIndicator from './LoadingIndicator.tsx';
import PerformanceToolbar from './PerformanceToolbar.tsx';
import PriceChart from './PriceChart.tsx';
import HourlyPriceTable from './HourlyPriceTable.tsx';
import StockSummaryCards from './StockSummaryCards.tsx';

export interface PastPerformanceSectionProps {
  details: StockDetails;
  /**
   * Optional reference date (`YYYY-MM-DD`, or `''` for none) the look-back window is
   * anchored on. `onFetch` is blocked while it is invalid.
   */
  referenceDate: string;
  onReferenceDateChange: (value: string) => void;
  /** Latest allowed reference date, normally today (`YYYY-MM-DD`). */
  maxReferenceDate: string;
  period: PerformancePeriod;
  onPeriodChange: (period: PerformancePeriod) => void;
  /** Requests the historic candles (and with them the high/low) for `details.symbol` over `period`. */
  onFetch: () => void;
  /** Loaded performance, if any. May be for a different period than the one selected. */
  performance: PastPerformance | null;
  loading: boolean;
  /** Period of the in-flight request, shown in the loading indicator. */
  pendingPeriod?: PerformancePeriod | null;
  error: LookupError | null;
}

/** Accessible name of the panel; it has no visible title. */
export const PAST_PERFORMANCE_LABEL = 'Past Performance';

/**
 * Past-performance panel: a dark toolbar (period selector + "Performance" button) and — only
 * once a fetch is in flight, failed or loaded — the summary tiles beside the price chart and
 * the interval table. Before the first fetch the panel is just its toolbar.
 */
export default function PastPerformanceSection({
  details,
  referenceDate,
  onReferenceDateChange,
  maxReferenceDate,
  period,
  onPeriodChange,
  onFetch,
  performance,
  loading,
  pendingPeriod,
  error,
}: PastPerformanceSectionProps) {
  const loadedLabel = performance ? `Past ${performancePeriodLabel(performance.period)}` : '';
  // The date the served window really ends on — for the offline source this can differ from the pick.
  const chartTitle = `Price Trend — ${loadedLabel}${performance?.referenceDate ? ` to ${performance.referenceDate}` : ''}`;
  const tableTitle = `Price Intervals — ${loadedLabel}${
    performance?.interval ? ` (${describeInterval(performance.interval)})` : ''
  }`;

  return (
    <Paper
      component="section"
      aria-label={PAST_PERFORMANCE_LABEL}
      data-testid="past-performance"
      sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <PerformanceToolbar
        referenceDate={referenceDate}
        onReferenceDateChange={onReferenceDateChange}
        maxReferenceDate={maxReferenceDate}
        period={period}
        onPeriodChange={onPeriodChange}
        onAction={onFetch}
        loading={loading}
      />

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
