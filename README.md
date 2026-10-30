# Market Watch UI (lite)

A small React + TypeScript + Vite app that looks up a stock symbol and shows its reference
data (company, sector, exchange, market, currency, …) plus a "Past Performance" section: pick a
period (day … 5 years), click Performance, and get the high/low tiles, price-trend chart and interval table.
That is the **Analysis** view, where the app opens. A header menu switches to the **Watchlist** view,
which shows nothing but the user's watchlists; clicking a symbol there jumps back to Analysis and
looks it up, and a chart button on each list opens a **Compare** view with the latest price / high /
low and a miniature chart for every symbol side by side. An **Offline mode** switch in the same header picks the data source for everything:
off = the live stock and watchlist APIs, on = bundled JSON fixtures for stocks and this browser's
storage for watchlists.

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

The **Offline mode** switch in the header (`SourceToggle`) selects the source app-wide; there is no
per-form choice. Off (the default) means the live APIs, on means the offline stand-ins. The switch is
authoritative at the moment a request is made: historic data — whether fetched with *Performance* on
the Analysis view or *Compare* on a watchlist — always comes from the source the switch says **now**,
not from the source a symbol happened to be looked up with earlier. Flipping it hides any loaded
past-performance or comparison results (they belong to the source they came from) and, on the
Watchlist view, reloads the lists from the other source.

Every `StockProvider` answers two questions for a symbol — **details**, and the **price series**
(OHLC candles) for a period, from which the period's **high/low** is derived — and both sources speak
the same contract (below), parsed by the same code in `src/data/`.

### Local JSON (offline mode)

In offline mode, stock data comes from fixtures under [`public/data/`](public/data), named after the
endpoint they stand in for (`SYMBOL` ∈ `AAPL`, `BRK.A`, `GOOG`, `META`, `NFLX`, `RBLX`, `TSLA`;
`PERIOD` ∈ the six below):

| File | Stands in for |
| --- | --- |
| `detail-{SYMBOL}.json` | `GET /stock/{SYMBOL}` |
| `historic-{SYMBOL}-{PERIOD}.json` | `GET /stock/{SYMBOL}/historic?period={PERIOD}` (no reference date) |
| `historic-{SYMBOL}-{PERIOD}-1.json` | `…/historic?period={PERIOD}&referenceDate=2025-10-10` |
| `historic-{SYMBOL}-{PERIOD}-2.json` | `…/historic?period={PERIOD}&referenceDate=2026-02-02` |

Only those two reference dates were captured, so offline the `-2` file stands in for **any other**
reference date (`localHistoricPath`); the chart title names the date the served window really ends
on, so the substitution is visible. They are the live responses as captured, verbatim, and double as
the reference captures of the current contract (the unit tests import them too). Vite serves them
as-is, so editing them needs no rebuild. To add a symbol, drop in all 19 of its files and add it to
`OFFLINE_SYMBOLS` in `src/data/providers/LocalStockProvider.ts` (used for the suggestion chips on a
miss); `src/data/localFixtures.test.ts` checks that the folder is complete and every file parses for
the symbol, period and reference date in its name.

### Live API

Online, stock data comes from `GET /stock/{symbol}` via `LiveApiStockProvider`. Until a base URL is
configured it points at a placeholder host and lookups report "Could not reach the live API …".
To plug in the real API:

1. Copy `.env.example` to `.env.local` and set `VITE_LIVE_API_BASE_URL` (and `VITE_LIVE_API_KEY`
   if required). Restart the dev server — Vite inlines `VITE_*` vars at startup/build time.
2. If the response shape changes again, adjust `parseStockDetails` in `src/data/stockDetails.ts`
   (single function, shared with the offline fixtures; covered by tests).

Contract:

