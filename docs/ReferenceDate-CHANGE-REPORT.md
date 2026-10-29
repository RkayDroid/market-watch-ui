# Market Watch UI — Change Report

**Scope:** everything from the initial contract remap through wiring `referenceDate` into the historic API.
**State:** all changes staged in the working tree on top of commit `9b4a297 baseline`, not committed. Every step was
verified with type-check, ESLint, Vitest, a production build, and headless Chromium against the built app.

---

## 1. Headline numbers

| Metric | Before | After |
|---|---|---|
| HTTP calls per **Performance** click | 2 (`/historic` + `/highlow`) | 1 (`/historic`) |
| API endpoints consumed | 3 | 2 |
| Offline symbols | 3 (AAPL, GOOG, META) | 7 (+ BRK.A, NFLX, RBLX, TSLA) |
| Offline reference dates | — | 2 captured (2025-10-10, 2026-02-02) + stand-in for any other |
| Fixture files in `public/data/` | 39 | 133 |
| `json/` capture folder | 172 files (2 contract generations, duplicates) | removed — `public/data/` is the single source |
| Source LOC (non-test) | 2,543 | 2,999 |
| Test LOC | 2,663 | 3,214 |
| Tests passing | 275 in 36 files | 453 in 37 files |
| Files touched vs. baseline | — | 251 (4 added, 80 deleted, 55 modified, 112 renamed) |

---

## 2. API contract

| | Before | After |
|---|---|---|
| `GET /stock/{symbol}` | `symbol` preferred over `ticker` | **`ticker` preferred** over `symbol` — `ticker` is what the API accepts on follow-up calls; they differ for `BRK.A` (`symbol: "BRK-A"`) |
| `GET /stock/{symbol}/historic?period=` | `data[]` of `{datetime, price}` | `data[]` of **OHLC candles** `{datetime, open, high, low, close}` + `referenceDate`, `window`, `count` |
| `… &referenceDate=YYYY-MM-DD` | not supported | Supported; response is a **`results` map keyed by date**, parser unwraps the requested entry |
| `GET /stock/{symbol}/highlow?period=` | Separate endpoint, parsed by `highLow.ts` | **Retired.** High/low derived from the candles (`computeHighLow`); verified identical to the old endpoint's figures where windows overlapped |
| Parser strictness | Checked `ticker`/`period` against the request | Also checks the `referenceDate` window (live API); rejects inverted candles (`low > high`); refuses to guess between several windows |

---

## 3. Data layer

| Area | Before | After |
|---|---|---|
| `PriceRecord` | `{ date, rate }` | `{ date, open, high, low, close }` |
| `PriceSeries` | symbol, period, interval, records | + `referenceDate?`, `window?` (as served) |
| `HighLow` | API payload type with symbol/period | Derived pair `{ high, low }` (`PriceExtreme` each) |
| `StockProvider` | `getDetails`, `getPriceSeries`, `getHighLow` | `getDetails`, `getPriceSeries(symbol, period, referenceDate?)` |
| `stockService.performance` | `Promise.all` of two provider calls | One call; `''` reference date → parameter omitted |
| `data/highLow.ts` (+ test) | existed | deleted |
| `buildHighLowUrl`, `localHighLowPath` | existed | deleted |
| `buildHistoricUrl` | `?period=` | `?period=[&referenceDate=]` |
| `localHistoricPath` | `historic-{S}-{P}.json` | + `-1.json` for 2025-10-10, `-2.json` for 2026-02-02, `-2.json` for any other date |
| Fixtures | 3 symbols × (detail + 6 historic + 6 highlow), old shape | 7 symbols × (detail + 6 historic + 12 reference-date variants), verbatim captures |
| Fixture guard test | Folder complete + parses | + each `-1`/`-2` file proven to hold the window for its date |

---

## 4. UI

### Past Performance toolbar

