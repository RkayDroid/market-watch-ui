import { describe, expect, it } from 'vitest';
import { describeCandle, describeCurrency, describeExchange, describeInterval, formatMarket, formatPrice } from './format.ts';

describe('formatPrice', () => {
  it('formats in the given currency with two decimals', () => {
    expect(formatPrice(347.725, 'USD')).toBe('$347.73');
    expect(formatPrice(12.5, 'EUR')).toBe('€12.50');
    expect(formatPrice(1234.5, 'GBP')).toBe('£1,234.50');
  });

  it('defaults to USD', () => {
    expect(formatPrice(282.5)).toBe('$282.50');
  });

  it('renders well-formed but unknown codes the way Intl does', () => {
    expect(formatPrice(1, 'QQQ')).toBe('QQQ\u00a01.00'); // Intl separates with a no-break space
  });

  it('falls back to "amount CODE" for malformed codes instead of throwing', () => {
    expect(formatPrice(10, 'NOPE')).toBe('10.00 NOPE');
    expect(formatPrice(10, '')).toBe('10.00 ');
  });
});

describe('describeExchange', () => {
  it('names known exchange codes case-insensitively', () => {
    expect(describeExchange('NMS')).toBe('NASDAQ Global Select Market');
    expect(describeExchange('nyq')).toBe('New York Stock Exchange');
  });

  it('is undefined for unknown codes', () => {
    expect(describeExchange('XXX')).toBeUndefined();
  });
});

describe('formatMarket', () => {
  it('humanises snake_case identifiers, upper-casing short region tokens', () => {
    expect(formatMarket('us_market')).toBe('US Market');
    expect(formatMarket('gb_market')).toBe('GB Market');
    expect(formatMarket('crypto_market')).toBe('Crypto Market');
  });

  it('tolerates stray separators and already-clean values', () => {
    expect(formatMarket('__us__market__')).toBe('US Market');
    expect(formatMarket('Nasdaq')).toBe('Nasdaq');
  });
});

describe('describeCurrency', () => {
  it('describes well-known codes', () => {
    expect(describeCurrency('USD')).toBe('US Dollar');
    expect(describeCurrency('eur')).toBe('Euro');
  });

  it('is undefined for unknown or invalid codes', () => {
    expect(describeCurrency('ZZZ')).toBeUndefined();
    expect(describeCurrency('not a code')).toBeUndefined();
  });
});

describe('describeInterval', () => {
  it('describes the API sampling intervals', () => {
    expect(describeInterval('1h')).toBe('hourly');
    expect(describeInterval('1d')).toBe('daily');
    expect(describeInterval('1wk')).toBe('weekly');
    expect(describeInterval('2wk')).toBe('every 2 weeks');
    expect(describeInterval('1mo')).toBe('monthly');
    expect(describeInterval('15m')).toBe('every 15 minutes');
  });

  it('returns unknown formats unchanged', () => {
    expect(describeInterval('tick')).toBe('tick');
    expect(describeInterval('')).toBe('');
  });
});

describe('describeCandle', () => {
  it('reads out the close, then high/low, in the given currency', () => {
    expect(describeCandle({ label: 'Oct 21, 2026', high: 283, low: 274.7, price: 282.5 })).toBe(
      'Oct 21, 2026: close $282.50 (high $283.00, low $274.70)',
    );
    expect(describeCandle({ label: 'd', high: 2, low: 0.5, price: 1.5 }, 'EUR')).toBe(
      'd: close €1.50 (high €2.00, low €0.50)',
    );
  });
});
