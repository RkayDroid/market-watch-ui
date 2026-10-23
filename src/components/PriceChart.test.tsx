import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HourlyPrice } from '../types/stock.ts';
import PriceChart from './PriceChart.tsx';

const history: HourlyPrice[] = [
  { hour: 'Oct 21, 03:00 PM', price: 275.2, trend: 'neutral' },
  { hour: 'Oct 21, 04:00 PM', price: 274.8, trend: 'down' },
  { hour: 'Oct 21, 05:00 PM', price: 282.5, trend: 'up' },
];

describe('PriceChart', () => {
  it('renders an accessible SVG with a point per hour and the series paths', () => {
    render(<PriceChart history={history} />);

    const svg = screen.getByRole('img', { name: /24-Hour Price Trend: 3 hourly price points/ });
    expect(svg).toHaveAttribute('viewBox', '0 0 800 280'); // jsdom can't measure → fallback width
    expect(svg).toHaveAttribute('data-direction', 'up');

    const points = within(svg).getAllByTestId('price-point');
    expect(points).toHaveLength(3);
    expect(points.map((p) => p.getAttribute('data-trend'))).toEqual(['neutral', 'down', 'up']);
    expect(points[2].querySelector('title')).toHaveTextContent('Oct 21, 05:00 PM: $282.50');

    expect(screen.getByTestId('price-line').getAttribute('d')).toMatch(/^M/);
    expect(screen.getByTestId('price-area').getAttribute('d')).toMatch(/Z$/);
  });

  it('labels both axes', () => {
    render(<PriceChart history={history} />);
    const xTicks = screen.getAllByTestId('x-tick');
    expect(xTicks.map((t) => t.textContent)).toEqual(history.map((h) => h.hour));
    expect(xTicks.map((t) => t.getAttribute('text-anchor'))).toEqual(['start', 'middle', 'end']);
    const yLabels = screen.getAllByTestId('y-tick').map((t) => t.textContent);
    expect(yLabels.length).toBeGreaterThan(0);
    for (const label of yLabels) expect(label).toMatch(/^\$\d+\.\d{2}$/);
  });

  it('shows a tooltip for the hovered hour and hides it on leave', () => {
    render(<PriceChart history={history} />);
    expect(screen.queryByTestId('price-tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('hit-1'));
    const tooltip = screen.getByTestId('price-tooltip');
    expect(tooltip).toHaveTextContent('Oct 21, 04:00 PM');
    expect(tooltip).toHaveTextContent('$274.80');

    fireEvent.mouseLeave(screen.getByTestId('price-chart'));
    expect(screen.queryByTestId('price-tooltip')).not.toBeInTheDocument();
  });

  it('flips the tooltip below the point when there is no room above', () => {
    render(<PriceChart history={history} />);
    // index 2 is the highest price → plotted near the top of the plot area
    fireEvent.mouseEnter(screen.getByTestId('hit-2'));
    const point = screen.getAllByTestId('price-point')[2];
    const box = screen.getByTestId('price-tooltip').querySelector('rect')!;
    expect(Number(box.getAttribute('y'))).toBeGreaterThan(Number(point.getAttribute('cy')));
  });

  it('colours the chart by overall direction', () => {
    const { unmount } = render(<PriceChart history={[...history].reverse()} />);
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-direction', 'down');
    unmount();

    render(<PriceChart history={[history[0], history[0]]} />);
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-direction', 'flat');
  });

  it('renders a placeholder instead of an SVG when there is no data', () => {
    render(<PriceChart history={[]} />);
    expect(screen.getByTestId('price-chart-empty')).toHaveTextContent('No price data to plot.');
    expect(screen.queryByTestId('price-chart')).not.toBeInTheDocument();
  });

  it('supports a custom title and size', () => {
    render(<PriceChart history={history} title="Intraday" width={400} height={200} />);
    expect(screen.getByText('Intraday')).toBeInTheDocument();
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('viewBox', '0 0 400 200');
    expect(svg).toHaveAttribute('width', '400');
    expect(svg).toHaveAttribute('height', '200');
  });
});
