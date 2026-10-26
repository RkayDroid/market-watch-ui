import { Box, Paper, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import type { PerformancePeriod } from '../types/performance.ts';
import type { PriceHistory, StockDetails } from '../types/stock.ts';
import { LAYOUT } from '../layout.ts';
import PeriodSelector from './PeriodSelector.tsx';
import PriceChart from './PriceChart.tsx';
import HourlyPriceTable from './HourlyPriceTable.tsx';
import StockSummaryCards from './StockSummaryCards.tsx';

export interface PastPerformanceSectionProps {
  details: StockDetails;
  /** Price history for the selected period; `null` until a source provides it. */
  history: PriceHistory | null;
  period: PerformancePeriod;
  onPeriodChange: (period: PerformancePeriod) => void;
}

export const PAST_PERFORMANCE_HEADING_ID = 'past-performance-heading';

/**
 * "Past Performance": a period selector above the price chart and hourly table.
 * No data source supplies history yet, so the chart and table render their empty
 * states; the summary tiles beside the chart appear only once history exists.
 */
export default function PastPerformanceSection({
  details,
  history,
  period,
  onPeriodChange,
}: PastPerformanceSectionProps) {
  const hourly = history?.hourly ?? [];

  return (
    <Box
      component="section"
      aria-labelledby={PAST_PERFORMANCE_HEADING_ID}
      data-testid="past-performance"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Paper
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto' }}>
          <HistoryIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" component="h2" id={PAST_PERFORMANCE_HEADING_ID}>
            Past Performance
          </Typography>
        </Box>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </Paper>

      <Box
        data-testid="overview-row"
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'stretch',
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        {history && (
          <Box sx={{ width: { xs: '100%', md: LAYOUT.overviewTiles }, flexShrink: 0 }}>
            <StockSummaryCards history={history} currency={details.currency} />
          </Box>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <PriceChart history={hourly} />
        </Box>
      </Box>

      <HourlyPriceTable history={hourly} />
    </Box>
  );
}
