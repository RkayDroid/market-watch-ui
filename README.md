# Market Watch UI (lite)

A small React + TypeScript + Vite app that looks up a stock symbol and shows its reference
data (company, sector, exchange, market, currency, …) plus — when the data source has it — a
24-hour hourly price breakdown with trend indicators.

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

Every lookup resolves two things through a `StockProvider`: **details** (the `GET /stock/{symbol}`
payload — always required) and an optional **hourly price history**. Sources that have no history
simply omit it; the UI then shows the detail tiles and a short notice instead of the chart and table.

### Local files (offline mode)

The **Local Flat File (CSV)** option is the offline mode. It reads two kinds of file from `public/`,
which Vite serves verbatim, so editing them does not require a rebuild:

- [`public/local-data.csv`](public/local-data.csv) — hourly prices (fetched lazily on the first
  lookup and cached for the lifetime of the page).
- [`public/data/detail-{SYMBOL}.json`](public/data) — stock details, in exactly the shape the live
  API returns. These are copies of the live responses captured in [`json/`](json) (`detail-AAPL.json`,
  `detail-GOOG.json`, `detail-META.json`); a test (`src/data/localDetails.test.ts`) keeps the two in sync.

The two files need not cover the same symbols. A symbol in both (`AAPL`, `GOOG`, `META`) gets the
full screen; one only in the CSV (`NFLX`, `V`) gets the symbol tile plus the chart and table; one only
in a detail file gets the detail tiles plus the "no historic prices" notice. A symbol in neither shows
an error listing the CSV's symbols.

CSV format (one row per observation, header required, column order irrelevant):

```csv
symbol,date,rate
AAPL,2026-10-21T15:00:00Z,220.10
```

| Column   | Type                 | Notes                                   |
| -------- | -------------------- | --------------------------------------- |
| `symbol` | string               | Case-insensitive; normalised to upper   |
| `date`   | ISO-8601 timestamp   | Rows are sorted chronologically on load |
| `rate`   | number               | Price in USD                            |

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
Authorization: Bearer {VITE_LIVE_API_KEY}        (only when set)

200 → { "ticker": "AAPL", "symbol": "AAPL", "displayName": "Apple", "longName": "Apple Inc.",
        "sector": "Technology", "exchange": "NMS", "market": "us_market",
        "currency": "USD", "language": "en-US", "fulldayPrice": 347.725 }
