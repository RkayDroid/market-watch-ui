# Market Watch UI — Watchlist Management Change Report

**Scope:** everything from the first watchlist feature through the Compare view and the app-wide Offline mode
switch — navigation (Analysis / Watchlist views), watchlist create / edit / delete, alignment with the watchlist
API (including `GET /user/{userId}/watchlists`), and the multi-symbol Compare view.
**State:** all changes in the working tree on top of commit `0263d6b baseline`, not committed. Every step was
verified with type-check, ESLint, Vitest, a production build, and headless Chromium against the built app.

---

## 1. Headline numbers

| Metric | Baseline | Now | Δ |
|---|---|---|---|
| Source LOC (non-test) | 2,999 | 5,399 | **+2,400** (+80%) |
| Test LOC | 3,221 | 5,606 | **+2,385** |
| Tests passing | 453 in 37 files | **638 in 57 files** | **+185 tests, +20 files** |
| Files added | — | 52 (22 source, 21 test, 1 test helper, 8 screenshots) | |
| Baseline files modified | — | 17 (15 under `src/`, +259 / −189 lines) | |
| New runtime dependencies | — | none | |

Existing architecture conventions were followed throughout — pure rules → injectable providers → async hooks →
small components, tests co-located with code — so every new layer is unit-tested in isolation *and* driven
end-to-end through `App`.

---

## 2. Use cases: before → after

### 2.1 Navigation and data source

| | Before | After |
|---|---|---|
| Screens | One screen: lookup form + results | **Analysis** (the original screen, default) and **Watchlist** views via a header menu (`AppNav`); **Compare** as a sub-view of Watchlist, reached from a card |
| Data source | "Live API / Local JSON" radio on the lookup form, stock data only | **Offline mode** switch in the header (`SourceToggle`), app-wide — governs stock lookups, historic data *and* watchlists |
| Source authority | Historic data used the source the symbol was *looked up* with; a later radio change was ignored | The switch is authoritative at request time (Performance and Compare alike); flipping it hides results that came from the other source and reloads the Watchlist view |
| Results across views | n/a | Lookup results survive a detour to the Watchlist view and back |

### 2.2 Watchlist management

| Use case | Before | After |
|---|---|---|
| Create | — | Dialog: name + free-text symbols (commas / spaces / new lines), live preview chips (× removes), quick-add chips for the offline symbols, impossible tokens flagged as typed, "required" messages only after leaving a field; 1–20 unique symbols, unique name ≤ 40 chars (case-insensitive) |
| View | — | Cards with one clickable chip per symbol (→ Analysis lookup with the app-wide source), compare / edit / delete actions, newest first; caption says where the lists live |
| Edit | — | Rename; reorder (move up / move down per row); remove (× per row, never the last symbol); add (typed + Enter / Add button, or quick-add chips); `n/20` counter; Save only enabled when something actually differs from what is saved |
| Delete | — | One click, through the current source |
| Persist | — | Offline: `localStorage` (`market-watch.watchlists.v1`), defensively parsed like an API payload, in-memory fallback when storage is unavailable. Online: the watchlist API |
| Failure handling | — | Field errors on the fields; storage / API failures shown inside the dialog with the draft kept for retry ("Saving…" while in flight); load / delete failures as a banner on the view |

### 2.3 Watchlist API integration

| Endpoint | Status |
|---|---|
| `POST /watchlist` | Implemented; body `{ userId, watchListName, symbols }`; server-assigned `watchListId` adopted |
| `PUT /watchlist` | Implemented; full replacement `{ watchListId, watchListName, symbols }` — exactly what the edit dialog produces |
| `GET /watchlist/{id}` | Implemented; `symbols` map sorted by its 1-based keys, each entry parsed with the same `parseStockDetails` as `/stock`, per-symbol `error` preserved, `count` checked when present |
| `DELETE /watchlist/{id}` | Implemented |
| `GET /user/{userId}/watchlists` | Implemented (replaced the interim remembered-ids stop-gap); `list()` = listing + parallel `GET /watchlist/{id}` for symbols; offline counterpart `listSummaries()` over browser storage |
| Configuration | `VITE_USER_ID` (default `anonymous`) beside the existing base URL / key / timeout |
| Error mapping | 404 → "Watchlist not found"; other statuses / timeouts / unreachable → `LiveApiError`; off-contract bodies → "Unexpected API response" |
| Loading | Lazy — the watchlist API is only called once the Watchlist view opens; the Analysis view never touches it |
| Test double | `src/test/fakeWatchlistApi.ts` speaks the full contract; App-level tests assert URLs and request bodies verbatim |

### 2.4 Compare view

| | Before | After |
|---|---|---|
| Multi-symbol analysis | One symbol at a time | Chart button on a watchlist card → name + symbols, the same reference-date / period toolbar with a **Compare** button, then a two-per-row grid (one per row on small screens): each card has symbol + company, Latest Price / High / Low tiles in a row, and a miniature (190 px) price chart. No interval table. A failing symbol shows its error in its own card; changing period / date hides results until Compare is clicked again |

---

## 3. Files

### Added (source)

