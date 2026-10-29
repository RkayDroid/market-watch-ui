import { useCallback, useMemo, useState } from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import { DARK_TOOLBAR_SX } from './components/darkToolbar.ts';
import LookupForm from './components/LookupForm.tsx';
import StockDetailCards from './components/StockDetailCards.tsx';
import PastPerformanceSection from './components/PastPerformanceSection.tsx';
import LoadingIndicator from './components/LoadingIndicator.tsx';
import ErrorBanner from './components/ErrorBanner.tsx';
import { useStockLookup, type UseStockLookupOptions } from './hooks/useStockLookup.ts';
import { usePerformanceLookup } from './hooks/usePerformanceLookup.ts';
import { createDefaultLocalStockProvider } from './data/providers/LocalStockProvider.ts';
import { createLiveApiStockProvider } from './data/providers/LiveApiStockProvider.ts';
import { getLiveApiConfig } from './config/liveApiConfig.ts';
import { createStockService, type StockService } from './services/stockService.ts';
import type { DataSource } from './types/stock.ts';
import { DEFAULT_PERFORMANCE_PERIOD, type PerformancePeriod } from './types/performance.ts';
import { todayIsoDate } from './utils/date.ts';

export interface AppProps {
  /** Inject a pre-built service (e.g. with fake providers) for testing. */
  service?: StockService;
  /** Override lookup behaviour (e.g. disable the minimum loading time in tests). */
  lookupOptions?: UseStockLookupOptions;
  /** Today's date (`YYYY-MM-DD`): the upper bound of the reference date. Injectable for tests. */
  today?: string;
}

function createDefaultStockService(): StockService {
  return createStockService({
    api: createLiveApiStockProvider(getLiveApiConfig()),
    local: createDefaultLocalStockProvider(),
  });
}

export default function App({ service, lookupOptions, today = todayIsoDate() }: AppProps) {
  const stockService = useMemo(() => service ?? createDefaultStockService(), [service]);
  const { data, source: loadedSource, loading, pendingSymbol, error, lookup } = useStockLookup(
    stockService,
    lookupOptions,
  );
  const { fetch: fetchPerf, reset: resetPerf, ...performance } = usePerformanceLookup(stockService, lookupOptions);

  const [symbol, setSymbol] = useState('');
  const [source, setSource] = useState<DataSource>('api');
  /** Kept across lookups so a chosen window survives searching another symbol. */
  const [period, setPeriod] = useState<PerformancePeriod>(DEFAULT_PERFORMANCE_PERIOD);
  /** Optional reference date the window is anchored on; `''` until one is picked (→ no query parameter). */
  const [referenceDate, setReferenceDate] = useState('');

  /** A new symbol lookup invalidates any past-performance results shown for the previous one. */
  const startLookup = useCallback(
    (nextSymbol: string, nextSource: DataSource) => {
      resetPerf();
      void lookup(nextSymbol, nextSource);
    },
    [lookup, resetPerf],
  );

  const pickSuggestedSymbol = useCallback(
    (suggested: string) => {
      setSymbol(suggested);
      startLookup(suggested, source);
    },
    [startLookup, source],
  );

  /** Results belong to the period they were fetched for; a new choice hides them until the next Fetch. */
  const changePeriod = useCallback(
    (next: PerformancePeriod) => {
      setPeriod(next);
      resetPerf();
    },
    [resetPerf],
  );

  /** Like the period: results belong to the reference date they were fetched for. */
  const changeReferenceDate = useCallback(
    (next: string) => {
      setReferenceDate(next);
      resetPerf();
    },
    [resetPerf],
  );

  const fetchPerformance = useCallback(() => {
    if (data && loadedSource) void fetchPerf(data.symbol, period, loadedSource, referenceDate || undefined);
  }, [data, loadedSource, period, referenceDate, fetchPerf]);

  return (
    <Container maxWidth={false} sx={{ py: 2, px: { xs: 2, md: 3 } }}>
      <Paper data-testid="app-header" sx={{ ...DARK_TOOLBAR_SX, mb: 1.5 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'inherit' }}>
          Market Watch &amp; Analytics
        </Typography>
      </Paper>

      <LookupForm
        symbol={symbol}
        source={source}
        loading={loading}
        onSymbolChange={setSymbol}
        onSourceChange={setSource}
        onSubmit={startLookup}
      />

      {error && <ErrorBanner error={error} onPickSymbol={pickSuggestedSymbol} />}

      {loading && <LoadingIndicator symbol={pendingSymbol} />}

      {data && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <StockDetailCards details={data.details} />
          <PastPerformanceSection
            details={data.details}
            referenceDate={referenceDate}
            onReferenceDateChange={changeReferenceDate}
            maxReferenceDate={today}
            period={period}
            onPeriodChange={changePeriod}
            onFetch={fetchPerformance}
            performance={performance.data}
            loading={performance.loading}
            pendingPeriod={performance.pendingPeriod}
            error={performance.error}
          />
        </Box>
      )}
    </Container>
  );
}
