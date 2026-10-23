import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultCsvPriceProvider,
  createHttpTextLoader,
  LOCAL_DATA_CSV_PATH,
} from './CsvPriceProvider.ts';

vi.mock('axios');

const CSV = 'symbol,date,rate\nNFLX,2026-10-21T15:00:00Z,712.50\n';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createHttpTextLoader', () => {
  it('GETs the url as text and returns the body verbatim', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: CSV });

    await expect(createHttpTextLoader('/x.csv')()).resolves.toBe(CSV);

    expect(axios.get).toHaveBeenCalledWith('/x.csv', expect.objectContaining({ responseType: 'text' }));
    // the transformResponse passthrough must not JSON-parse the body
    const { transformResponse } = vi.mocked(axios.get).mock.calls[0][1] as {
      transformResponse: Array<(d: string) => string>;
    };
    expect(transformResponse[0]('{"not":"parsed"}')).toBe('{"not":"parsed"}');
  });
});

describe('createDefaultCsvPriceProvider', () => {
  it.each([
    ['/', `/${LOCAL_DATA_CSV_PATH}`],
    ['/app', `/app/${LOCAL_DATA_CSV_PATH}`],
    ['/app/', `/app/${LOCAL_DATA_CSV_PATH}`],
  ])('resolves the csv relative to base url %s', async (base, expectedUrl) => {
    vi.mocked(axios.get).mockResolvedValue({ data: CSV });

    const provider = createDefaultCsvPriceProvider(base);
    await expect(provider.getPrices('NFLX')).resolves.toEqual([
      { date: '2026-10-21T15:00:00.000Z', rate: 712.5 },
    ]);
    expect(axios.get).toHaveBeenCalledWith(expectedUrl, expect.anything());
  });
});
