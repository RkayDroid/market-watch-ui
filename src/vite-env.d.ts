/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the live price API, e.g. https://api.example.com/v1 */
  readonly VITE_LIVE_API_BASE_URL?: string;
  /** Optional bearer token sent as `Authorization: Bearer <key>`. */
  readonly VITE_LIVE_API_KEY?: string;
  /** Request timeout in milliseconds. */
  readonly VITE_LIVE_API_TIMEOUT_MS?: string;
  /** User id sent to the watchlist API (`POST /watchlist`). */
  readonly VITE_USER_ID?: string;
}
