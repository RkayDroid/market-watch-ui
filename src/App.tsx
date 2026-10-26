import { useCallback, useMemo, useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import LookupForm from './components/LookupForm.tsx';
import StockSummaryCards from './components/StockSummaryCards.tsx';
import StockDetailCards from './components/StockDetailCards.tsx';
import HistoryUnavailableNotice from './components/HistoryUnavailableNotice.tsx';
import HourlyPriceTable from './components/HourlyPriceTable.tsx';
import PriceChart from './components/PriceChart.tsx';
import LoadingIndicator from './components/LoadingIndicator.tsx';
import ErrorBanner from './components/ErrorBanner.tsx';
import { useStockLookup, type UseStockLookupOptions } from './hooks/useStockLookup.ts';
import { createDefaultLocalStockProvider } from './data/providers/LocalStockProvider.ts';
import { createLiveApiStockProvider } from './data/providers/LiveApiStockProvider.ts';
import { getLiveApiConfig } from './config/liveApiConfig.ts';
import { createStockService, type StockService } from './services/stockService.ts';
import type { DataSource } from './types/stock.ts';
import { LAYOUT } from './layout.ts';

export interface AppProps {
  /** Inject a pre-built service (e.g. with fake providers) for testing. */
  service?: StockService;
  /** Override lookup behaviour (e.g. disable the minimum loading time in tests). */
  lookupOptions?: UseStockLookupOptions;
}

function createDefaultStockService(): StockService {
  return createStockService({
    api: createLiveApiStockProvider(getLiveApiConfig()),
    file: createDefaultLocalStockProvider(),
  });
}

export default function App({ service, lookupOptions }: AppProps) {
  const stockService = useMemo(() => service ?? createDefaultStockService(), [service]);
  const { data, loading, pendingSymbol, error, lookup } = useStockLookup(stockService, lookupOptions);

  const [symbol, setSymbol] = useState('');
  const [source, setSource] = useState<DataSource>('api');

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

          {data.history ? (
            <>
              <Box
                data-testid="overview-row"
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'stretch',
                  flexDirection: { xs: 'column', md: 'row' },
                }}
              >
                <Box sx={{ width: { xs: '100%', md: LAYOUT.overviewTiles }, flexShrink: 0 }}>
                  <StockSummaryCards history={data.history} currency={data.details.currency} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <PriceChart history={data.history.hourly} />
                </Box>
              </Box>

              <HourlyPriceTable history={data.history.hourly} />
            </>
          ) : (
            <HistoryUnavailableNotice />
          )}
        </Box>
      )}
    </Container>
  );
}
