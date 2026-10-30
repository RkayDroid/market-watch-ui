import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PastPerformance } from '../types/stock.ts';
import CompareCard from './CompareCard.tsx';

const performance: PastPerformance = {
  symbol: 'AAPL',
  period: 'WEEK',
  interval: '1d',
  referenceDate: '2026-02-02',
  latestPrice: 347.73,
  changePercent: 1.4,
  points: [
    { label: 'Oct 19', open: 342, high: 343, low: 341, price: 342.94, trend: 'neutral' },
    { label: 'Oct 20', open: 342, high: 352, low: 338.7, price: 347.73, trend: 'up' },
  ],
  high: { price: 351.73, occurredAt: 'Oct 20' },
  low: { price: 338.7, occurredAt: 'Oct 20' },
};

describe('CompareCard', () => {
  it('shows symbol, company, the three summary tiles in a row and a chart — and no table', () => {
    render(
      <CompareCard
        comparison={{ symbol: 'AAPL', details: { symbol: 'AAPL', displayName: 'Apple', currency: 'USD' }, performance }}
      />,
    );
    const card = screen.getByRole('article', { name: 'Comparison for AAPL' });
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('AAPL');
    expect(card).toHaveTextContent('Apple');

    const tiles = within(card).getByTestId('summary-tiles');
    expect(tiles).toHaveClass('MuiStack-root');
    expect(getComputedStyle(tiles).flexDirection).toBe('row');
    expect(within(card).getByTestId('summary-price')).toHaveTextContent('$347.73');
    expect(within(card).getByTestId('summary-high')).toHaveTextContent('$351.73');
    expect(within(card).getByTestId('summary-low')).toHaveTextContent('$338.70');

    expect(within(card).getByTestId('price-chart-panel')).toHaveTextContent('Price Trend — Past Week to 2026-02-02');
    expect(within(card).getByRole('img', { name: /price trend/i })).toHaveAttribute('height', '190');
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error for a symbol that could not be fetched', () => {
    render(
      <CompareCard
        comparison={{ symbol: 'NOPE', error: { title: 'Symbol not found', message: '"NOPE" is not available.' } }}
      />,
    );
    const card = screen.getByRole('article', { name: 'Comparison for NOPE' });
    expect(within(card).getByRole('alert')).toHaveTextContent('Symbol not found');
    expect(within(card).queryByTestId('summary-tiles')).not.toBeInTheDocument();
  });

  it('gives each chart its own area gradient, so two cards on one page keep their own colours', () => {
    render(
      <>
        <CompareCard comparison={{ symbol: 'AAPL', performance }} />
        <CompareCard comparison={{ symbol: 'GOOG', performance: { ...performance, symbol: 'GOOG' } }} />
      </>,
    );
    const fills = screen.getAllByTestId('price-area').map((path) => path.getAttribute('fill'));
    expect(fills).toHaveLength(2);
    expect(fills[0]).not.toBe(fills[1]);
    for (const fill of fills) {
      const id = /^url\(#(.+)\)$/.exec(fill!)?.[1];
      expect(id).toBeDefined();
      expect(document.getElementById(id!)?.tagName.toLowerCase()).toBe('lineargradient');
    }
  });
});
