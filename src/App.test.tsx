import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { createLiveApiStockProvider, type HttpClient } from './data/providers/LiveApiStockProvider.ts';
import { createLocalStockProvider, type JsonLoader } from './data/providers/LocalStockProvider.ts';
import type { StockProvider } from './data/providers/StockProvider.ts';
import { createStockService } from './services/stockService.ts';

/** The offline fixtures (copies of the captured live responses), bundled instead of fetched. */
const FIXTURES = import.meta.glob<unknown>('../public/data/*.json', { eager: true, import: 'default' });
const fixture = (name: string): unknown => FIXTURES[`../public/data/${name}`] ?? null;

/** Resolves `public/data/{path}` from the bundled fixtures. */
const loadLocalJson: JsonLoader = async (path) => fixture(path.replace(/^data\//, ''));

/**
 * Fake HTTP client standing in for the live API: serves AAPL from the captured responses
 * (details, historic and high/low for every period) and 404s everything else.
 */
const liveRequests: string[] = [];
const fakeHttp: HttpClient = {
  get: async (url) => {
    liveRequests.push(url);
    const m = /\/stock\/AAPL(?:\/(historic|highlow)\?period=([A-Z_]+))?$/.exec(url);
    const data = m ? fixture(m[1] ? `${m[1]}-AAPL-${m[2]}.json` : 'detail-AAPL.json') : null;
    if (data) return { data };
    throw new AxiosError('not found', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
  },
};

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

function buildService(local: StockProvider = createLocalStockProvider(loadLocalJson)) {
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

const fetchButton = () => screen.getByRole('button', { name: 'Performance' });

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

  it('shows the past-performance toolbar beneath the tiles, with no chart or table until Performance is clicked', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('META', 'local');
    await screen.findByTestId('summary-symbol');

    const section = screen.getByRole('region', { name: /past performance/i });
    const tiles = screen.getByTestId('detail-tiles');
    expect(tiles.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(section).getByRole('button', { name: 'Performance' })).toBeEnabled();
    expect(within(section).queryByTestId('price-chart-panel')).not.toBeInTheDocument();
    expect(within(section).queryByTestId('price-table-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-tiles')).not.toBeInTheDocument();
  });

  it('changing the period hides the loaded chart and table until Performance is clicked again', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'local');
    await screen.findByTestId('summary-symbol');
    await userEvent.click(fetchButton()); // Day
    await screen.findByTestId('summary-tiles');
    expect(screen.getByText('Price Trend — Past Day')).toBeInTheDocument();

    await userEvent.click(periodRadio('Month'));
    expect(screen.queryByTestId('summary-tiles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('price-chart-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(periodRadio('Month')).toBeChecked();

    // Flipping back does not resurrect the old results either — only Fetch does.
    await userEvent.click(periodRadio('Day'));
    expect(screen.queryByTestId('price-chart-panel')).not.toBeInTheDocument();

    await userEvent.click(fetchButton());
    expect(await screen.findByTestId('summary-tiles')).toBeInTheDocument();
    expect(screen.getByText('Price Trend — Past Day')).toBeInTheDocument();
  });

  it('changing the period also dismisses a previous fetch error', async () => {
    const local = createLocalStockProvider(loadLocalJson);
    const failing: StockProvider = {
      ...local,
      async getHighLow() {
        throw new Error('highlow exploded');
      },
    };
    render(<App service={buildService(failing)} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'local');
    await screen.findByTestId('summary-symbol');
    await userEvent.click(fetchButton());
    await screen.findByRole('alert');

    await userEvent.click(periodRadio('Week'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Fetch calls historic and highlow for the selected period and populates tiles, chart and table (live API)', async () => {
    liveRequests.length = 0;
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'api');
    await screen.findByTestId('summary-symbol');

    await userEvent.click(periodRadio('Week'));
    await userEvent.click(fetchButton());

    expect(await screen.findByTestId('summary-tiles')).toBeInTheDocument();
    expect(liveRequests.slice(1).sort()).toEqual([
      'https://api.test/v1/stock/AAPL/highlow?period=WEEK',
      'https://api.test/v1/stock/AAPL/historic?period=WEEK',
    ]);

    // Tiles: latest price + change over the week (history-AAPL-WEEK), high/low (highlow-AAPL-WEEK).
    expect(screen.getByTestId('summary-price')).toHaveTextContent('$347.73');
    expect(screen.getByTestId('summary-change')).toHaveTextContent('1.4%'); // 342.94 → 347.73
    expect(screen.getByTestId('summary-high')).toHaveTextContent('$351.73');
    expect(screen.getByTestId('summary-low')).toHaveTextContent('$338.70');

    // Chart and table: one point per sample of the 5-day series.
    const chart = screen.getByTestId('price-chart');
    expect(chart).toHaveAttribute('data-direction', 'up');
    expect(within(chart).getAllByTestId('price-point')).toHaveLength(5);
    expect(screen.getByText('Price Trend — Past Week')).toBeInTheDocument();
    expect(screen.getByText('Price Intervals — Past Week (daily)')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(6); // header + 5 days
    expect(rows[1]).toHaveTextContent('2026-10-19'); // formatLabel is identity in tests
    expect(rows[1]).toHaveTextContent('$342.94');
    expect(rows[5]).toHaveTextContent('$347.73');
  });

  it('Fetch works the same against the offline fixtures, for every period', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('GOOG', 'local');
    await screen.findByTestId('summary-symbol');

    await userEvent.click(fetchButton()); // default period: Day
    expect(await screen.findByTestId('summary-tiles')).toBeInTheDocument();
    expect(screen.getByText('Price Intervals — Past Day (hourly)')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(15); // header + 14 hourly samples
    expect(screen.getByTestId('summary-high')).toHaveTextContent('$321.23');

    await userEvent.click(periodRadio('5 Years'));
    await userEvent.click(fetchButton());
    await screen.findByText('Price Intervals — Past 5 Years (monthly)');
    expect(screen.getAllByRole('row')).toHaveLength(62); // header + 61 monthly samples
    expect(screen.getByTestId('summary-low')).toHaveTextContent('$82.67');
    expect(screen.getByTestId('summary-low-secondary')).toHaveTextContent('Nov 3, 2022'); // bare date, no TZ shift
  });

  it('shows a loading state during the fetch and an error inside the section when it fails', async () => {
    const local = createLocalStockProvider(loadLocalJson);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const flaky: StockProvider = {
      ...local,
      async getHighLow(symbol, period) {
        await gate;
        if (period === 'YEAR') throw new Error('highlow exploded');
        return local.getHighLow(symbol, period);
      },
    };
    render(<App service={buildService(flaky)} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'local');
    await screen.findByTestId('summary-symbol');

    await userEvent.click(periodRadio('Year'));
    await userEvent.click(fetchButton());
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Fetching past performance for AAPL…');
    expect(fetchButton()).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    release();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('highlow exploded');
    expect(screen.getByRole('region', { name: /past performance/i })).toContainElement(alert);
    expect(screen.queryByTestId('summary-tiles')).not.toBeInTheDocument();
    expect(fetchButton()).toBeEnabled();
    // The detail tiles above are unaffected.
    expect(screen.getByTestId('summary-symbol')).toHaveTextContent('AAPL');
  });

  it('looking up another symbol clears the previous past-performance results', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'local');
    await screen.findByTestId('summary-symbol');
    await userEvent.click(fetchButton());
    await screen.findByTestId('summary-tiles');

    await lookup('META', 'local');
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('META');
    expect(screen.queryByTestId('summary-tiles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('price-chart-panel')).not.toBeInTheDocument();
  });

  it('fetches from the source the symbol was loaded with, even if the radio changed since', async () => {
    liveRequests.length = 0;
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'local');
    await screen.findByTestId('summary-symbol');

    await userEvent.click(screen.getByLabelText(/live api/i)); // change the radio without looking up
    await userEvent.click(fetchButton());
    await screen.findByTestId('summary-tiles');

    expect(liveRequests).toEqual([]);
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
    const local = createLocalStockProvider(loadLocalJson);
    let calls = 0;
    const gated: StockProvider = {
      ...local,
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
