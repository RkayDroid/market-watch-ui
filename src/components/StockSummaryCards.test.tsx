import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PriceHistory } from '../types/stock.ts';
import StockSummaryCards from './StockSummaryCards.tsx';

const base: PriceHistory = {
  currentPrice: 186.9,
  highPrice: 187.2,
  lowPrice: 181.75,
  changePercent: 2.47,
  hourly: [],
};

describe('StockSummaryCards', () => {
  it('renders price, change and high/low', () => {
    render(<StockSummaryCards history={base} />);
    expect(screen.getByTestId('summary-price')).toHaveTextContent('$186.90');
    expect(screen.getByTestId('summary-change')).toHaveTextContent('2.47%');
    expect(screen.getByTestId('summary-high-low')).toHaveTextContent('$187.20 / $181.75');
  });

  it('formats in the stock\u2019s own currency when known', () => {
    render(<StockSummaryCards history={base} currency="EUR" />);
    expect(screen.getByTestId('summary-price')).toHaveTextContent('€186.90');
    expect(screen.getByTestId('summary-high-low')).toHaveTextContent('€187.20 / €181.75');
  });

  it('shows a negative change with the error colour', () => {
    render(<StockSummaryCards history={{ ...base, changePercent: -1.5 }} />);
    const chip = screen.getByTestId('summary-change');
    expect(chip).toHaveTextContent('-1.5%');
    expect(chip.className).toMatch(/colorError/);
  });
});