```
GET {VITE_LIVE_API_BASE_URL}/stock/{SYMBOL}
GET {VITE_LIVE_API_BASE_URL}/stock/{SYMBOL}/historic?period={PERIOD}[&referenceDate={YYYY-MM-DD}]
Authorization: Bearer {VITE_LIVE_API_KEY}        (only when set)
PERIOD = DAY | WEEK | MONTH | HALF_YEAR | YEAR | FIVE_YEAR

/stock     200 → { "ticker": "AAPL", "symbol": "AAPL", "displayName": "Apple", "longName": "Apple Inc.",
                   "sector": "Technology", "exchange": "NMS", "market": "us_market",
                   "currency": "USD", "language": "en-US", "fulldayPrice": 343.83 }
/historic  200 → { "ticker": "AAPL", "symbol": "AAPL", "period": "WEEK", "interval": "1d",
                   "referenceDate": "2026-10-28", "window": { "start": "2026-10-22", "end": "2026-10-28" },
                   "count": 5,
                   "data": [ { "datetime": "2026-10-22", "open": 344.94, "high": 348.36, "low": 342.28, "close": 348.22 }, … ] }
/historic  200 → { "ticker": "AAPL", "symbol": "AAPL", "period": "WEEK", "interval": "1d",
 (with             "results": { "2025-10-10": { "window": { "start": "2025-10-06", "end": "2025-10-10" },
  referenceDate)                                "count": 5, "data": [ … same candle shape … ] } } }
404        → unknown symbol (shown as "not found in the live API")
```

Notes on the shapes, as observed in the captures:

- `/stock`: only `ticker` (falling back to `symbol`) is mandatory; every other field is optional and
  gets a tile when present. `ticker` is the identifier the API was asked for and is what the app uses
  for follow-up requests; `symbol` is the provider's own spelling and can differ (`BRK.A` → `BRK-A`).
- `/historic`: each sample is an OHLC candle. The chart and table plot `close`; the period's **high**
  and **low** are the greatest `high` / smallest `low` across the candles, dated by the candle they
  fall in (`computeHighLow` in `src/services/stockAnalytics.ts`) — the former `/highlow` endpoint is
  gone. `datetime` is a full timestamp with offset for `DAY` (`interval: "1h"`) and a bare
  `YYYY-MM-DD` for other periods (`1d`, `2wk`, `1mo`). Bare dates are formatted as calendar dates
  (`formatPointLabel`) so they never shift by a day in western time zones. Samples are sorted on
  load; a candle with `low > high` is rejected. The parser also checks the response's
  `ticker`/`period` match the request, so a mismatched response can't be shown as the wrong window.
- `/historic` with `referenceDate` answers with a `results` map keyed by reference date instead of
  top-level `data`. `parsePriceSeries` unwraps the entry for the requested date (rejecting a response
  that lacks it, and refusing to guess between several); with no date requested a single-entry map is
  taken as is, which is how the offline stand-in works. Either way the served `referenceDate` and
  `window` end up on `PriceSeries`/`PastPerformance`; `count` is ignored.

Transport and contract failures are surfaced as typed `LiveApiError`s (`unreachable`, `timeout`,
`http`, `malformed`) with user-readable messages.

### Watchlist API

Watchlists go through a `WatchlistProvider` (`src/data/providers/WatchlistProvider.ts`) with the same
two implementations: `LiveApiWatchlistProvider` over the watchlist API, and `LocalWatchlistProvider`
over this browser's storage (`localStorage` key `market-watch.watchlists.v1`, memory when storage is
unavailable). Both share the same base URL / key / timeout settings as the stock API, plus
`VITE_USER_ID` (default `anonymous`) for the `userId` the API wants.

Contract, as implemented in `src/data/watchlistPayload.ts` (request builders + parsers, covered by tests):

```
GET    {base}/user/{userId}/watchlists
                                 → { "userId": "alice", "count": 2,
                                     "watchlists": [ { "watchListId": "k3Zp9QaB", "watchListName": "Tech" }, … ] }
POST   {base}/watchlist          { "userId": "alice", "watchListName": "Tech", "symbols": ["AAPL", "MSFT"] }
                                 → { "userId": "alice", "watchListName": "Tech", "watchListId": "k3Zp9QaB" }
PUT    {base}/watchlist          { "watchListId": "k3Zp9QaB", "watchListName": "Tech", "symbols": ["MSFT", "AAPL"] }  → 200
GET    {base}/watchlist/{id}     → { "watchListId": "k3Zp9QaB", "userId": "u1", "watchListName": "Tech", "count": 2,
                                     "symbols": { "1": { …same shape as /stock… }, "2": { "ticker": "NOPE", "error": "Ticker NOPE not found." } } }
DELETE {base}/watchlist/{id}     → 200
404 → unknown watchlist id
```

