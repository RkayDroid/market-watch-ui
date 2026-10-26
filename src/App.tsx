import { useCallback, useMemo, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import LookupForm from './components/LookupForm.tsx';
import StockDetailCards from './components/StockDetailCards.tsx';
import PastPerformanceSection from './components/PastPerformanceSection.tsx';
import LoadingIndicator from './components/LoadingIndicator.tsx';
import ErrorBanner from './components/ErrorBanner.tsx';
import { useStockLookup, type UseStockLookupOptions } from './hooks/useStockLookup.ts';
import { createDefaultLocalStockProvider } from './data/providers/LocalStockProvider.ts';
import { createLiveApiStockProvider } from './data/providers/LiveApiStockProvider.ts';
import { getLiveApiConfig } from './config/liveApiConfig.ts';
import { createStockService, type StockService } from './services/stockService.ts';
import type { DataSource } from './types/stock.ts';
import { DEFAULT_PERFORMANCE_PERIOD, type PerformancePeriod } from './types/performance.ts';

export interface AppProps {
  /** Inject a pre-built service (e.g. with fake providers) for testing. */
  service?: StockService;
  /** Override lookup behaviour (e.g. disable the minimum loading time in tests). */
  lookupOptions?: UseStockLookupOptions;
}

function createDefaultStockService(): StockService {
  return createStockService({
    api: createLiveApiStockProvider(getLiveApiConfig()),
    local: createDefaultLocalStockProvider(),
  });
}

export default function App({ service, lookupOptions }: AppProps) {
  const stockService = useMemo(() => service ?? createDefaultStockService(), [service]);
  const { data, loading, pendingSymbol, error, lookup } = useStockLookup(stockService, lookupOptions);

  const [symbol, setSymbol] = useState('');
  const [source, setSource] = useState<DataSource>('api');
  /** Kept across lookups so a chosen window survives searching another symbol. */
  const [period, setPeriod] = useState<PerformancePeriod>(DEFAULT_PERFORMANCE_PERIOD);

  const pickSuggestedSymbol = useCallback(
    (suggested: string) => {
      setSymbol(suggested);
      void lookup(suggested, source);
    },
    [lookup, source],
  );

  return (
    <Container maxWidth={false} sx={{ py: 2, px: { xs: 2, md: 3 } }}>
      <Typography variant="h5" component="h1" sx={{ mb: 1.5 }}>
        Market Watch &amp; Analytics
      </Typography>

      <LookupForm
        symbol={symbol}
        source={source}
        loading={loading}
        onSymbolChange={setSymbol}
        onSourceChange={setSource}
        onSubmit={lookup}
      />

      {error && <ErrorBanner error={error} onPickSymbol={pickSuggestedSymbol} />}

      {loading && <LoadingIndicator symbol={pendingSymbol} />}

      {data && !loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <StockDetailCards details={data.details} />
          <PastPerformanceSection
            details={data.details}
            history={data.history}
            period={period}
            onPeriodChange={setPeriod}
          />
        </Box>
      )}
    </Container>
  );
}
