import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PastPerformance } from '../types/stock.ts';
import StockSummaryCards from './StockSummaryCards.tsx';

const base: PastPerformance = {
  symbol: 'GOOG',
  period: 'WEEK',
  interval: '1d',
  latestPrice: 186.9,
  changePercent: 2.47,
  points: [],
  high: { price: 187.2, occurredAt: '2026-10-23' },
  low: { price: 181.75, occurredAt: '2026-10-22T09:30:00-04:00' },
};

describe('StockSummaryCards', () => {
  it('renders latest price with change, and high / low with when they occurred', () => {
    render(<StockSummaryCards performance={base} formatOccurredAt={(d) => `at ${d}`} />);
    expect(screen.getByTestId('summary-price')).toHaveTextContent('$186.90');
    expect(screen.getByTestId('summary-change')).toHaveTextContent('2.47%');
    expect(screen.getByTestId('summary-high')).toHaveTextContent('$187.20');
    expect(screen.getByTestId('summary-high-secondary')).toHaveTextContent('at 2026-10-23');
    expect(screen.getByTestId('summary-low')).toHaveTextContent('$181.75');
    expect(screen.getByTestId('summary-low-secondary')).toHaveTextContent('at 2026-10-22T09:30:00-04:00');
  });

  it('formats occurrence times as dates or timestamps by default', () => {
    render(<StockSummaryCards performance={base} />);
    expect(screen.getByTestId('summary-high-secondary')).toHaveTextContent('Oct 23, 2026');
    expect(screen.getByTestId('summary-low-secondary')).toHaveTextContent(/Oct 22, \d\d:\d\d [AP]M/);
  });

  it('formats in the stock\u2019s own currency when known', () => {
    render(<StockSummaryCards performance={base} currency="EUR" />);
    expect(screen.getByTestId('summary-price')).toHaveTextContent('€186.90');
    expect(screen.getByTestId('summary-high')).toHaveTextContent('€187.20');
  });

  it('shows a negative change with the error colour', () => {
    render(<StockSummaryCards performance={{ ...base, changePercent: -1.5 }} />);
    const chip = screen.getByTestId('summary-change');
    expect(chip).toHaveTextContent('-1.5%');
    expect(chip.className).toMatch(/colorError/);
  });
});
