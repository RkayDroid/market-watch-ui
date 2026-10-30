import { useCallback, useMemo, useState } from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import AppNav from './components/AppNav.tsx';
import ComparePage from './components/ComparePage.tsx';
import { DARK_TOOLBAR_SX } from './components/darkToolbar.ts';
import SourceToggle from './components/SourceToggle.tsx';
import WatchlistPage from './components/WatchlistPage.tsx';
import LookupForm from './components/LookupForm.tsx';
import StockDetailCards from './components/StockDetailCards.tsx';
import PastPerformanceSection from './components/PastPerformanceSection.tsx';
import LoadingIndicator from './components/LoadingIndicator.tsx';
import ErrorBanner from './components/ErrorBanner.tsx';
import { useStockLookup, type UseStockLookupOptions } from './hooks/useStockLookup.ts';
import { usePerformanceLookup } from './hooks/usePerformanceLookup.ts';
import { useWatchlists } from './hooks/useWatchlists.ts';
import { createDefaultLocalStockProvider } from './data/providers/LocalStockProvider.ts';
import { createLiveApiStockProvider } from './data/providers/LiveApiStockProvider.ts';
import { createDefaultLocalWatchlistProvider } from './data/providers/LocalWatchlistProvider.ts';
import { createLiveApiWatchlistProvider } from './data/providers/LiveApiWatchlistProvider.ts';
import type { WatchlistProvider } from './data/providers/WatchlistProvider.ts';
import { getLiveApiConfig } from './config/liveApiConfig.ts';
import { QUICK_SYMBOLS } from './config/quickLinks.ts';
import { createStockService, type StockService } from './services/stockService.ts';
import type { DataSource } from './types/stock.ts';
import { DEFAULT_PERFORMANCE_PERIOD, type PerformancePeriod } from './types/performance.ts';
import { DEFAULT_APP_VIEW, menuViewOf, type AppView, type ViewState } from './types/view.ts';
import { todayIsoDate } from './utils/date.ts';

export interface AppProps {
  /** Inject a pre-built service (e.g. with fake providers) for testing. */
  service?: StockService;
  /** Override lookup behaviour (e.g. disable the minimum loading time in tests). */
  lookupOptions?: UseStockLookupOptions;
  /** Today's date (`YYYY-MM-DD`): the upper bound of the reference date. Injectable for tests. */
  today?: string;
  /** Watchlist storage per data source; defaults to the watchlist API / `localStorage`. Injectable for tests. */
  watchlistProviders?: WatchlistProviderRegistry;
}

export type WatchlistProviderRegistry = Record<DataSource, WatchlistProvider>;

/** What the Watchlist view says about where its lists live, per source. */
const WATCHLIST_SOURCE_CAPTIONS: Record<DataSource, string> = {
  api: 'Saved on the server.',
  local: 'Saved in this browser (offline mode).',
};

function createDefaultStockService(): StockService {
  return createStockService({
    api: createLiveApiStockProvider(getLiveApiConfig()),
    local: createDefaultLocalStockProvider(),
  });
}

function createDefaultWatchlistProviders(): WatchlistProviderRegistry {
  return {
    api: createLiveApiWatchlistProvider(getLiveApiConfig()),
    local: createDefaultLocalWatchlistProvider(),
  };
}

