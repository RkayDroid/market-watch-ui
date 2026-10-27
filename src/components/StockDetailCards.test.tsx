import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StockDetails } from '../types/stock.ts';
import StockDetailCards from './StockDetailCards.tsx';

const full: StockDetails = {
  symbol: 'AAPL',
  displayName: 'Apple',
  longName: 'Apple Inc.',
  sector: 'Technology',
  exchange: 'NMS',
  market: 'us_market',
  currency: 'USD',
  language: 'en-US',
  fulldayPrice: 347.725,
};

describe('StockDetailCards', () => {
  it('renders a tile for every displayed field of the /stock/{symbol} payload', () => {
    render(<StockDetailCards details={full} />);

    expect(screen.getByTestId('summary-symbol')).toHaveTextContent('AAPL');
    expect(screen.getByTestId('detail-company')).toHaveTextContent('Apple');
    expect(screen.getByTestId('detail-company-secondary')).toHaveTextContent('Apple Inc.');
    expect(screen.getByTestId('detail-fullday-price')).toHaveTextContent('$347.73');
    expect(screen.getByTestId('detail-fullday-price-secondary')).toHaveTextContent('USD');
    expect(screen.getByTestId('detail-sector')).toHaveTextContent('Technology');
    expect(screen.getByTestId('detail-exchange')).toHaveTextContent('NMS');
    expect(screen.getByTestId('detail-exchange-secondary')).toHaveTextContent('NASDAQ Global Select Market');
    expect(screen.getByTestId('detail-market')).toHaveTextContent('US Market');
    expect(screen.getByTestId('detail-market-secondary')).toHaveTextContent('us_market');
    expect(screen.getByTestId('detail-currency')).toHaveTextContent('USD');
    expect(screen.getByTestId('detail-currency-secondary')).toHaveTextContent('US Dollar');
    expect(screen.queryByTestId('detail-language')).not.toBeInTheDocument(); // deliberately not shown
  });

  it('lays the tiles out in order inside a single grid', () => {
    render(<StockDetailCards details={full} />);
    const grid = screen.getByTestId('detail-tiles');
    expect(grid.children).toHaveLength(7);
    expect(Array.from(grid.children).map((tile) => tile.textContent)).toEqual([
      'SymbolAAPL',
      'CompanyAppleApple Inc.',
      'Full-day Price$347.73USD',
      'SectorTechnology',
      'ExchangeNMSNASDAQ Global Select Market',
      'MarketUS Marketus_market',
      'CurrencyUSDUS Dollar',
    ]);
  });

  it('renders only the symbol when nothing else is known', () => {
    render(<StockDetailCards details={{ symbol: 'V' }} />);
    expect(screen.getByTestId('detail-tiles').children).toHaveLength(1);
    expect(screen.getByTestId('summary-symbol')).toHaveTextContent('V');
    expect(screen.queryByTestId('detail-company')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-fullday-price')).not.toBeInTheDocument();
  });

  it('uses the long name as the company when there is no display name', () => {
    render(<StockDetailCards details={{ symbol: 'X', longName: 'X Holdings plc' }} />);
    expect(screen.getByTestId('detail-company')).toHaveTextContent('X Holdings plc');
    expect(screen.queryByTestId('detail-company-secondary')).not.toBeInTheDocument();
  });

  it('omits secondary text for codes it cannot describe', () => {
    render(
      <StockDetailCards details={{ symbol: 'X', exchange: 'ZZZ', currency: 'QQQ', language: 'zz-ZZ', fulldayPrice: 1 }} />,
    );
    expect(screen.queryByTestId('detail-exchange-secondary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detail-currency-secondary')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-fullday-price')).toHaveTextContent('QQQ 1.00'); // Intl's own form for unknown codes
  });

  it('falls back to USD formatting for a price without a currency', () => {
    render(<StockDetailCards details={{ symbol: 'X', fulldayPrice: 5 }} />);
    expect(screen.getByTestId('detail-fullday-price')).toHaveTextContent('$5.00');
    expect(screen.queryByTestId('detail-fullday-price-secondary')).not.toBeInTheDocument();
  });
});
