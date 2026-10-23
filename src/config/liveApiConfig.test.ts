import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVE_API_BASE_URL,
  DEFAULT_LIVE_API_TIMEOUT_MS,
  getLiveApiConfig,
} from './liveApiConfig.ts';

describe('getLiveApiConfig', () => {
  it('falls back to placeholder defaults when nothing is configured', () => {
    expect(getLiveApiConfig({})).toEqual({
      baseUrl: DEFAULT_LIVE_API_BASE_URL,
      apiKey: undefined,
      timeoutMs: DEFAULT_LIVE_API_TIMEOUT_MS,
    });
  });

  it('reads values from the environment', () => {
    expect(
      getLiveApiConfig({
        VITE_LIVE_API_BASE_URL: ' https://real.api/v2 ',
        VITE_LIVE_API_KEY: 'secret',
        VITE_LIVE_API_TIMEOUT_MS: '2500',
      }),
    ).toEqual({ baseUrl: 'https://real.api/v2', apiKey: 'secret', timeoutMs: 2500 });
  });

  it.each(['', '   ', 'abc', '-5', '0'])('ignores invalid timeout %j', (raw) => {
    expect(getLiveApiConfig({ VITE_LIVE_API_TIMEOUT_MS: raw }).timeoutMs).toBe(DEFAULT_LIVE_API_TIMEOUT_MS);
  });

  it('treats blank base url / key as unset', () => {
    const cfg = getLiveApiConfig({ VITE_LIVE_API_BASE_URL: '  ', VITE_LIVE_API_KEY: '' });
    expect(cfg.baseUrl).toBe(DEFAULT_LIVE_API_BASE_URL);
    expect(cfg.apiKey).toBeUndefined();
  });
});
