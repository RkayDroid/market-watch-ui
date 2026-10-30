import { useCallback, useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { useWatchlistComparison, type UseWatchlistComparisonOptions } from '../hooks/useWatchlistComparison.ts';
import type { StockService } from '../services/stockService.ts';
import { DEFAULT_PERFORMANCE_PERIOD, performancePeriodLabel, type PerformancePeriod } from '../types/performance.ts';
import type { DataSource } from '../types/stock.ts';
import type { Watchlist } from '../types/watchlist.ts';
import CompareCard from './CompareCard.tsx';
import LoadingIndicator from './LoadingIndicator.tsx';
import PerformanceToolbar from './PerformanceToolbar.tsx';
import SectionTitle from './SectionTitle.tsx';

export interface ComparePageProps {
  watchlist: Watchlist;
  service: StockService;
  /** App-wide data source. */
  source: DataSource;
  /** Today's date (`YYYY-MM-DD`): the upper bound of the reference date. */
  today: string;
  onBack: () => void;
  lookupOptions?: UseWatchlistComparisonOptions;
}

/**
 * The comparison view of one watchlist: its name, the reference-date / period toolbar with a
 * "Compare" button, and — once clicked — a two-column grid with one {@link CompareCard} per
 * symbol. Like the Analysis view, results belong to the period and date they were fetched
 * for: changing either hides them until Compare is clicked again.
 */
export default function ComparePage({ watchlist, service, source, today, onBack, lookupOptions }: ComparePageProps) {
  const { results, loading, pendingPeriod, compare, reset } = useWatchlistComparison(service, lookupOptions);
  const [period, setPeriod] = useState<PerformancePeriod>(DEFAULT_PERFORMANCE_PERIOD);
  const [referenceDate, setReferenceDate] = useState('');

  const changePeriod = useCallback(
    (next: PerformancePeriod) => {
      setPeriod(next);
      reset();
    },
    [reset],
  );

  const changeReferenceDate = useCallback(
    (next: string) => {
      setReferenceDate(next);
      reset();
    },
    [reset],
  );

  const runCompare = useCallback(
    () => void compare(watchlist.symbols, period, source, referenceDate || undefined),
    [compare, watchlist.symbols, period, source, referenceDate],
  );

  const count = watchlist.symbols.length;

  return (
    <Box
      component="main"
      aria-label={`Compare ${watchlist.name}`}
      data-testid="compare-page"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Box>
        <SectionTitle
          icon={<ShowChartIcon fontSize="small" color="secondary" />}
          action={
            <Button
              size="small"
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={onBack}
              data-testid="compare-back"
            >
              Watchlists
            </Button>
          }
        >
          {watchlist.name}
        </SectionTitle>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }} data-testid="compare-caption">
          {count} {count === 1 ? 'symbol' : 'symbols'}: {watchlist.symbols.join(', ')}
        </Typography>
      </Box>

      <Paper
        component="section"
        aria-label="Comparison"
        sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <PerformanceToolbar
          referenceDate={referenceDate}
          onReferenceDateChange={changeReferenceDate}
          maxReferenceDate={today}
          period={period}
          onPeriodChange={changePeriod}
          onAction={runCompare}
          actionLabel="Compare"
          actionIcon={<CompareArrowsIcon />}
          loading={loading}
          testId="compare-toolbar"
          actionTestId="run-compare"
        />

        {loading && (
          <Box sx={{ p: 2, pt: 0 }}>
            <LoadingIndicator
              symbol={watchlist.name}
              subject="comparison"
              caption={`Retrieving the past ${
                pendingPeriod ? performancePeriodLabel(pendingPeriod).toLowerCase() : 'period'
              } for ${count} ${count === 1 ? 'symbol' : 'symbols'}`}
              py={3}
            />
          </Box>
        )}

        {!loading && !results && (
          <Typography variant="body2" color="textSecondary" sx={{ p: 2 }} data-testid="compare-hint">
            Pick a period (and optionally a reference date), then click Compare to see the latest price, high, low and
            price trend of every symbol side by side.
          </Typography>
        )}

        {results && !loading && (
          <Box
            data-testid="compare-grid"
            sx={{ display: 'grid', gap: 2, p: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}
          >
            {results.map((comparison) => (
              <CompareCard key={comparison.symbol} comparison={comparison} />
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
