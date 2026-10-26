# Market Watch UI (lite)

A small React + TypeScript + Vite app that looks up a stock symbol and shows its reference
data (company, sector, exchange, market, currency, …) plus a "Past Performance" section: pick a
period (day … 5 years), click Fetch, and get the high/low tiles, price-trend chart and interval table.

## Scripts

| Command                 | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start the Vite dev server                |
| `npm run build`         | Type-check and build for production      |
| `npm test`              | Run the unit / component tests (Vitest)  |
| `npm run test:watch`    | Run tests in watch mode                  |
| `npm run test:coverage` | Run tests with a V8 coverage report      |
| `npm run lint`          | Run ESLint                               |

## Data sources

Every `StockProvider` answers three questions for a symbol — **details**, a **price series** for a
period, and the **high/low** for a period — and both sources speak the same contract (below), parsed
by the same code in `src/data/`.

### Local JSON (offline mode)

The **Local JSON (offline)** option reads fixtures from [`public/data/`](public/data), named after the
endpoint they stand in for (`SYMBOL` ∈ `AAPL`, `GOOG`, `META`; `PERIOD` ∈ the six below):

| File | Stands in for |
| --- | --- |
| `detail-{SYMBOL}.json` | `GET /stock/{SYMBOL}` |
| `historic-{SYMBOL}-{PERIOD}.json` | `GET /stock/{SYMBOL}/historic?period={PERIOD}` |
| `highlow-{SYMBOL}-{PERIOD}.json` | `GET /stock/{SYMBOL}/highlow?period={PERIOD}` |

They are copies of the live responses captured in [`json/`](json) (identified by content; the
capture named `2026-10-25T003427.200.json` is `historic-AAPL-DAY` and `hihglow-META-FIVE_YEAR.json`
is `highlow-META-FIVE_YEAR`). Vite serves them verbatim, so editing them needs no rebuild. To add a
symbol, drop in all 13 of its files and add it to `OFFLINE_SYMBOLS` in
`src/data/providers/LocalStockProvider.ts` (used for the suggestion chips on a miss);
`src/data/localFixtures.test.ts` checks that the folder is complete and every file parses.

### Live API

The **Live API** option calls `GET /stock/{symbol}` via `LiveApiStockProvider`. Until a base URL is
configured it points at a placeholder host and lookups report "Could not reach the live API …".
To plug in the real API:

1. Copy `.env.example` to `.env.local` and set `VITE_LIVE_API_BASE_URL` (and `VITE_LIVE_API_KEY`
   if required). Restart the dev server — Vite inlines `VITE_*` vars at startup/build time.
2. If the response shape changes again, adjust `parseStockDetails` in `src/data/stockDetails.ts`
   (single function, shared with the offline fixtures; covered by tests).

Contract:

```
GET {VITE_LIVE_API_BASE_URL}/stock/{SYMBOL}
GET {VITE_LIVE_API_BASE_URL}/stock/{SYMBOL}/historic?period={PERIOD}
GET {VITE_LIVE_API_BASE_URL}/stock/{SYMBOL}/highlow?period={PERIOD}
Authorization: Bearer {VITE_LIVE_API_KEY}        (only when set)
PERIOD = DAY | WEEK | MONTH | HALF_YEAR | YEAR | FIVE_YEAR

/stock     200 → { "ticker": "AAPL", "symbol": "AAPL", "displayName": "Apple", "longName": "Apple Inc.",
                   "sector": "Technology", "exchange": "NMS", "market": "us_market",
                   "currency": "USD", "language": "en-US", "fulldayPrice": 347.725 }
/historic  200 → { "ticker": "AAPL", "period": "WEEK", "interval": "1d", "count": 5, "cached": false,
                   "data": [ { "datetime": "2026-10-19", "price": 342.94 }, … ] }
/highlow   200 → { "symbol": "AAPL", "period": "WEEK", "high": 351.73, "highOccured": "2026-10-23T09:30:00-04:00",
                   "low": 338.7, "lowOccured": "2026-10-20T09:30:00-04:00" }
404        → unknown symbol (shown as "not found in the live API")
```

Notes on the shapes, as observed in the captures:

- `/stock`: only `symbol` (falling back to `ticker`) is mandatory; every other field is optional and
  gets a tile when present.
- `/historic`: `datetime` is a full timestamp with offset for `DAY` (`interval: "1h"`) and a bare
  `YYYY-MM-DD` for other periods (`1d`, `2wk`, `1mo`). Bare dates are formatted as calendar dates
  (`formatPointLabel`) so they never shift by a day in western time zones. Samples are sorted on
  load; `count`/`cached` are ignored. The parser also checks the response's `ticker`/`period` match
  the request, so a mismatched response can't be shown as the wrong window.
- `/highlow`: the API spells it `highOccured`/`lowOccured`; timestamps follow the same full/bare rule.

Transport and contract failures are surfaced as typed `LiveApiError`s (`unreachable`, `timeout`,
`http`, `malformed`) with user-readable messages.

## Price chart

`PriceChart` plots the period's samples (14 hourly points for a day, up to 61 monthly points for
five years) as a dependency-free, responsive SVG line chart (viewBox-scaled, so it needs no resize
observers). All geometry — scales, tick selection,
path strings — lives in pure functions under `src/charts/` and is tested with exact values;
the component only renders what `computePriceChartLayout` returns. The line is coloured by
overall direction (green up / red down / primary flat), hovering a column shows a tooltip,
and every point carries an SVG `<title>` for assistive tech. Because it consumes plain
`TrendPoint[]`, it can be swapped for a charting library (e.g. `@mui/x-charts`, `recharts`)
without touching the data or service layers.

## Layout

