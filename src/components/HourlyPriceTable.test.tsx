import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HourlyPriceTable from './HourlyPriceTable.tsx';

describe('HourlyPriceTable', () => {
  it('renders one row per history entry with price and trend', () => {
    render(
      <HourlyPriceTable
        history={[
          { label: '03:00 PM', price: 10, trend: 'neutral' },
          { label: '04:00 PM', price: 12.5, trend: 'up' },
          { label: '05:00 PM', price: 11, trend: 'down' },
        ]}
      />,
    );

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1); // drop header
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('04:00 PM');
    expect(rows[1]).toHaveTextContent('$12.50');
    expect(within(rows[1]).getByTitle('up')).toBeInTheDocument();
    expect(within(rows[2]).getByTitle('down')).toBeInTheDocument();
  });

  it('renders an empty body gracefully', () => {
    render(<HourlyPriceTable history={[]} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1);
  });
});
