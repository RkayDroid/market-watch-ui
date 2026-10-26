import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { createCsvPriceProvider } from './data/providers/CsvPriceProvider.ts';
import { createLiveApiStockProvider, type HttpClient } from './data/providers/LiveApiStockProvider.ts';
import { createLocalStockProvider, type DetailsLoader } from './data/providers/LocalStockProvider.ts';
import { createStockService } from './services/stockService.ts';
/** The real flat file shipped with the app, bundled as text instead of fetched over HTTP. */
import LOCAL_CSV from '../public/local-data.csv?raw';
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

function buildService() {
  return createStockService(
    {
      file: createLocalStockProvider(createCsvPriceProvider(async () => LOCAL_CSV), loadLocalDetails),
      api: createLiveApiStockProvider({ baseUrl: 'https://api.test/v1', timeoutMs: 100 }, { client: fakeHttp }),
    },
    { formatLabel: (d) => d },
  );
}

async function lookup(symbol: string, source: 'api' | 'file') {
  await userEvent.clear(screen.getByLabelText(/stock symbol/i));
  await userEvent.type(screen.getByLabelText(/stock symbol/i), symbol);
  await userEvent.click(screen.getByLabelText(source === 'file' ? /local flat file/i : /live api/i));
  await userEvent.click(screen.getByRole('button', { name: /find/i }));
}

describe('App (integration with local-data.csv)', () => {
  it('shows V from the flat file with the same figures as the original dataset', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('v', 'file');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('V');
    expect(screen.getByTestId('summary-price')).toHaveTextContent('$282.50');
    expect(screen.getByTestId('summary-high-low')).toHaveTextContent('$282.50 / $274.80');
    expect(screen.getByTestId('summary-change')).toHaveTextContent('2.65%');
    expect(screen.getAllByRole('row')).toHaveLength(25); // header + 24 hours

    // V has no detail-V.json, so only the symbol tile is shown in the detail grid.
    expect(screen.getByTestId('detail-tiles').children).toHaveLength(1);
    expect(screen.queryByTestId('history-unavailable')).not.toBeInTheDocument();

    const chart = screen.getByTestId('price-chart');
    expect(chart).toHaveAttribute('data-direction', 'up');
    expect(within(chart).getAllByTestId('price-point')).toHaveLength(24);
  });

  it('lays out the detail grid, then tiles beside the chart, with the table below', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'file');
    await screen.findByTestId('summary-symbol');

    const details = screen.getByTestId('detail-tiles');
    const row = screen.getByTestId('overview-row');
    const [tilesCol, chartCol] = Array.from(row.children);
    expect(row.children).toHaveLength(2);
    expect(tilesCol).toContainElement(screen.getByTestId('summary-tiles'));
    expect(chartCol).toContainElement(screen.getByTestId('price-chart'));
    expect(details).toContainElement(screen.getByTestId('summary-symbol'));
    expect(details.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const table = screen.getByRole('table');
    expect(row.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row).not.toContainElement(table);
  });

  it('shows the offline detail tiles next to the CSV history for a symbol in both files', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('aapl', 'file');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('AAPL');
    expect(screen.getByTestId('detail-company')).toHaveTextContent('Apple');
    expect(screen.getByTestId('detail-sector')).toHaveTextContent('Technology');
    expect(screen.getByTestId('detail-fullday-price')).toHaveTextContent('$347.73');
    // History-derived figures still come from the CSV.
    expect(screen.getByTestId('summary-price')).toHaveTextContent('$227.50');
    expect(screen.getAllByRole('row')).toHaveLength(25);
  });

  it('shows a not-found error for symbols absent from the file', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('TSLA', 'file');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Symbol not found');
    expect(alert).toHaveTextContent('"TSLA" is not available from this data source.');
    expect(within(alert).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'AAPL', 'GOOG', 'META', 'NFLX', 'V',
    ]);
    expect(screen.queryByTestId('summary-symbol')).not.toBeInTheDocument();
  });

  it('clicking a suggested symbol fills the box and runs the lookup', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('TSLA', 'file');
    await userEvent.click(await screen.findByRole('button', { name: 'GOOG' }));

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('GOOG');
    expect(screen.getByLabelText(/stock symbol/i)).toHaveValue('GOOG');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces previous results with a loading indicator while a new lookup runs', async () => {
    // Gate the file provider so the second lookup stays in flight until we release it.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const local = createLocalStockProvider(createCsvPriceProvider(async () => LOCAL_CSV), loadLocalDetails);
    let calls = 0;
    const gated = {
      async getDetails(symbol: string) {
        if (++calls > 1) await gate;
        return local.getDetails(symbol);
      },
      getPrices: (symbol: string) => local.getPrices!(symbol),
    };
    const service = createStockService(
      { file: gated, api: gated },
      { formatLabel: (d) => d },
    );
    render(<App service={service} lookupOptions={{ minLoadingMs: 0 }} />);

    await lookup('V', 'file');
    await screen.findByTestId('summary-symbol');

    await lookup('META', 'file');
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Fetching results for META…');
    expect(screen.queryByTestId('summary-symbol')).not.toBeInTheDocument();

    release();
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('META');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears a previous error on a successful lookup', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('TSLA', 'file');
    await screen.findByRole('alert');

    await lookup('META', 'file');
    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('META');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the detail tiles from GET /stock/{symbol} and hides the history panels', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('aapl', 'api');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('AAPL');
    const grid = screen.getByTestId('detail-tiles');
    expect(Array.from(grid.children).map((tile) => tile.textContent)).toEqual([
      'SymbolAAPL',
      'CompanyAppleApple Inc.',
      'Full-day Price$347.73USD',
      'SectorTechnology',
      'ExchangeNMSNASDAQ Global Select Market',
      'MarketUS Marketus_market',
      'CurrencyUSDUS Dollar',
      'Languageen-USAmerican English',
    ]);

    // The endpoint carries no historic prices: no chart, table or 24h tiles — just an explanation.
    expect(screen.getByTestId('history-unavailable')).toHaveTextContent(/does not provide historic prices/);
    expect(screen.queryByTestId('overview-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('price-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-price')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
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