export default function App({ service, lookupOptions, today = todayIsoDate(), watchlistProviders }: AppProps) {
  const stockService = useMemo(() => service ?? createDefaultStockService(), [service]);
  const providers = useMemo(() => watchlistProviders ?? createDefaultWatchlistProviders(), [watchlistProviders]);
  /** App-wide data source, switched from the header; applies to stock lookups and watchlists alike. */
  const [source, setSource] = useState<DataSource>('api');
  const [view, setView] = useState<ViewState>({ kind: DEFAULT_APP_VIEW });
  const showView = useCallback((next: AppView) => setView({ kind: next }), []);
  const { data, loading, pendingSymbol, error, lookup } = useStockLookup(stockService, lookupOptions);
  const { fetch: fetchPerf, reset: resetPerf, ...performance } = usePerformanceLookup(stockService, lookupOptions);
  const {
    watchlists,
    loading: watchlistsLoading,
    error: watchlistsError,
    create: createWatchlist,
    update: updateWatchlist,
    remove: removeWatchlist,
  } = useWatchlists(providers[source], { enabled: view.kind !== 'analysis' });

  /** The list being compared; gone (deleted, or not in the other source) → back to the watchlists. */
  const comparing = view.kind === 'compare' ? watchlists.find((list) => list.id === view.watchlistId) : undefined;
  const showWatchlists = useCallback(() => setView({ kind: 'watchlist' }), []);
  const compareWatchlist = useCallback((id: string) => setView({ kind: 'compare', watchlistId: id }), []);

  const [symbol, setSymbol] = useState('');
  /** Kept across lookups so a chosen window survives searching another symbol. */
  const [period, setPeriod] = useState<PerformancePeriod>(DEFAULT_PERFORMANCE_PERIOD);
  /** Optional reference date the window is anchored on; `''` until one is picked (→ no query parameter). */
  const [referenceDate, setReferenceDate] = useState('');

  /** A new symbol lookup invalidates any past-performance results shown for the previous one. */
  const startLookup = useCallback(
    (nextSymbol: string) => {
      resetPerf();
      void lookup(nextSymbol, source);
    },
    [lookup, resetPerf, source],
  );

  const pickSuggestedSymbol = useCallback(
    (suggested: string) => {
      setSymbol(suggested);
      startLookup(suggested);
    },
    [startLookup],
  );

  /** A symbol clicked in a watchlist is looked up on the Analysis view. */
  const lookupFromWatchlist = useCallback(
    (picked: string) => {
      setView({ kind: 'analysis' });
      pickSuggestedSymbol(picked);
    },
    [pickSuggestedSymbol],
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

  /**
   * Historic data always comes from the source the Offline mode switch currently says — never
   * from the one the symbol happened to be looked up with — so the switch is authoritative.
   */
  const fetchPerformance = useCallback(() => {
    if (data) void fetchPerf(data.symbol, period, source, referenceDate || undefined);
  }, [data, period, source, referenceDate, fetchPerf]);

  /** Loaded past-performance results belong to the source they came from; a switch hides them. */
  const changeSource = useCallback(
    (next: DataSource) => {
      setSource(next);
      resetPerf();
    },
    [resetPerf],
  );

  return (
    <Container maxWidth={false} sx={{ py: 2, px: { xs: 2, md: 3 } }}>
      <Paper data-testid="app-header" sx={{ ...DARK_TOOLBAR_SX, mb: 1.5 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'inherit', flexGrow: 1 }}>
          Market Watch &amp; Analytics
        </Typography>
        <AppNav current={menuViewOf(view)} onChange={showView} />
        <SourceToggle source={source} onChange={changeSource} contrast />
      </Paper>

      {view.kind === 'compare' && comparing ? (
        <ComparePage
          key={`${source}:${comparing.id}`}
          watchlist={comparing}
          service={stockService}
          source={source}
          today={today}
          onBack={showWatchlists}
          lookupOptions={lookupOptions}
        />
      ) : view.kind !== 'analysis' ? (
        <WatchlistPage
          watchlists={watchlists}
          loading={watchlistsLoading}
          error={watchlistsError}
          sourceCaption={WATCHLIST_SOURCE_CAPTIONS[source]}
          onPickSymbol={lookupFromWatchlist}
          onCompare={compareWatchlist}
          onCreateWatchlist={createWatchlist}
          onUpdateWatchlist={updateWatchlist}
          onRemoveWatchlist={removeWatchlist}
          suggestions={QUICK_SYMBOLS}
        />
      ) : (
        // Lookup state lives above this switch, so results survive a detour to the Watchlist view.
        <Box component="main" aria-label="Analysis" data-testid="analysis-page">
          <LookupForm symbol={symbol} loading={loading} onSymbolChange={setSymbol} onSubmit={startLookup} />

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
        </Box>
      )}
    </Container>
  );
}
