import { Chip, Stack } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { PriceHistory } from '../types/stock.ts';
import { formatPrice } from '../utils/format.ts';
import Tile from './Tile.tsx';

interface StockSummaryCardsProps {
  history: PriceHistory;
  /** ISO-4217 code used to format the prices; defaults to USD. */
  currency?: string;
}

/**
 * Compact, vertically stacked tiles for the figures derived from the 24h price series.
 * Rendered beside the chart; stretches to the height of its container.
 */
export default function StockSummaryCards({ history, currency }: StockSummaryCardsProps) {
  const positive = history.changePercent >= 0;

  return (
    <Stack spacing={1} sx={{ height: '100%' }} data-testid="summary-tiles">
      <Tile
        label="Current Price"
        testId="summary-price"
        extra={
          <Chip
            icon={positive ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={`${history.changePercent}%`}
            color={positive ? 'success' : 'error'}
            size="small"
            sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
            data-testid="summary-change"
          />
        }
      >
        {formatPrice(history.currentPrice, currency)}
      </Tile>
      <Tile label="24h High / Low" testId="summary-high-low">
        {formatPrice(history.highPrice, currency)} / {formatPrice(history.lowPrice, currency)}
      </Tile>
    </Stack>
  );
}
