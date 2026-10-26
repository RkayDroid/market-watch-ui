import { Chip, Stack } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { PastPerformance } from '../types/stock.ts';
import { formatPrice } from '../utils/format.ts';
import { formatPointLabel } from '../services/stockAnalytics.ts';
import Tile from './Tile.tsx';

interface StockSummaryCardsProps {
  performance: PastPerformance;
  /** ISO-4217 code used to format the prices; defaults to USD. */
  currency?: string;
  /** Formats the "occurred at" timestamps; injectable for deterministic tests. */
  formatOccurredAt?: (date: string) => string;
}

/**
 * Compact, vertically stacked tiles for the selected period: the latest sampled price
 * with the change over the period, and the high / low from `/highlow` with when they
 * occurred. Rendered beside the chart; stretches to the height of its container.
 */
export default function StockSummaryCards({
  performance,
  currency,
  formatOccurredAt = formatPointLabel,
}: StockSummaryCardsProps) {
  const positive = performance.changePercent >= 0;

  return (
    <Stack spacing={1} sx={{ height: '100%' }} data-testid="summary-tiles">
      <Tile
        label="Latest Price"
        testId="summary-price"
        extra={
          <Chip
            icon={positive ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={`${performance.changePercent}%`}
            color={positive ? 'success' : 'error'}
            size="small"
            sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
            data-testid="summary-change"
          />
        }
      >
        {formatPrice(performance.latestPrice, currency)}
      </Tile>
      <Tile label="High" testId="summary-high" secondary={formatOccurredAt(performance.high.occurredAt)}>
        {formatPrice(performance.high.price, currency)}
      </Tile>
      <Tile label="Low" testId="summary-low" secondary={formatOccurredAt(performance.low.occurredAt)}>
        {formatPrice(performance.low.price, currency)}
      </Tile>
    </Stack>
  );
}
