import axios, { AxiosError, type AxiosResponse } from 'axios';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.tsx';
import LOCAL_CSV from '../public/local-data.csv?raw';
import detailGoog from '../public/data/detail-GOOG.json';

/** Only the transport is replaced; axios' error helpers stay real so 404 handling is exercised. */
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

afterEach(() => vi.restoreAllMocks());

/**
 * Exercises App's real default wiring (CSV provider over HTTP + live API provider),
 * with only the network layer replaced.
 */
describe('App (default service wiring)', () => {
  it('fetches public/local-data.csv and public/data/detail-*.json over HTTP for the flat-file source', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === '/local-data.csv') return { data: LOCAL_CSV };
      if (url === '/data/detail-GOOG.json') return { data: detailGoog, headers: { 'content-type': 'application/json' } };
      throw new Error(`unexpected request: ${url}`);
    });
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.click(screen.getByLabelText(/local flat file/i));
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'goog{enter}');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('GOOG');
    expect(screen.getByTestId('detail-company')).toHaveTextContent('Alphabet');
    expect(screen.getByTestId('summary-price')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('/local-data.csv', expect.objectContaining({ responseType: 'text' }));
    expect(axios.get).toHaveBeenCalledWith('/data/detail-GOOG.json', expect.anything());
  });

  it('falls back to CSV-only data when no detail fixture exists for the symbol', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === '/local-data.csv') return { data: LOCAL_CSV };
      throw new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse);
    });
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.click(screen.getByLabelText(/local flat file/i));
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'nflx{enter}');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('NFLX');
    expect(screen.queryByTestId('detail-company')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-price')).toBeInTheDocument();
  });

  it('calls the configured live API base URL for the API source', async () => {
    vi.mocked(axios.get).mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { isAxiosError: true }));
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'AAPL{enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Live API unreachable');
    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe('https://api.market-watch.example/v1/stock/AAPL');
  });
});
