# Market Watch UI (lite)

A small React + TypeScript + Vite app that looks up a stock symbol and shows a 24-hour
hourly price breakdown with trend indicators.

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

The **Local Flat File (CSV)** option reads from [`public/local-data.csv`](public/local-data.csv),
which Vite serves verbatim at `/local-data.csv`. It is fetched lazily on the first file lookup
and cached for the lifetime of the page. Editing the CSV does not require a rebuild.

Format (one row per observation, header required, column order irrelevant):

```csv
symbol,date,rate
AAPL,2026-10-21T15:00:00Z,220.10
```

| Column   | Type                 | Notes                                   |
| -------- | -------------------- | --------------------------------------- |
| `symbol` | string               | Case-insensitive; normalised to upper   |
| `date`   | ISO-8601 timestamp   | Rows are sorted chronologically on load |
| `rate`   | number               | Price in USD                            |

Currently shipped tickers: `AAPL`, `GOOG`, `META`, `NFLX`, `V` (24 hourly points each).
Looking up a symbol that is not in the file shows an error listing the available symbols.

The **Live API** option calls a real HTTP endpoint via `LiveApiPriceProvider`. The endpoint
does not exist yet, so the base URL defaults to a placeholder host and lookups will report
"Could not reach the live API …" until it is configured. To plug in the real API:

1. Copy `.env.example` to `.env.local` and set `VITE_LIVE_API_BASE_URL` (and `VITE_LIVE_API_KEY`
   if required). Restart the dev server — Vite inlines `VITE_*` vars at startup/build time.
2. If the real response shape differs from the assumed contract below, adjust
   `parseLiveApiResponse` in `src/data/providers/LiveApiPriceProvider.ts` (single function; covered
   by tests).

Assumed contract:

```
GET {VITE_LIVE_API_BASE_URL}/prices/{SYMBOL}?interval=1h&limit=24
Authorization: Bearer {VITE_LIVE_API_KEY}        (only when set)

200 → { "symbol": "AAPL", "prices": [ { "timestamp": "2026-10-21T15:00:00Z", "price": 220.10 }, … ] }
404 → unknown symbol (shown as "not found in the live API")
```

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
- **Overview row** — summary tiles stacked vertically in a 15% column (labels top-aligned), with the
  price chart filling the remaining width at a fixed 280px height; the chart measures its container
  (`useElementWidth`) so axis text stays crisp at any width. Stacks vertically on small screens.
- **Hourly table** — full width, dense rows (`size="small"` with reduced cell padding).
- **Lookup lifecycle** — clicking Find clears any previous results immediately and shows a
  "Fetching results for X…" indicator for at least one second (`withMinimumDuration`), so even
  the instant local file gives visible feedback. Failures render as a styled `ErrorBanner` with a
  title, message, remediation hint and — for unknown symbols in the flat file — clickable
  suggestion chips that fill the box and re-run the lookup.

Proportions are defined once in `src/layout.ts`. The Vite template's default stylesheet was
replaced with MUI's `CssBaseline` and a compact theme (`src/theme.ts`) so MUI controls all styling.

## Screenshots

Captured with headless Chromium at 1440px from the local CSV source — see `docs/screenshots/`:

| File | What it shows |
| --- | --- |
| `00-initial.png` | Empty state; "Find" disabled until a symbol is entered |
| `01-loading.png` | "Fetching results…" indicator (shown for at least 1 s, even for the local file) |
| `AAPL.png`, `GOOG.png`, `V.png`, `NFLX.png`, `META.png` | Full page per ticker (`*-overview.png` = lookup + overview row only) |
| `90-not-found.png` | Unknown symbol in the flat file, with clickable suggestions |
| `91-live-api-unreachable.png` | Live API selected with no endpoint configured |

## Architecture

```
public/local-data.csv                     flat-file price database
.env.example                              live API settings template
src/
  types/stock.ts                          domain types
  data/csv/parseCsv.ts                    generic CSV tokenizer/parser
  data/csv/parsePriceRecords.ts           CSV rows -> validated PriceTable
  config/liveApiConfig.ts                 env-driven live API settings (URL, key, timeout)
  data/providers/PriceProvider.ts         PriceProvider interface, SymbolNotFoundError, LiveApiError
  data/providers/CsvPriceProvider.ts      file-backed provider (lazy, cached)
  data/providers/LiveApiPriceProvider.ts  HTTP-backed provider (url builder, response parser, error mapper)
  services/stockAnalytics.ts              pure trend / change% / summary functions
  services/stockService.ts                provider registry -> StockData
  hooks/useStockLookup.ts                 async state (loading / pendingSymbol / error / data), min loading time
  errors/lookupError.ts                   maps thrown errors to a presentable { title, message, hint, suggestions }
  utils/timing.ts                         delay, withMinimumDuration
  hooks/useElementWidth.ts                ResizeObserver-backed width measurement for the chart
  theme.ts                                compact MUI theme (applied with CssBaseline in main.tsx)
  layout.ts                               shared width proportions (30% input, 15% tiles)
  charts/scales.ts                        linear scale, domain padding, nice ticks (pure)
  charts/paths.ts                         SVG path-string builders (pure)
  charts/priceChartLayout.ts              HourlyPrice[] -> scaled points, ticks, paths (pure)
  components/                             LookupForm, LoadingIndicator, ErrorBanner, StockSummaryCards, PriceChart, HourlyPriceTable, TrendIndicator
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
