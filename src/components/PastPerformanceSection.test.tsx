import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PastPerformance } from '../types/stock.ts';
import PastPerformanceSection, { type PastPerformanceSectionProps } from './PastPerformanceSection.tsx';

const details = { symbol: 'AAPL', currency: 'USD' };

const performance: PastPerformance = {
  symbol: 'AAPL',
  period: 'HALF_YEAR',
  interval: '2wk',
  latestPrice: 110,
  changePercent: 10,
  points: [
    { label: 'May 8, 2026', price: 100, trend: 'neutral' },
    { label: 'Oct 23, 2026', price: 110, trend: 'up' },
  ],
  high: { price: 112, occurredAt: '2026-10-23' },
  low: { price: 98, occurredAt: '2026-05-08' },
};

function renderSection(overrides: Partial<PastPerformanceSectionProps> = {}) {
  const props: PastPerformanceSectionProps = {
    details,
    period: 'DAY',
    onPeriodChange: vi.fn(),
    onFetch: vi.fn(),
    performance: null,
    loading: false,
    pendingPeriod: null,
    error: null,
    ...overrides,
  };
  render(<PastPerformanceSection {...props} />);
  return props;
}

describe('PastPerformanceSection', () => {
  it('is just a header (title, period selector, Fetch) before anything is fetched', () => {
    renderSection();

    const section = screen.getByRole('region', { name: 'Past Performance' });
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent('Past Performance');
    expect(within(section).getByRole('radiogroup', { name: 'Period:' })).toBeInTheDocument();
    expect(within(section).getByRole('radio', { name: 'Day' })).toBeChecked();
    expect(within(section).getByRole('button', { name: 'Fetch' })).toBeEnabled();

    expect(within(section).queryByTestId('price-chart-panel')).not.toBeInTheDocument();
    expect(within(section).queryByTestId('price-table-panel')).not.toBeInTheDocument();
    expect(within(section).queryByTestId('overview-row')).not.toBeInTheDocument();
    expect(within(section).queryByTestId('summary-tiles')).not.toBeInTheDocument();
    expect(within(section).queryByRole('table')).not.toBeInTheDocument();
  });

  it('forwards period changes and Fetch clicks', async () => {
    const { onPeriodChange, onFetch } = renderSection();

    await userEvent.click(screen.getByRole('radio', { name: 'Week' }));
    expect(onPeriodChange).toHaveBeenCalledWith('WEEK');

    await userEvent.click(screen.getByRole('button', { name: 'Fetch' }));
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it('shows a loading indicator and disables the controls while fetching', () => {
    renderSection({ loading: true, pendingPeriod: 'FIVE_YEAR' });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Fetching past performance for AAPL…');
    expect(status).toHaveTextContent('for the past 5 years');
    expect(screen.getByTestId('fetch-performance')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Day' })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('price-chart-panel')).not.toBeInTheDocument();
  });

  it('renders the error banner inside the section', () => {
    renderSection({ error: { title: 'Live API timed out', message: 'The live API timed out for AAPL.' } });
    const section = screen.getByRole('region', { name: 'Past Performance' });
    expect(within(section).getByRole('alert')).toHaveTextContent('Live API timed out');
    expect(within(section).getByRole('button', { name: 'Fetch' })).toBeEnabled();
    expect(within(section).queryByTestId('price-chart-panel')).not.toBeInTheDocument();
  });

  it('populates the summary tiles, chart and table from the loaded performance, titled by its period', () => {
    renderSection({ performance, period: 'DAY' });

    const section = screen.getByRole('region', { name: 'Past Performance' });
    expect(within(section).getByTestId('summary-price')).toHaveTextContent('$110.00');
    expect(within(section).getByTestId('summary-change')).toHaveTextContent('10%');
    expect(within(section).getByTestId('summary-high')).toHaveTextContent('$112.00');
    expect(within(section).getByTestId('summary-low')).toHaveTextContent('$98.00');

    expect(within(section).getByTestId('price-chart')).toHaveAttribute('data-direction', 'up');
    expect(within(section).getByText('Price Trend — Past Six Months')).toBeInTheDocument();
    expect(within(section).getByText('Price Intervals — Past Six Months (every 2 weeks)')).toBeInTheDocument();
    expect(within(section).getAllByRole('row')).toHaveLength(3);
    expect(within(section).getAllByRole('row')[2]).toHaveTextContent('Oct 23, 2026');
  });
});
