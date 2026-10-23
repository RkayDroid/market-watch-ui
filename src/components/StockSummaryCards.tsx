import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { StockData } from '../types/stock.ts';

interface StockSummaryCardsProps {
  stock: StockData;
}

interface TileProps {
  label: string;
  testId: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}

function Tile({ label, testId, children, extra }: TileProps) {
  return (
    <Paper sx={{ px: 1.5, py: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
      <Typography variant="caption" color="textSecondary" sx={{ lineHeight: 1.2, mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }} data-testid={testId}>
          {children}
        </Typography>
        {extra}
      </Box>
    </Paper>
  );
}

/** Compact, vertically stacked summary tiles. Stretches to the height of its container. */
export default function StockSummaryCards({ stock }: StockSummaryCardsProps) {
  const positive = stock.changePercent >= 0;

  return (
    <Stack spacing={1} sx={{ height: '100%' }} data-testid="summary-tiles">
      <Tile label="Symbol" testId="summary-symbol">
        {stock.symbol}
      </Tile>
      <Tile
        label="Current Price"
        testId="summary-price"
        extra={
          <Chip
            icon={positive ? <TrendingUpIcon /> : <TrendingDownIcon />}
            label={`${stock.changePercent}%`}
            color={positive ? 'success' : 'error'}
            size="small"
            sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
            data-testid="summary-change"
          />
        }
      >
        ${stock.currentPrice.toFixed(2)}
      </Tile>
      <Tile label="24h High / Low" testId="summary-high-low">
        ${stock.highPrice.toFixed(2)} / ${stock.lowPrice.toFixed(2)}
      </Tile>
    </Stack>
  );
}