The UI is a single-screen dashboard (`Container maxWidth={false}`):

- **Lookup row** — symbol input (30% width), "Find" button directly beside it (disabled until a
  symbol is typed), and a compact data-source selector, all on one line (wraps below the `md` breakpoint).
- **Detail tiles** — a responsive grid (`auto-fill`, 160px minimum per tile) of the `GET /stock/{symbol}`
  fields: Symbol, Company (display name + long name), Full-day Price (formatted in the stock's currency),
  Sector, Exchange (code + name for known codes), Market (humanised), Currency and Language (code + name
  via `Intl.DisplayNames`). Tiles for absent fields are not rendered.
- **Past Performance** — a single panel beneath the tiles. Its header bar holds the title, period radio group
  (Day / Week / Month / Six Months / Year / 5 Years, default Day; the choice persists across lookups)
  and a **Fetch** button. Fetch calls `/historic` and `/highlow` together for the loaded symbol, the
  selected period and the source the symbol was loaded from, with its own loading indicator and error
  banner inside the panel. Results render as: Latest Price (with change over the period) plus High
  and Low tiles (with when they occurred) in a 15% column beside the price chart (fixed 280px height,
  container-measured via `useElementWidth`), then a divider and the dense interval table — titled by
  the loaded period and sampling interval (e.g. "Past Week (daily)"). The chart and table are rendered
  `embedded` (no border of their own) so the group reads as one unit. Before the first fetch they
  render empty; looking up another symbol clears the results. Stacks vertically on small screens.
- **Lookup lifecycle** — clicking Find clears any previous results immediately and shows a
  "Fetching results for X…" indicator for at least one second (`withMinimumDuration`), so even
  the instant local source gives visible feedback. Failures render as a styled `ErrorBanner` with a
  title, message, remediation hint and — for unknown symbols in the offline data — clickable
  suggestion chips that fill the box and re-run the lookup.

Proportions are defined once in `src/layout.ts`. The Vite template's default stylesheet was
replaced with MUI's `CssBaseline` and a compact theme (`src/theme.ts`) so MUI controls all styling.

## Screenshots

Captured with headless Chromium at 1440px — see `docs/screenshots/`:

| File | What it shows |
| --- | --- |
| `00-initial.png` | Empty state; "Find" disabled until a symbol is entered |
| `01-loading.png` | "Fetching results…" indicator (shown for at least 1 s, even for the local source) |
| `AAPL.png`, `GOOG.png`, `META.png` | Detail tiles and the Past Performance section before fetching |
| `AAPL-WEEK.png`, `GOOG-DAY.png`, `META-FIVE_YEAR.png` | After Fetch: high/low tiles, chart and table for the period (offline fixtures) |
| `live-META.png` | Same via the live API (`/stock`, `/historic`, `/highlow` served by a stub), Week |
| `90-not-found.png` | Unknown symbol in the offline data, with clickable suggestions |
| `91-live-api-unreachable.png` | Live API selected with no endpoint configured |

## Architecture

```
public/data/*.json                        offline fixtures (copies of the captures in json/), one per endpoint call
json/                                     raw responses captured from the live API (reference only)
.env.example                              live API settings template
src/
  types/stock.ts                          domain types (StockDetails, PriceSeries, HighLow, PastPerformance, …)
  types/performance.ts                    Past Performance periods (DAY … FIVE_YEAR), labels, default
  data/payload.ts                         InvalidPayloadError + field validators shared by the parsers
  data/stockDetails.ts                    /stock payload -> StockDetails
  data/priceSeries.ts                     /historic payload -> PriceSeries (sorted, request-checked)
  data/highLow.ts                         /highlow payload -> HighLow
  config/liveApiConfig.ts                 env-driven live API settings (URL, key, timeout)
  data/providers/StockProvider.ts         StockProvider interface, SymbolNotFoundError, LiveApiError
  data/providers/LocalStockProvider.ts    offline StockProvider over public/data (fixture paths, JSON loader)
  data/providers/LiveApiStockProvider.ts  HTTP-backed StockProvider (url builders, response parsing, error mapper)
  services/stockAnalytics.ts              pure trend / change% / label formatting / PastPerformance assembly
  services/stockService.ts                provider registry -> lookup(details) and performance(historic + highlow)
  hooks/useStockLookup.ts                 async state of the symbol lookup (+ the source it loaded from)
  hooks/usePerformanceLookup.ts           async state of the Fetch (data / loading / pendingPeriod / error, reset)
  errors/lookupError.ts                   maps thrown errors to a presentable { title, message, hint, suggestions }
  utils/symbol.ts                         normalizeSymbol
  utils/timing.ts                         delay, withMinimumDuration
  utils/format.ts                         currency / exchange / market / language / interval display formatters (pure)
  hooks/useElementWidth.ts                ResizeObserver-backed width measurement for the chart
  theme.ts                                compact MUI theme (applied with CssBaseline in main.tsx)
  layout.ts                               shared width proportions (30% input, 15% tiles)
  charts/scales.ts                        linear scale, domain padding, nice ticks (pure)
  charts/paths.ts                         SVG path-string builders (pure)
  charts/priceChartLayout.ts              TrendPoint[] -> scaled points, ticks, paths (pure)
  components/                             LookupForm, LoadingIndicator, ErrorBanner, Tile, StockDetailCards,
                                          PastPerformanceSection, PeriodSelector, StockSummaryCards,
                                          PriceChart, HourlyPriceTable, TrendIndicator
  App.tsx                                 composition root (service is injectable for tests)
```

Every layer is a plain function or interface with its dependencies passed in, so each
can be tested in isolation; tests live next to the code they cover (`*.test.ts[x]`).

---

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
