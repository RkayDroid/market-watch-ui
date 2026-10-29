import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HourlyPriceTable from './HourlyPriceTable.tsx';

const history = [
  { label: '03:00 PM', open: 9.5, high: 10.75, low: 9.25, price: 10, trend: 'neutral' as const },
  { label: '04:00 PM', open: 10, high: 13, low: 9.9, price: 12.5, trend: 'up' as const },
  { label: '05:00 PM', open: 12.5, high: 12.6, low: 10.8, price: 11, trend: 'down' as const },
];

describe('HourlyPriceTable', () => {
  it('renders one row per candle with open, high, low, close and trend', () => {
    render(<HourlyPriceTable history={history} />);

    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Timestamp', 'Open', 'High', 'Low', 'Close', 'Trend']);

    const rows = within(table).getAllByRole('row').slice(1); // drop header
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getAllByRole('cell').map((td) => td.textContent)).toEqual([
      '04:00 PM',
      '$10.00',
      '$13.00',
      '$9.90',
      '$12.50',
      'up',
    ]);
    expect(within(rows[1]).getByTitle('up')).toBeInTheDocument();
    expect(within(rows[2]).getByTitle('down')).toBeInTheDocument();
  });

  it('formats every price column in the given currency and says so once in the header', () => {
    render(<HourlyPriceTable history={history.slice(0, 1)} currency="EUR" />);
    expect(screen.getByTestId('price-table-currency')).toHaveTextContent('Prices in EUR');
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell').slice(1, 5);
    for (const cell of cells) expect(cell.textContent).toMatch(/^€/);
  });

  it('renders an empty body gracefully', () => {
    render(<HourlyPriceTable history={[]} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1);
  });
});
