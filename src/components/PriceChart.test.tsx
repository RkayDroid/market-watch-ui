import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TrendPoint } from '../types/stock.ts';
import PriceChart from './PriceChart.tsx';

const history: TrendPoint[] = [
  { label: 'Oct 21, 03:00 PM', open: 275.0, high: 276.0, low: 274.5, price: 275.2, trend: 'neutral' },
  { label: 'Oct 21, 04:00 PM', open: 275.2, high: 275.6, low: 274.1, price: 274.8, trend: 'down' },
  { label: 'Oct 21, 05:00 PM', open: 274.9, high: 283.0, low: 274.7, price: 282.5, trend: 'up' },
];

describe('PriceChart', () => {
  it('renders an accessible SVG with a point per hour and the series paths', () => {
    render(<PriceChart history={history} />);

    const svg = screen.getByRole('img', { name: /Price Trend: 3 price points/ });
    expect(svg).toHaveAttribute('viewBox', '0 0 800 280'); // jsdom can't measure → fallback width
    expect(svg).toHaveAttribute('data-direction', 'up');

    const points = within(svg).getAllByTestId('price-point');
    expect(points).toHaveLength(3);
    expect(points.map((p) => p.getAttribute('data-trend'))).toEqual(['neutral', 'down', 'up']);
    expect(points[2].querySelector('title')).toHaveTextContent(
      'Oct 21, 05:00 PM: close $282.50 (high $283.00, low $274.70)',
    );

    expect(screen.getByTestId('price-line').getAttribute('d')).toMatch(/^M/);
    expect(screen.getByTestId('price-area').getAttribute('d')).toMatch(/Z$/);
  });

  it('labels both axes', () => {
    render(<PriceChart history={history} />);
    const xTicks = screen.getAllByTestId('x-tick');
    expect(xTicks.map((t) => t.textContent)).toEqual(history.map((h) => h.label));
    expect(xTicks.map((t) => t.getAttribute('text-anchor'))).toEqual(['start', 'middle', 'end']);
    const yLabels = screen.getAllByTestId('y-tick').map((t) => t.textContent);
    expect(yLabels.length).toBeGreaterThan(0);
    for (const label of yLabels) expect(label).toMatch(/^\$\d+\.\d{2}$/);
  });

  it('shows a tooltip with the close and the high/low for the hovered candle, hiding it on leave', () => {
    render(<PriceChart history={history} />);
    expect(screen.queryByTestId('price-tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('hit-1'));
    const tooltip = screen.getByTestId('price-tooltip');
    const close = within(tooltip).getByTestId('tooltip-close');
    expect(close).toHaveTextContent('$274.80');
    expect(within(tooltip).getByTestId('tooltip-high')).toHaveTextContent('High$275.60');
    expect(within(tooltip).getByTestId('tooltip-low')).toHaveTextContent('Low$274.10');
    const label = within(tooltip).getByTestId('tooltip-label');
    expect(label).toHaveTextContent('Oct 21, 04:00 PM');
    expect(tooltip).not.toHaveTextContent(/Close|Open|275\.20/); // no labels on the headline, no open row

    fireEvent.mouseLeave(screen.getByTestId('price-chart'));
    expect(screen.queryByTestId('price-tooltip')).not.toBeInTheDocument();
  });

  it('lays the tooltip out as a centred bold close, the high/low rows, then the timestamp in a smaller font', () => {
    render(<PriceChart history={history} />);
    fireEvent.mouseEnter(screen.getByTestId('hit-1'));
    const tooltip = screen.getByTestId('price-tooltip');
    const box = tooltip.querySelector('rect')!;
    const close = within(tooltip).getByTestId('tooltip-close');
    const label = within(tooltip).getByTestId('tooltip-label');
    const highLabel = within(tooltip).getByTestId('tooltip-high').querySelector('text')!;
    const lowLabel = within(tooltip).getByTestId('tooltip-low').querySelector('text')!;

    expect(close).toHaveAttribute('font-weight', 'bold');
    expect(close).toHaveAttribute('font-size', '13');
    expect(close).toHaveAttribute('text-anchor', 'middle');
    expect(Number(close.getAttribute('x'))).toBe(Number(box.getAttribute('x')) + Number(box.getAttribute('width')) / 2);
    expect(tooltip.querySelector('svg')).toBeNull(); // no icons inside the tooltip

    expect(Number(label.getAttribute('font-size'))).toBe(Number(highLabel.getAttribute('font-size')) - 1);
    // Top to bottom: close, high, low, timestamp — all inside the box.
    const ys = [close, highLabel, lowLabel, label].map((el) => Number(el.getAttribute('y')));
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[0]).toBeGreaterThan(Number(box.getAttribute('y')));
    expect(ys[3]).toBeLessThanOrEqual(Number(box.getAttribute('y')) + Number(box.getAttribute('height')));
    expect(within(tooltip).queryByTestId('tooltip-open')).not.toBeInTheDocument();
  });

  it('widens the tooltip for prices with more digits', () => {
    const widthFor = (price: number) => {
      const { unmount } = render(
        <PriceChart history={history.map((h) => ({ ...h, price, high: price, low: price }))} width={800} />,
      );
      fireEvent.mouseEnter(screen.getByTestId('hit-1'));
      const width = Number(screen.getByTestId('price-tooltip').querySelector('rect')!.getAttribute('width'));
      unmount();
      return width;
    };
    const small = widthFor(9.5);
    const medium = widthFor(274.8);
    const large = widthFor(811657.94);
    expect(small).toBeLessThanOrEqual(medium);
    expect(medium).toBeLessThan(large);
    expect(large).toBeLessThan(200);
  });

  it('formats the tooltip figures in the given currency', () => {
    render(<PriceChart history={history} currency="EUR" />);
    fireEvent.mouseEnter(screen.getByTestId('hit-0'));
    expect(screen.getByTestId('tooltip-high')).toHaveTextContent('€276.00');
  });

  it('clamps the tooltip inside the SVG when the plot is too short to fit it above or below', () => {
    render(<PriceChart history={history} width={400} height={120} />);
    fireEvent.mouseEnter(screen.getByTestId('hit-1'));
    const box = screen.getByTestId('price-tooltip').querySelector('rect')!;
    const svg = screen.getByTestId('price-chart');
    const [, , vbWidth, vbHeight] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(Number(box.getAttribute('x'))).toBeGreaterThanOrEqual(0);
    expect(Number(box.getAttribute('x')) + Number(box.getAttribute('width'))).toBeLessThanOrEqual(vbWidth);
    expect(Number(box.getAttribute('y'))).toBeGreaterThanOrEqual(0);
    expect(Number(box.getAttribute('y')) + Number(box.getAttribute('height'))).toBeLessThanOrEqual(vbHeight);
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