| | Before | After |
|---|---|---|
| Controls | Period radios · Performance | **Reference date** · Period radios · Performance |
| Reference date | — | Optional; label outside the box (matches `Period:`); empty until picked; compact 136 × 29 px box; click anywhere / calendar icon opens the **native** date picker capped at today; shows `YYYY-MM-DD` regardless of locale; clear (×) button; a date after today is rejected inline and disables Performance |
| Results lifecycle | Cleared on period change or new lookup | Also cleared on reference-date change |
| Chart title | `Price Trend — Past Week` | `Price Trend — Past Week **to 2026-02-02**` (the date the served window really ends on — makes the offline stand-in visible) |

### Price chart tooltip

| | Before | After |
|---|---|---|
| Content | Date, close | **Close (centred, bold)** · High · Low · date (smaller font) |
| Size | Fixed 150 × 40 px | Content-sized: width estimated from the widest row (~105 px for AAPL-scale prices, wider for BRK.A's six figures), 6 px padding |
| Positioning | Flip above/below | + clamps inside the SVG when the plot is shorter than the tooltip (latent gap the taller box exposed) |
| Accessible `<title>` per point | `Oct 23, 2026: $347.73` | `Oct 23, 2026: close $347.73 (high $351.73, low $345.75)` |
| Trend icon | — | Tried, found buggy, **removed** (including the supporting changes to `TrendIndicator`/`describeCandle`, so no dead code) |

### Interval grid

| | Before | After |
|---|---|---|
| Columns | Timestamp · Rate (USD) · Trend | Timestamp · **Open · High · Low · Close** · Trend, currency stated once in the header |
| Trend arrow | close vs. previous close | unchanged — still close-based, so it agrees with the chart line |

### Chart line

Unchanged by design: it plots the **close**, the industry-standard series for a line chart (open/high/low belong on
candlestick charts, which `TrendPoint` now has the data for).

---

## 5. New / removed source files

| Added | Removed |
|---|---|
| `components/ReferenceDatePicker.tsx` (+ test) | `data/highLow.ts` (+ test) |
| `utils/date.ts` — today, calendar validity, reference-date validation (+ test) | `json/` folder (172 files: old-contract captures, duplicates, and — once served offline — the reference-date captures) |

---

## 6. Behaviour worth knowing

- **High/low precision:** the retired `/highlow` endpoint gave exact trade times (e.g. `13:25`); derived values are
  dated by the candle they fall in (hourly for DAY, 2-week bucket start for YEAR). Unavoidable with the new contract.
- **DAY now has 7 hourly candles** (the old captures had 14). The chart handles it; it just looks sparser.
- **Offline stand-in is lossy by design:** picking 2026-06-15 offline serves 2026-02-02 data. The field keeps showing
  06-15; the chart title says `to 2026-02-02`.
- **`public/data/` is now both fixtures and raw-capture record.** Hand-editing a file there edits the only copy; the
  README says so.
- **Width estimate in the tooltip is a heuristic** (≈0.56 em/glyph), tuned a touch generous so nothing clips.

---

## 7. Decisions you may want to revisit

1. `ticker`-over-`symbol` precedence — correct for the captures we have; flip back if the API turns out to accept
   `BRK-A` on `/historic`.
2. Reference-date change clears loaded results (mirrors the period radio). Could be relaxed to "keep results, mark
   them stale".
3. The served-date suffix in the chart title. Cost-free on the live API, informative offline; easy to remove.
4. The date field is read-only (picker-only). If keyboard entry is wanted, `validateReferenceDate` already handles
   free text — only the `readOnly` flag and a placeholder need to change.

---

## 8. Suggested commit split

If you'd like history to mirror the conversation, the staged tree splits cleanly into:

1. `feat(api): map new /stock + /historic contract, derive high/low from candles, refresh fixtures`
2. `chore: remove redundant json/ captures`
3. `feat(ui): show OHLC in the interval grid`
4. `feat(chart): OHL(C) tooltip, content-sized`
5. `feat(ui): optional reference-date picker on the performance toolbar`
6. `feat(api): send referenceDate to /historic; offline captures for 2025-10-10 / 2026-02-02`
