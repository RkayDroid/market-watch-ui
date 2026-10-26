/**
 * Runtime configuration for the live stock API.
 *
 * Values come from Vite env vars (`.env`, `.env.local`, …); see `.env.example`.
 * The defaults point at a placeholder host so the provider is fully wired up
 * and exercisable before a real endpoint exists.
 */

export interface LiveApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}

/** Placeholder until the real endpoint is known. Override with VITE_LIVE_API_BASE_URL. */
export const DEFAULT_LIVE_API_BASE_URL = 'https://api.market-watch.example/v1';
export const DEFAULT_LIVE_API_TIMEOUT_MS = 10_000;

export type LiveApiEnv = Pick<
  ImportMetaEnv,
  'VITE_LIVE_API_BASE_URL' | 'VITE_LIVE_API_KEY' | 'VITE_LIVE_API_TIMEOUT_MS'
>;

function parseTimeout(raw: string | undefined): number {
  const value = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_LIVE_API_TIMEOUT_MS;
}

function blankToUndefined(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function getLiveApiConfig(env: LiveApiEnv = import.meta.env): LiveApiConfig {
  return {
    baseUrl: blankToUndefined(env.VITE_LIVE_API_BASE_URL) ?? DEFAULT_LIVE_API_BASE_URL,
    apiKey: blankToUndefined(env.VITE_LIVE_API_KEY),
    timeoutMs: parseTimeout(env.VITE_LIVE_API_TIMEOUT_MS),
  };
}