Notes on the mapping:

- The client speaks `Watchlist { id, name, symbols[] }`; only the builders/parsers know `watchListId` /
  `watchListName`. Symbols are sent already normalised (upper-case, de-duplicated, validated — see
  *Watchlists* below), so the server's casing cannot differ from what is shown.
- `POST` does not echo the symbols; the created list shows the symbols it was sent, under the server's id.
- `GET` resolves every symbol to `/stock`-shaped details (parsed with the same `parseStockDetails`) or an
  `error`. The parser sorts the `symbols` map by its 1-based keys and checks `count` when present. The UI
  currently shows only the tickers (`toWatchlist`); the resolved details are available for a richer card.
- `PUT` is a full replacement of name + symbols — exactly what the edit dialog produces.
- The listing (`GET /user/{userId}/watchlists`, `parseWatchlistListing`) carries ids and names only, so
  `list()` reads each list back with `GET /watchlist/{id}` (in parallel) for its symbols; a list that
  404s between the two calls is skipped. `listSummaries()` exposes the listing itself. Offline, the
  local provider answers both from this browser's storage. Lists are requested only once the Watchlist
  view is opened (and again when the source changes), not on page load.
- Failures map like the stock API's: 404 → "Watchlist not found", other statuses / timeouts /
  unreachable → the corresponding `LiveApiError`, off-contract bodies → "Unexpected API response".
  The dialogs keep their content and show the message so the user can retry.

## Price chart

`PriceChart` plots the period's closing prices — the conventional series for a line chart; the full
OHLC detail lives in the table — (7 hourly points for a day, up to 61 monthly points for
five years) as a dependency-free, responsive SVG line chart (viewBox-scaled, so it needs no resize
observers). All geometry — scales, tick selection,
path strings — lives in pure functions under `src/charts/` and is tested with exact values;
the component only renders what `computePriceChartLayout` returns. The line is coloured by
overall direction (green up / red down / primary flat), hovering a column shows a compact tooltip —
the candle's close as a centred bold headline, its high / low, and the timestamp in small print
beneath; the box is sized to its widest row, so six-figure prices get more room — and every point
carries an SVG `<title>` reading out the same figures for assistive tech (`describeCandle` in
`utils/format.ts`). Because it consumes plain
`TrendPoint[]`, it can be swapped for a charting library (e.g. `@mui/x-charts`, `recharts`)
without touching the data or service layers.

## Views

The header carries a two-item menu (`AppNav`, `src/types/view.ts`) — the current item is outlined and
marked `aria-current="page"` — and, beside it, the app-wide **Offline mode** switch (`SourceToggle`).

- **Analysis** (default) — the lookup form, detail tiles and past-performance panel described above.
  Lookup state lives above the view switch, so results survive a detour to the Watchlist view and back.
- **Watchlist** — only the watchlists section (no lookup form, no results), with a caption saying
  where the lists live ("Saved on the server." / "Saved in this browser (offline mode)."), a loading
  indicator while they load and an error banner if loading or deleting fails. Clicking a symbol chip
  switches to Analysis, fills the symbol box and runs the lookup with the app-wide source, exactly as
  if Find had been clicked.
- **Compare** — reached from the chart button on a watchlist card (the menu keeps *Watchlist*
  selected; a "Watchlists" button goes back). Shows the list's name and symbols, then the same dark
  toolbar as Past Performance — reference date, period radios — with a **Compare** button instead of
  Performance (`PerformanceToolbar`, shared by both). Compare fetches `/stock` and `/historic` for
  every symbol at once (`useWatchlistComparison`; one symbol failing only affects its own card) and
  lays the results out two per row (one per row on small screens): each card has the symbol and
  company, the Latest Price / High / Low tiles in a row, and a miniature price chart (190 px). There
  is deliberately no interval table here. As in Analysis, changing the period or date hides the results
  until Compare is clicked again. If the compared list disappears (deleted, or the source is switched
  and the other source does not have it) the view falls back to the watchlists.

