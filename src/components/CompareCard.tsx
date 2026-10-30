import { Box, Divider, Paper, Typography } from '@mui/material';
import type { SymbolComparison } from '../hooks/useWatchlistComparison.ts';
import { performancePeriodLabel } from '../types/performance.ts';
import ErrorBanner from './ErrorBanner.tsx';
import PriceChart from './PriceChart.tsx';
import StockSummaryCards from './StockSummaryCards.tsx';

export interface CompareCardProps {
  comparison: SymbolComparison;
}

/** Height of the miniature chart; about two thirds of the Analysis chart. */
export const COMPARE_CHART_HEIGHT = 190;

/**
 * One symbol of a watchlist comparison: a header with the symbol and company, the latest
 * price / high / low tiles in a row, and a miniature price chart — or the reason the
 * symbol could not be fetched. No interval table here; that is the Analysis view's job.
 */
export default function CompareCard({ comparison }: CompareCardProps) {
  const { symbol, details, performance, error } = comparison;
  const name = details?.displayName ?? details?.longName;
  const chartTitle = performance
    ? `Price Trend — Past ${performancePeriodLabel(performance.period)}${
        performance.referenceDate ? ` to ${performance.referenceDate}` : ''
      }`
    : undefined;

  return (
    <Paper
      component="article"
      aria-label={`Comparison for ${symbol}`}
      data-testid={`compare-${symbol}`}
      sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}
    >
      <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" component="h3" sx={{ lineHeight: 1.3 }} data-testid="compare-symbol">
          {symbol}
        </Typography>
        {name && (
          <Typography variant="caption" color="textSecondary" noWrap sx={{ minWidth: 0 }}>
            {name}
          </Typography>
        )}
      </Box>
      <Divider />

      {error && (
        <Box sx={{ p: 1.5 }}>
          <ErrorBanner error={error} />
        </Box>
      )}

      {performance && (
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <StockSummaryCards performance={performance} currency={details?.currency} direction="row" />
          <PriceChart
            history={performance.points}
            title={chartTitle}
            currency={details?.currency}
            height={COMPARE_CHART_HEIGHT}
            embedded
          />
        </Box>
      )}
    </Paper>
  );
}
