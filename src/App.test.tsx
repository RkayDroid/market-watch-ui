import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { createLiveApiStockProvider, type HttpClient } from './data/providers/LiveApiStockProvider.ts';
import { createLocalStockProvider, type DetailsLoader } from './data/providers/LocalStockProvider.ts';
import type { StockProvider } from './data/providers/StockProvider.ts';
import { createStockService } from './services/stockService.ts';
/** A captured live response, served by the fake live API below. */
import detailAapl from '../json/detail-AAPL.json';

/** The offline detail fixtures (copies of the captured live responses), bundled instead of fetched. */
const LOCAL_DETAILS = import.meta.glob<unknown>('../public/data/detail-*.json', { eager: true, import: 'default' });

/** Fake HTTP client standing in for the live API: knows AAPL, 404s everything else. */
const fakeHttp: HttpClient = {
  get: async (url) => {
    if (url.endsWith('/stock/AAPL')) return { data: detailAapl };
    throw new AxiosError('not found', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
  },
};

/** Resolves `public/data/detail-{SYMBOL}.json` from the bundled fixtures. */
const loadLocalDetails: DetailsLoader = async (symbol) => LOCAL_DETAILS[`../public/data/detail-${symbol}.json`] ?? null;

const EXPECTED_AAPL_TILES = [
  'SymbolAAPL',
  'CompanyAppleApple Inc.',
  'Full-day Price$347.73USD',
  'SectorTechnology',
  'ExchangeNMSNASDAQ Global Select Market',
  'MarketUS Marketus_market',
  'CurrencyUSDUS Dollar',
  'Languageen-USAmerican English',
];

function buildService(local: StockProvider = createLocalStockProvider(loadLocalDetails)) {
  return createStockService(
    {
      local,
      api: createLiveApiStockProvider({ baseUrl: 'https://api.test/v1', timeoutMs: 100 }, { client: fakeHttp }),
    },
    { formatLabel: (d) => d },
  );
}

async function lookup(symbol: string, source: 'api' | 'local') {
  await userEvent.clear(screen.getByLabelText(/stock symbol/i));
  await userEvent.type(screen.getByLabelText(/stock symbol/i), symbol);
  await userEvent.click(screen.getByLabelText(source === 'local' ? /local json/i : /live api/i));
  await userEvent.click(screen.getByRole('button', { name: /find/i }));
}

const periodRadio = (label: string | RegExp) =>
  within(screen.getByTestId('period-selector')).getByRole('radio', { name: label });

describe('App', () => {
  it('renders the detail tiles from GET /stock/{symbol} for the live API source', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('aapl', 'api');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('AAPL');
    const grid = screen.getByTestId('detail-tiles');
    expect(Array.from(grid.children).map((tile) => tile.textContent)).toEqual(EXPECTED_AAPL_TILES);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the same tiles from the offline JSON fixture', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('aapl', 'local');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('AAPL');
    const grid = screen.getByTestId('detail-tiles');
    expect(Array.from(grid.children).map((tile) => tile.textContent)).toEqual(EXPECTED_AAPL_TILES);
  });

  it('shows a "Past Performance" section beneath the tiles with an unpopulated chart and table', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('META', 'local');
    await screen.findByTestId('summary-symbol');

    const section = screen.getByRole('region', { name: /past performance/i });
    const tiles = screen.getByTestId('detail-tiles');
    expect(tiles.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // No source provides history yet: the chart and table are present but empty.
    expect(within(section).getByTestId('price-chart-empty')).toBeInTheDocument();
    expect(within(section).queryByTestId('price-chart')).not.toBeInTheDocument();
    expect(within(section).getAllByRole('row')).toHaveLength(1); // header only
    expect(screen.queryByTestId('summary-tiles')).not.toBeInTheDocument();
  });

  it('offers the six performance periods with Day selected by default', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'api');
    await screen.findByTestId('summary-symbol');

    const radios = within(screen.getByTestId('period-selector')).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['DAY', 'WEEK', 'MONTH', 'HALF_YEAR', 'YEAR', 'FIVE_YEAR']);
    expect(periodRadio('Day')).toBeChecked();
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  });

  it('keeps the chosen period when another symbol is looked up', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'api');
    await screen.findByTestId('summary-symbol');

    await userEvent.click(periodRadio('5 Years'));
    expect(periodRadio('5 Years')).toBeChecked();
    expect(periodRadio('Day')).not.toBeChecked();

    await lookup('GOOG', 'local');
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('GOOG');
    expect(periodRadio('5 Years')).toBeChecked();
  });

  it('shows a not-found error with offline suggestions for symbols without a fixture', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('TSLA', 'local');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Symbol not found');
    expect(alert).toHaveTextContent('"TSLA" is not available from this data source.');
    expect(within(alert).getAllByRole('button').map((b) => b.textContent)).toEqual(['AAPL', 'GOOG', 'META']);
    expect(screen.queryByTestId('summary-symbol')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /past performance/i })).not.toBeInTheDocument();
  });

  it('clicking a suggested symbol fills the box and runs the lookup', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('TSLA', 'local');
    await userEvent.click(await screen.findByRole('button', { name: 'GOOG' }));

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('GOOG');
    expect(screen.getByLabelText(/stock symbol/i)).toHaveValue('GOOG');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces previous results with a loading indicator while a new lookup runs', async () => {
    // Gate the local provider so the second lookup stays in flight until we release it.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const local = createLocalStockProvider(loadLocalDetails);
    let calls = 0;
    const gated: StockProvider = {
      async getDetails(symbol) {
        if (++calls > 1) await gate;
        return local.getDetails(symbol);
      },
    };
    render(<App service={buildService(gated)} lookupOptions={{ minLoadingMs: 0 }} />);

    await lookup('AAPL', 'local');
    await screen.findByTestId('summary-symbol');

    await lookup('META', 'local');
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Fetching results for META…');
    expect(screen.queryByTestId('summary-symbol')).not.toBeInTheDocument();

    release();
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('META');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears a previous error on a successful lookup', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('TSLA', 'local');
    await screen.findByRole('alert');

    await lookup('META', 'local');
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('META');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a not-found error when the live API returns 404', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('NOPE', 'api');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Symbol not found');
    expect(alert).toHaveTextContent('"NOPE" is not available from this data source.');
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  });
});