The brand purple of the favicon (`#863bff`) is the theme's `secondary` colour and is used for the
watchlist accents only; the working screens keep the neutral primary and dark bars.

### Watchlists

A watchlist is `{ id, name, symbols[] }` (`src/types/watchlist.ts`): a user-chosen name,
unique among their lists (case-insensitively, ≤ 40 chars), and 1–20 normalised symbols in the order
entered, without duplicates. Symbols must match `SYMBOL_PATTERN` (`^[A-Z0-9][A-Z0-9.-]{0,9}$`, so
`BRK.A` and `BRK-A` are fine); nothing is checked against a provider at creation time — each symbol
is looked up on its own when clicked, with the selected source.

- **Create** — the "Create watchlist" tile/button opens a dialog: a name and a free-text symbol box
  (commas, spaces, semicolons or new lines all separate). The parsed symbols are previewed as chips
  (× removes one), and the offline symbols (`QUICK_SYMBOLS`, `src/config/quickLinks.ts`) are offered
  as "quick add" toggles. An impossible token (`bad!`)
  is flagged as soon as it is typed; "required" messages wait until the field is left. Save is
  disabled until the draft is valid, reads "Saving…" while the provider works, and a storage failure
  is shown inside the dialog (the draft is kept for a retry). Rules live in
  `src/services/watchlistService.ts` (pure); the provider only receives what passed them.
- **Use** — each saved list is a card with a clickable chip per symbol (→ Analysis lookup) and
  compare / edit / delete buttons. Newest list first.
- **Edit** — the pencil opens a dialog to **rename** the list and **add**, **remove** or
  **reorder** its symbols. Rows have move up / move down / × buttons (keyboard-operable, no drag
  library); an "Add symbols" box takes a comma/space-separated list and applies it with Enter or
  Add (an impossible token blocks the entry and is named, nothing is silently dropped), and the
  offline symbols not yet in the list are offered as quick-add chips. The same name rules apply,
  except that the list may keep its own name; the symbol rules are those of creation (1–20, unique,
  valid), so the last symbol cannot be removed — delete the list instead. Save stays disabled until
  something actually differs from what is saved. `updateWatchlist` replaces the list in place (id,
  `createdAt` and position unchanged).
- **Persistence** — through the `WatchlistProvider` for the current source (see *Watchlist API*
  above). Offline: `localStorage` under `market-watch.watchlists.v1` (`src/data/watchlistStore.ts`);
  what comes back is treated as untrusted and parsed with the same validators as an API payload — a
  malformed entry or duplicate id is skipped, a corrupt value means "no watchlists" — and an in-memory
  store stands in when storage is unavailable (private mode, sandboxed frame). No cross-tab sync.
  `useWatchlists(provider)` owns the async lifecycle (load on provider change, write-through on every
  change; only the latest load may update state). `App` accepts injected `watchlistProviders` for tests.

## Layout

The UI is a single-screen dashboard (`Container maxWidth={false}`):

- **Header** — "Market Watch & Analytics" in a dark bar with white bold text, styled identically to the
  past-performance toolbar (both use `DARK_TOOLBAR_SX` from `components/darkToolbar.ts`).
- **Lookup row** — symbol input (30% width), "Find" button directly beside it (disabled until a
  symbol is typed), and a compact data-source selector, all on one line (wraps below the `md` breakpoint).
