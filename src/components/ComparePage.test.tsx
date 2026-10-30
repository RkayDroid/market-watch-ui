import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SymbolNotFoundError } from '../data/providers/StockProvider.ts';
import type { StockService } from '../services/stockService.ts';
import type { PastPerformance, StockData } from '../types/stock.ts';
import type { Watchlist } from '../types/watchlist.ts';
import ComparePage from './ComparePage.tsx';

const list: Watchlist = { id: 'w1', name: 'Big tech', symbols: ['AAPL', 'GOOG', 'NOPE'] };

const perf = (symbol: string, period: PastPerformance['period']): PastPerformance => ({
  symbol,
  period,
  interval: '1d',
  latestPrice: 100,
  changePercent: 2,
  points: [{ label: 'd1', open: 1, high: 2, low: 0.5, price: 100, trend: 'up' }],
  high: { price: 2, occurredAt: 'd1' },
  low: { price: 0.5, occurredAt: 'd1' },
});

function fakeService(): StockService {
  const notFound = (symbol: string) => {
    if (symbol === 'NOPE') throw new SymbolNotFoundError(symbol, { source: 'the offline data' });
  };
  return {
    lookup: vi.fn(async (symbol): Promise<StockData> => {
      notFound(symbol);
      return { symbol, details: { symbol, displayName: `${symbol} Inc.`, currency: 'USD' } };
    }),
    performance: vi.fn(async (symbol, period) => {
      notFound(symbol);
      return perf(symbol, period);
    }),
  };
}

function renderPage(service = fakeService()) {
  const onBack = vi.fn();
  render(
    <ComparePage
      watchlist={list}
      service={service}
      source="local"
      today="2026-03-01"
      onBack={onBack}
      lookupOptions={{ minLoadingMs: 0 }}
    />,
  );
  return { service, onBack };
}

describe('ComparePage', () => {
  it('shows the watchlist name and symbols, the Compare toolbar, and a hint until Compare is clicked', () => {
    const { onBack } = renderPage();
    const main = screen.getByRole('main', { name: 'Compare Big tech' });
    expect(within(main).getByRole('heading', { level: 2 })).toHaveTextContent('Big tech');
    expect(within(main).getByTestId('compare-caption')).toHaveTextContent('3 symbols: AAPL, GOOG, NOPE');

    const toolbar = within(main).getByTestId('compare-toolbar');
    expect(within(toolbar).getByTestId('period-selector')).toBeInTheDocument();
    expect(within(toolbar).getByLabelText(/reference date/i)).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Compare' })).toBeEnabled();
    expect(within(toolbar).queryByRole('button', { name: 'Performance' })).not.toBeInTheDocument();

    expect(within(main).getByTestId('compare-hint')).toBeInTheDocument();
    expect(within(main).queryByTestId('compare-grid')).not.toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('Compare fetches every symbol for the chosen period and shows a card per symbol, errors included', async () => {
    const { service } = renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'Month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));

    const grid = await screen.findByTestId('compare-grid');
    const cards = within(grid).getAllByRole('article');
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Comparison for AAPL',
      'Comparison for GOOG',
      'Comparison for NOPE',
    ]);
    expect(within(cards[0]).getByTestId('summary-price')).toHaveTextContent('$100.00');
    expect(within(cards[0]).getByTestId('price-chart-panel')).toHaveTextContent('Past Month');
    expect(within(cards[2]).getByRole('alert')).toHaveTextContent('Symbol not found');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    expect(service.performance).toHaveBeenCalledTimes(3);
    expect(service.performance).toHaveBeenCalledWith('AAPL', 'MONTH', 'local', undefined);
    expect(service.lookup).toHaveBeenCalledWith('AAPL', 'local');
  });

  it('changing the period hides the results until Compare is clicked again', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await screen.findByTestId('compare-grid');

    await userEvent.click(screen.getByRole('radio', { name: 'Year' }));
    expect(screen.queryByTestId('compare-grid')).not.toBeInTheDocument();
    expect(screen.getByTestId('compare-hint')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(await screen.findByTestId('compare-grid')).toBeInTheDocument();
    expect(within(screen.getByTestId('compare-AAPL')).getByTestId('price-chart-panel')).toHaveTextContent('Past Year');
  });

  it('goes back to the watchlists', async () => {
    const { onBack } = renderPage();
    await userEvent.click(screen.getByTestId('compare-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
