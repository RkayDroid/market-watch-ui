import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StockData } from '../types/stock.ts';
import StockSummaryCards from './StockSummaryCards.tsx';

const base: StockData = {
  symbol: 'GOOG',
  currentPrice: 186.9,
  highPrice: 187.2,
  lowPrice: 181.75,
  changePercent: 2.47,
  history: [],
};

describe('StockSummaryCards', () => {
  it('renders symbol, price, change and high/low', () => {
    render(<StockSummaryCards stock={base} />);
    expect(screen.getByTestId('summary-symbol')).toHaveTextContent('GOOG');
    expect(screen.getByTestId('summary-price')).toHaveTextContent('$186.90');
    expect(screen.getByTestId('summary-change')).toHaveTextContent('2.47%');
    expect(screen.getByTestId('summary-high-low')).toHaveTextContent('$187.20 / $181.75');
  });

  it('shows a negative change with the error colour', () => {
    render(<StockSummaryCards stock={{ ...base, changePercent: -1.5 }} />);
    const chip = screen.getByTestId('summary-change');
    expect(chip).toHaveTextContent('-1.5%');
    expect(chip.className).toMatch(/colorError/);
  });
});