| File | Purpose |
|---|---|
| `types/watchlist.ts` | `Watchlist`, `WatchlistSummary`, `WatchlistDraft`, `NewWatchlist`, `WatchlistEdit`, `WatchlistDetails` / `WatchlistEntry`, limits, `SYMBOL_PATTERN` |
| `types/view.ts` | `AppView` (menu items), `ViewState` (incl. compare sub-view), `menuViewOf` |
| `config/quickLinks.ts` | `QUICK_SYMBOLS` — the offline symbols offered as quick-add suggestions |
| `data/watchlistStore.ts` | Offline persistence: defensive parser + `WatchlistStore` (localStorage / memory) |
| `data/watchlistPayload.ts` | Watchlist API request builders and response parsers (POST / PUT / GET / listing) |
| `data/providers/WatchlistProvider.ts` | Provider interface (`listSummaries` / `list` / `get` / `create` / `update` / `remove`), `WatchlistNotFoundError` |
| `data/providers/LocalWatchlistProvider.ts` | Offline provider over a `WatchlistStore` |
| `data/providers/LiveApiWatchlistProvider.ts` | HTTP provider: URLs, request config, error mapper |
| `services/watchlistService.ts` | Pure rules: symbol-list parsing, draft / edit validation, collection helpers |
| `hooks/useWatchlists.ts` | Async collection for the current provider (lazy load, create, update, remove) |
| `hooks/useWatchlistComparison.ts` | Async comparison state: `/stock` + `/historic` per symbol, in parallel |
| `components/AppNav.tsx`, `SourceToggle.tsx` | Header menu and the Offline mode switch |
| `components/WatchlistPage.tsx`, `WatchlistsSection.tsx`, `WatchlistCard.tsx`, `SectionTitle.tsx` | The Watchlist view |
| `components/CreateWatchlistDialog.tsx`, `EditWatchlistDialog.tsx` | Create and edit dialogs |
| `components/PerformanceToolbar.tsx` | Dark toolbar shared by Past Performance and Compare |
| `components/ComparePage.tsx`, `CompareCard.tsx` | The Compare view |

### Modified (baseline)

| File | Change |
|---|---|
| `App.tsx` | Source + view switches, watchlist / comparison wiring, historic data follows the switch |
| `components/LookupForm.tsx` | Source radios removed (the switch is app-wide) |
| `components/PastPerformanceSection.tsx` | Toolbar extracted to `PerformanceToolbar` (behaviour-preserving) |
| `components/StockSummaryCards.tsx` | `direction` prop (column beside a chart, row above a miniature one) |
| `components/PriceChart.tsx` | Unique gradient id per chart (bug fix, see §4) |
| `config/liveApiConfig.ts`, `vite-env.d.ts`, `.env.example` | `VITE_USER_ID` |
| `data/providers/LiveApiStockProvider.ts` | Config type narrowed to what it uses |
| `errors/lookupError.ts` | Maps `WatchlistNotFoundError` / `InvalidWatchlistError` |
| `theme.ts` | Brand purple as `secondary` (watchlist accents only) |
| `README.md` | Views, data sources, watchlist API contract and mapping notes, architecture tree, screenshots |

### Tests added (21 files + 1 helper, +185 tests)

`App.navigation.test.tsx` (views, toggle, offline and online watchlist flows, compare flows, source authority) ·
`watchlistService`, `watchlistStore`, `watchlistPayload` · `LocalWatchlistProvider`, `LiveApiWatchlistProvider` ·
`useWatchlists`, `useWatchlistComparison` · `CreateWatchlistDialog`, `EditWatchlistDialog`, `WatchlistsSection`,
`WatchlistCard`, `WatchlistPage`, `AppNav`, `PerformanceToolbar`, `ComparePage`, `CompareCard` ·
`types/watchlist`, `types/view`, `config/quickLinks` · helper `test/fakeWatchlistApi.ts`.

---

## 4. Notable engineering decisions and findings

- **Lazy watchlist loading** — nothing is requested from the watchlist API until the Watchlist view is opened;
  lists stay loaded while on Analysis and reload when the source changes.
- **Shared toolbar** — `PerformanceToolbar` extracted from `PastPerformanceSection` and reused by Compare; the
  existing Past Performance tests passed unchanged, confirming the extraction is behaviour-preserving.
- **Source authority fixed** — the Analysis view used to fetch `/historic` from the source a symbol was looked up
  with; with a global switch that was wrong. Historic data now always follows the switch (tested both ways).
- **Removed along the way, at the user's request** — hero banner, resource / community icon section,
  quick-lookup tiles, the "Quick links" landing concept. No dead code left behind.
- **Bug found and fixed** — `PriceChart`'s SVG area gradient used a fixed element `id`; with several charts on one
  page (the Compare view) every chart took the first chart's colour (green lines with a red fill). Each chart now
  gets a unique id via `useId`, with a regression test.
- **Visual brand** — the favicon's purple is the theme's `secondary` colour, used for watchlist accents only; the
  working screens keep the neutral primary and dark bars.

---

## 5. Items for the server team

1. `POST /watchlist` does not echo the symbols — the client shows what it sent (already normalised upper-case,
   so casing cannot diverge).
2. The validation-failure shape (e.g. a 400 body) is unspecified; any non-404 status is currently shown
   generically ("The watchlist API responded with HTTP 400 …").
3. `GET /watchlist/{id}` returns resolved stock details the UI does not yet display — available for a richer
   watchlist card (prices / sectors on the Watchlist view) as a natural next step.

---

## 6. Screenshots

`docs/screenshots/10-analysis.png` · `16-watchlist-online.png` · `11-watchlist-empty.png` ·
`12-create-watchlist.png` · `13-watchlist.png` · `14-lookup-from-watchlist.png` · `15-edit-watchlist.png` ·
`17-compare-before.png` · `18-compare.png`
