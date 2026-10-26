import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PriceHistory } from '../types/stock.ts';
import PastPerformanceSection from './PastPerformanceSection.tsx';

const details = { symbol: 'AAPL', currency: 'USD' };

describe('PastPerformanceSection', () => {
  it('is a labelled section with the period selector, and renders the chart and table empty without history', () => {
    render(<PastPerformanceSection details={details} history={null} period="DAY" onPeriodChange={() => {}} />);

    const section = screen.getByRole('region', { name: 'Past Performance' });
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent('Past Performance');
    expect(within(section).getByRole('radio', { name: 'Day' })).toBeChecked();

    expect(within(section).getByTestId('price-chart-empty')).toHaveTextContent('No price data to plot.');
    expect(within(section).getByRole('table')).toBeInTheDocument();
    expect(within(section).getAllByRole('row')).toHaveLength(1); // header only
    expect(within(section).queryByTestId('summary-tiles')).not.toBeInTheDocument();
  });

  it('forwards period changes', async () => {
    const onPeriodChange = vi.fn();
    render(<PastPerformanceSection details={details} history={null} period="DAY" onPeriodChange={onPeriodChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Week' }));
    expect(onPeriodChange).toHaveBeenCalledWith('WEEK');
  });

  it('populates the summary tiles, chart and table once history is supplied', () => {
    const history: PriceHistory = {
      currentPrice: 110,
      highPrice: 110,
      lowPrice: 100,
      changePercent: 10,
      hourly: [
        { hour: '09:00', price: 100, trend: 'neutral' },
        { hour: '10:00', price: 110, trend: 'up' },
      ],
    };
    render(<PastPerformanceSection details={details} history={history} period="DAY" onPeriodChange={() => {}} />);

    const section = screen.getByRole('region', { name: 'Past Performance' });
    expect(within(section).getByTestId('summary-price')).toHaveTextContent('$110.00');
    expect(within(section).getByTestId('price-chart')).toHaveAttribute('data-direction', 'up');
    expect(within(section).getAllByRole('row')).toHaveLength(3);
  });
});
