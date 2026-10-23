import axios from 'axios';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.tsx';
import LOCAL_CSV from '../public/local-data.csv?raw';

vi.mock('axios');

afterEach(() => vi.restoreAllMocks());

/**
 * Exercises App's real default wiring (CSV provider over HTTP + live API provider),
 * with only the network layer replaced.
 */
describe('App (default service wiring)', () => {
  it('fetches public/local-data.csv over HTTP for the flat-file source', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: LOCAL_CSV });
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.click(screen.getByLabelText(/local flat file/i));
    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'goog{enter}');

    expect(await screen.findByTestId('summary-symbol')).toHaveTextContent('GOOG');
    expect(axios.get).toHaveBeenCalledWith('/local-data.csv', expect.objectContaining({ responseType: 'text' }));
  });

  it('calls the configured live API base URL for the API source', async () => {
    vi.mocked(axios.get).mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { isAxiosError: true }));
    render(<App lookupOptions={{ minLoadingMs: 0 }} />);

    await userEvent.type(screen.getByLabelText(/stock symbol/i), 'AAPL{enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Live API unreachable');
    expect(vi.mocked(axios.get).mock.calls[0][0]).toMatch(/^https:\/\/api\.market-watch\.example\/v1\/prices\/AAPL\?/);
  });
});