404 → unknown symbol (shown as "not found in the live API")
```

Only `symbol` (falling back to `ticker`) is mandatory; every other field is optional and gets a tile
when present. The endpoint carries **no historic prices**, so for this source the chart, hourly table
and 24h tiles are replaced by an explanatory notice. (The captures in `json/history-*` and
`json/highlow-*` suggest separate endpoints for those; a provider can add `getPrices` when they land.)

Transport and contract failures are surfaced as typed `LiveApiError`s (`unreachable`, `timeout`,
`http`, `malformed`) with user-readable messages.

## Price chart

`PriceChart` plots the 24 hourly points as a dependency-free, responsive SVG line chart
(viewBox-scaled, so it needs no resize observers). All geometry — scales, tick selection,
path strings — lives in pure functions under `src/charts/` and is tested with exact values;
the component only renders what `computePriceChartLayout` returns. The line is coloured by
overall direction (green up / red down / primary flat), hovering a column shows a tooltip,
and every point carries an SVG `<title>` for assistive tech. Because it consumes plain
`HourlyPrice[]`, it can be swapped for a charting library (e.g. `@mui/x-charts`, `recharts`)
without touching the data or service layers.

## Layout

The UI is a single-screen dashboard (`Container maxWidth={false}`):

- **Lookup row** — symbol input (30% width), "Find" button directly beside it (disabled until a
  symbol is typed), and a compact data-source selector, all on one line (wraps below the `md` breakpoint).
- **Detail tiles** — a responsive grid (`auto-fill`, 160px minimum per tile) of the `GET /stock/{symbol}`
  fields: Symbol, Company (display name + long name), Full-day Price (formatted in the stock's currency),
  Sector, Exchange (code + name for known codes), Market (humanised), Currency and Language (code + name
  via `Intl.DisplayNames`). Tiles for absent fields are not rendered.
- **Overview row** *(only when the source has history)* — Current Price (with 24h change chip) and 24h
  High/Low stacked vertically in a 15% column, with the price chart filling the remaining width at a fixed
  280px height; the chart measures its container (`useElementWidth`) so axis text stays crisp at any width.
  Stacks vertically on small screens.
- **Hourly table** *(only when the source has history)* — full width, dense rows (`size="small"` with
  reduced cell padding). Without history, both it and the overview row are replaced by a one-line notice.
- **Lookup lifecycle** — clicking Find clears any previous results immediately and shows a
  "Fetching results for X…" indicator for at least one second (`withMinimumDuration`), so even
  the instant local file gives visible feedback. Failures render as a styled `ErrorBanner` with a
  title, message, remediation hint and — for unknown symbols in the flat file — clickable
  suggestion chips that fill the box and re-run the lookup.

Proportions are defined once in `src/layout.ts`. The Vite template's default stylesheet was
replaced with MUI's `CssBaseline` and a compact theme (`src/theme.ts`) so MUI controls all styling.

## Screenshots

Captured with headless Chromium at 1440px — see `docs/screenshots/`:

| File | What it shows |
| --- | --- |
| `00-initial.png` | Empty state; "Find" disabled until a symbol is entered |
| `01-loading.png` | "Fetching results…" indicator (shown for at least 1 s, even for the local file) |
| `AAPL.png`, `GOOG.png`, `META.png` | Local source, symbol in both files: detail tiles + chart + table (`*-overview.png` = lookup, tiles and chart only) |
| `V.png`, `NFLX.png` | Local source, CSV only: symbol tile + chart + table |
| `live-META.png` | Live API (`GET /stock/META`, served by a stub): detail tiles and the "no historic prices" notice |
| `90-not-found.png` | Unknown symbol in the local files, with clickable suggestions |
| `91-live-api-unreachable.png` | Live API selected with no endpoint configured |

## Architecture

```
public/local-data.csv                     flat-file hourly price database (offline history)
public/data/detail-{SYMBOL}.json          offline stock details (copies of the captures in json/)
json/                                     raw responses captured from the live API (reference only)
.env.example                              live API settings template
src/
  types/stock.ts                          domain types (StockDetails, PriceHistory, StockData)
  data/csv/parseCsv.ts                    generic CSV tokenizer/parser
  data/csv/parsePriceRecords.ts           CSV rows -> validated PriceTable
  data/stockDetails.ts                    GET /stock/{symbol} payload -> validated StockDetails (shared parser)
  config/liveApiConfig.ts                 env-driven live API settings (URL, key, timeout)
  data/providers/StockProvider.ts         StockProvider / PriceProvider interfaces, SymbolNotFoundError, LiveApiError
  data/providers/CsvPriceProvider.ts      file-backed price history (lazy, cached)
  data/providers/LocalStockProvider.ts    offline StockProvider = detail JSON fixtures + CSV history
  data/providers/LiveApiStockProvider.ts  HTTP-backed StockProvider (url builder, response parser, error mapper)
  services/stockAnalytics.ts              pure trend / change% / history summary / StockData assembly
  services/stockService.ts                provider registry -> StockData (details + optional history)
  hooks/useStockLookup.ts                 async state (loading / pendingSymbol / error / data), min loading time
  errors/lookupError.ts                   maps thrown errors to a presentable { title, message, hint, suggestions }
  utils/timing.ts                         delay, withMinimumDuration
  utils/format.ts                         currency / exchange / market / language display formatters (pure)
  hooks/useElementWidth.ts                ResizeObserver-backed width measurement for the chart
  theme.ts                                compact MUI theme (applied with CssBaseline in main.tsx)
  layout.ts                               shared width proportions (30% input, 15% tiles)
  charts/scales.ts                        linear scale, domain padding, nice ticks (pure)
  charts/paths.ts                         SVG path-string builders (pure)
  charts/priceChartLayout.ts              HourlyPrice[] -> scaled points, ticks, paths (pure)
  components/                             LookupForm, LoadingIndicator, ErrorBanner, Tile, StockDetailCards,
                                          StockSummaryCards, HistoryUnavailableNotice, PriceChart, HourlyPriceTable, TrendIndicator
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
