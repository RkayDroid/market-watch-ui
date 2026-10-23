import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { createCsvPriceProvider } from './data/providers/CsvPriceProvider.ts';
import { createLiveApiPriceProvider, type HttpClient } from './data/providers/LiveApiPriceProvider.ts';
import { createStockService } from './services/stockService.ts';
/** The real flat file shipped with the app, bundled as text instead of fetched over HTTP. */
import LOCAL_CSV from '../public/local-data.csv?raw';

/** Fake HTTP client standing in for the (not yet available) live API. */
const fakeHttp: HttpClient = {
  get: async (url) => {
    if (url.includes('/prices/ANY?')) {
      return {
        data: {
          symbol: 'ANY',
          prices: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(Date.UTC(2026, 9, 21, 15 + i)).toISOString(),
            price: 100 + i,
          })),
        },
      };
    }
    throw new AxiosError('not found', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
  },
};

function buildService() {
  return createStockService(
    {
      file: createCsvPriceProvider(async () => LOCAL_CSV),
      api: createLiveApiPriceProvider({ baseUrl: 'https://api.test/v1', timeoutMs: 100 }, { client: fakeHttp }),
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

    const chart = screen.getByTestId('price-chart');
    expect(chart).toHaveAttribute('data-direction', 'up');
    expect(within(chart).getAllByTestId('price-point')).toHaveLength(24);
  });

  it('lays out tiles beside the chart, with the table below', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('AAPL', 'file');
    await screen.findByTestId('summary-symbol');

    const row = screen.getByTestId('overview-row');
    const [tilesCol, chartCol] = Array.from(row.children);
    expect(row.children).toHaveLength(2);
    expect(tilesCol).toContainElement(screen.getByTestId('summary-tiles'));
    expect(chartCol).toContainElement(screen.getByTestId('price-chart'));

    const table = screen.getByRole('table');
    expect(row.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row).not.toContainElement(table);
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
    const csv = createCsvPriceProvider(async () => LOCAL_CSV);
    let calls = 0;
    const gated = {
      async getPrices(symbol: string) {
        if (++calls > 1) await gate;
        return csv.getPrices(symbol);
      },
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

  it('renders data returned by the live API source', async () => {
    render(<App service={buildService()} lookupOptions={{ minLoadingMs: 0 }} />);
    await lookup('any', 'api');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('ANY');
    expect(screen.getByTestId('summary-price')).toHaveTextContent('$123.00');
    expect(screen.getByTestId('summary-change')).toHaveTextContent('23%');
    expect(screen.getAllByRole('row')).toHaveLength(25);
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
