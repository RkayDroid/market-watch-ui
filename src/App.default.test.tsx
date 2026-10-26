import axios, { AxiosError, type AxiosResponse } from 'axios';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.tsx';
import detailGoog from '../public/data/detail-GOOG.json';

/** Only the transport is replaced; axios' error helpers stay real so 404 handling is exercised. */
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return { ...actual, default: { ...actual.default, get: vi.fn() } };
});

afterEach(() => vi.restoreAllMocks());

/**
 * Exercises App's real default wiring (offline JSON provider over HTTP + live API provider),
 * with only the network layer replaced.
 */
describe('App (default service wiring)', () => {
  it('fetches public/data/detail-*.json over HTTP for the local source', async () => {
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
      if (url === '/data/detail-GOOG.json') return { data: detailGoog, headers: { 'content-type': 'application/json' } };
      throw new Error(`unexpected request: ${url}`);
    });
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.click(screen.getByLabelText(/local json/i));
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'goog{enter}');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('GOOG');
    expect(screen.getByTestId('detail-company')).toHaveTextContent('Alphabet');
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith('/data/detail-GOOG.json', expect.anything());
  });

  it('reports a missing fixture as "not found" with the offline symbols as suggestions', async () => {
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError('nf', undefined, undefined, undefined, { status: 404 } as AxiosResponse),
    );
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.click(screen.getByLabelText(/local json/i));
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'nflx{enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Symbol not found');
    expect(alert).toHaveTextContent('AAPLGOOGMETA');
  });

  it('calls the configured live API base URL for the API source', async () => {
    vi.mocked(axios.get).mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { isAxiosError: true }));
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'AAPL{enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Live API unreachable');
    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe('https://api.market-watch.example/v1/stock/AAPL');
  });
});