- **Detail tiles** — a responsive grid (`auto-fill`, 160px minimum per tile) of the `GET /stock/{symbol}`
  fields: Symbol, Company (display name + long name), Full-day Price (formatted in the stock's currency),
  Sector, Exchange (code + name for known codes), Market (humanised) and Currency (code + name via
  `Intl.DisplayNames`). Tiles for absent fields are not rendered; `language` is parsed but deliberately not shown.
- **Past Performance** — a single panel beneath the tiles, with no visible title (the region is named
  "Past Performance" for assistive tech). Its dark toolbar holds, left to right: the optional
  **Reference date** (`ReferenceDatePicker`, styled like the period selector: label outside, compact
  read-only box that stays empty until a date is picked; clicking it or its calendar button opens the
  browser's native date picker, capped at today, and the pick is shown as `YYYY-MM-DD` regardless of
  locale, with a clear button to go back to "no date"; a date after today is rejected with an inline
  reason and disables Performance — sent as `&referenceDate=` when set, omitted when empty), the
  period radio group in white bold text
  (Day / Week / Month / Six Months / Year / 5 Years, default Day; both choices persist across lookups) and a
  white **Performance** button. Until Performance is clicked the panel is just this toolbar. It calls `/historic` for the loaded symbol, the
  selected period and the source the symbol was loaded from, with its own loading indicator and error
  banner inside the panel. Results render as: Latest Price (last close, with change over the period) plus High
  and Low tiles (derived from the candles, with when they occurred) in a 15% column beside the price chart (fixed 280px height,
  container-measured via `useElementWidth`), then a divider and the dense interval table — titled by
  the loaded period and sampling interval (e.g. "Past Week (daily)"; the chart title adds the date the
  served window ends on, e.g. "Past Week to 2026-02-02") with one row per candle: Open,
  High, Low, Close and a trend arrow (close vs. the previous close, i.e. the same series the chart
  plots). The chart and table are rendered
  `embedded` (no border of their own) so the group reads as one unit. Results belong to the period they
  were fetched for: changing the radio or the reference date (or looking up another symbol) removes
  them, and nothing is shown again until Performance is clicked again. Stacks vertically on small screens.
- **Source changes** — flipping Offline mode keeps the detail tiles (reference data) but removes loaded
  past-performance results; the next Performance click fetches from the newly selected source.
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
| `00-initial.png` | Empty state before the header menu was added; "Find" disabled until a symbol is entered |
| `10-analysis.png` | Analysis view as the app opens, with the Analysis / Watchlist menu and the Offline mode switch in the header |
| `16-watchlist-online.png` | Watchlist view online with no lists yet |
| `17-compare-before.png` | Compare view before clicking Compare: name, symbols, toolbar, hint |
| `18-compare.png` | Compare view: four symbols, two per row, tiles + miniature chart each |
| `11-watchlist-empty.png` | Watchlist view offline with no lists yet |
| `12-create-watchlist.png` | Create-watchlist dialog with the symbol preview and quick-add toggles |
| `13-watchlist.png` | A saved watchlist as a card of clickable symbol chips |
| `14-lookup-from-watchlist.png` | After clicking a watchlist chip: back on Analysis with the symbol looked up |
| `15-edit-watchlist.png` | Edit dialog: rename, reorder, remove, add (typed or quick-add) |
| `01-loading.png` | "Fetching results…" indicator (shown for at least 1 s, even for the local source) |
| `AAPL.png`, `GOOG.png`, `META.png` | Detail tiles and the past-performance toolbar before fetching |
| `AAPL-WEEK.png`, `GOOG-DAY.png`, `META-FIVE_YEAR.png` | After Performance: high/low tiles, chart and table for the period (offline fixtures) |
| `live-META.png` | Same via the live API (`/stock`, `/historic` served by a stub), Week |
| `90-not-found.png` | Unknown symbol in the offline data, with clickable suggestions |
| `91-live-api-unreachable.png` | Online with no endpoint configured |

## Architecture

```
public/data/*.json                        offline fixtures = captured live responses, one per endpoint call (incl. two reference dates)
.env.example                              live API settings template (base URL, key, timeout, user id)
src/
  types/stock.ts                          domain types (StockDetails, PriceSeries/PriceRecord candles, HighLow, PastPerformance, …)
  types/performance.ts                    Past Performance periods (DAY … FIVE_YEAR), labels, default
  types/watchlist.ts                      Watchlist / WatchlistDraft, limits, SYMBOL_PATTERN
  types/view.ts                           AppView (menu items), ViewState (incl. compare sub-view), default
  data/payload.ts                         InvalidPayloadError + field validators shared by the parsers
  data/stockDetails.ts                    /stock payload -> StockDetails
  data/priceSeries.ts                     /historic payload -> PriceSeries of OHLC candles (sorted, request-checked)
  config/liveApiConfig.ts                 env-driven live API settings (URL, key, timeout, user id)
  config/quickLinks.ts                    QUICK_SYMBOLS ("quick add" suggestions in the create-watchlist dialog)
  data/watchlistStore.ts                  offline persistence: parser + WatchlistStore (localStorage / memory)
  data/watchlistPayload.ts                watchlist API request builders + response parsers (POST / PUT / GET / listing)
  data/providers/WatchlistProvider.ts     WatchlistProvider interface (list/get/create/update/remove), WatchlistNotFoundError
  data/providers/LocalWatchlistProvider.ts   offline provider over a WatchlistStore
  data/providers/LiveApiWatchlistProvider.ts HTTP provider: URLs (incl. /user/{id}/watchlists), error mapper
  data/providers/StockProvider.ts         StockProvider interface, SymbolNotFoundError, LiveApiError
  data/providers/LocalStockProvider.ts    offline StockProvider over public/data (fixture paths, JSON loader)
  data/providers/LiveApiStockProvider.ts  HTTP-backed StockProvider (url builders, response parsing, error mapper)
  services/stockAnalytics.ts              pure trend / change% / high-low derivation / label formatting / PastPerformance assembly
  services/stockService.ts                provider registry -> lookup(details) and performance(historic)
  services/watchlistService.ts            pure watchlist rules: symbol-list parsing, draft/edit validation, collection helpers
  hooks/useStockLookup.ts                 async state of the symbol lookup (+ the source it loaded from)
  hooks/usePerformanceLookup.ts           async state of the Performance fetch (data / loading / pendingPeriod / error, reset)
  hooks/useWatchlists.ts                  async watchlist collection for the current provider (lazy load / create / update / remove)
  hooks/useWatchlistComparison.ts         async state of a comparison: /stock + /historic per symbol, in parallel
  errors/lookupError.ts                   maps thrown errors to a presentable { title, message, hint, suggestions }
  utils/symbol.ts                         normalizeSymbol
  utils/timing.ts                         delay, withMinimumDuration
  utils/format.ts                         currency / exchange / market / language / interval display formatters (pure)
  utils/date.ts                           YYYY-MM-DD helpers: today, calendar validity, reference-date validation (pure)
  hooks/useElementWidth.ts                ResizeObserver-backed width measurement for the chart
  theme.ts                                compact MUI theme (applied with CssBaseline in main.tsx)
  layout.ts                               shared width proportions (30% input, 15% tiles)
  charts/scales.ts                        linear scale, domain padding, nice ticks (pure)
  charts/paths.ts                         SVG path-string builders (pure)
  charts/priceChartLayout.ts              TrendPoint[] -> scaled points, ticks, paths (pure)
  components/darkToolbar.ts               shared dark-bar style (page header + past-performance toolbar)
  components/                             LookupForm, LoadingIndicator, ErrorBanner, Tile, StockDetailCards,
                                          PastPerformanceSection, ReferenceDatePicker, PeriodSelector, StockSummaryCards (column or row),
                                          PriceChart, HourlyPriceTable, TrendIndicator
  components/AppNav.tsx                   header menu (Analysis / Watchlist); SourceToggle.tsx — the Offline mode switch
  components/PerformanceToolbar.tsx       dark bar: reference date + period + action button (Performance / Compare)
  components/ComparePage.tsx              the Compare view; CompareCard.tsx — one symbol's tiles + miniature chart
  components/WatchlistPage.tsx            the Watchlist view = WatchlistsSection only
  components/WatchlistsSection.tsx        watchlist grid / first-watchlist tile; WatchlistCard.tsx; CreateWatchlistDialog.tsx;
                                          EditWatchlistDialog.tsx (rename + add/remove/reorder symbols)
  App.tsx                                 composition root: source + view switches, lookup state (service/providers injectable)
  test/fakeWatchlistApi.ts                in-memory watchlist API speaking the contract, for provider and App tests
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
