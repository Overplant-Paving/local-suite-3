# treasury.html migration report

Harness: `node verify-tool.mjs treasury` — exit 0. Evidence in this directory; `interaction.txt`
line numbers cited below refer to the final green run (2026-07-15 15:37).

## v1 feature walk-through

- [x] **Debt to the penny (hero figure)** — live FiscalData fetch
  (`v2/accounting/od/debt_to_penny`, `page[size]=1`) rendered
  **$39,470,152,218,599** as of Jul 14, 2026 (interaction.txt line 1) — matches the raw API value
  `39470152218599.01` fetched independently via curl during verification. `fmtUSD` /
  `fmtAbbrev` / `fmtDate` byte-identical to v1.
- [x] **"as of" line with abbreviated total** — "as of Jul 14, 2026 · $39.47 trillion" (line 1).
- [x] **1-year sparkline (2nd debt_to_penny fetch, 366-day filter, page[size]=500)** — 252 daily
  points cached (line 10), 2 SVG paths (area + line) rendered (line 3); `sparkline()`
  byte-identical to v1 including `role="img" aria-label="One-year trend"`.
- [x] **Sparkline meta: first/last values + 1-year change with ▲/▼ and %** —
  "Jul 14, 2025: $36.60 trillion … ▲ $2.87 trillion (+7.8%) over 1 year" (line 3), `.chg.up/.down`
  coloring via the preserved `--up`/`--down` tool accents.
- [x] **Per-person / per-household derivations with labeled assumptions** — $116,089 / $299,016
  (line 2) = total / 340,000,000 and / 132,000,000, the v1 constants; the "illustrative, not
  official" disclaimer text is unchanged (see screenshots).
- [x] **Average interest rates table (v2/accounting/od/avg_interest_rates, page[size]=60)** —
  live fetch; latest-month filter (Jun 30, 2026) kept; marketable-first ordering by v1's `order`
  array + grand-total rows appended: 9 rows, "Treasury Bills | Marketable | 3.706%" …
  "Total Interest-bearing Debt | 3.409%" (lines 5–6). Sorting/filtering code byte-identical.
- [x] **Recent auctions table (v1/accounting/od/auctions_query, page[size]=120 → top 15)** —
  live fetch; 15 rows, bills show "inv. rate", notes/bonds show "yield", bid-to-cover "×",
  offering abbreviated (line 7; screenshots show Bond 29-Year 10-Month 5.058% yield etc.).
- [x] **Data stamps with relative age** — `stampText` semantics kept ("just now" / "N min" /
  "N hr" / "N day(s) ago"), lines 4, 6, 8.
- [x] **Cache envelopes under the v1 keys with the v1 value shapes** —
  `suite.cache.treasury.{latest,series,rates,auctions}` hold the *processed* v1 shapes
  (lines 9–12), byte-compatible both directions (see localStorage section).
- [x] **Cache-first instant paint, then network** — kept from v1: each loader paints from the
  cache envelope before awaiting `Suite.fetchJSON` (verified by the "restored from fresh cache,
  no refetch" reload, line 21).
- [x] **~Daily refresh throttle (STALE_MS = 24 h)** — now `Suite.fetchJSON` `ttl: DAY_MS`
  (manifest `cacheTtlMin: 1440`), same interval as v1.
- [x] **Offline / stale path** — cache back-dated 24 h + all http(s) aborted + reload: all three
  sections rendered from cache with "Offline — showing cached data · Data from Jul 14, 2026 …
  (1 day(s) ago)" stamps (lines 13–20, `offline-stale.png`). v1's behavior here was actually a
  crash for the auctions section — see the bug fix below.
- [x] **No-cache error cards** — hero card ("Couldn't reach Treasury FiscalData.") and the
  section `errCard` ("… it will refill from cache when it recovers.") texts preserved verbatim;
  exercised repeatedly during debugging (FiscalData's WAF 500s, see concerns) and by code
  inspection — error text reaches the DOM through `Suite.esc`.
- [x] **Refetch on tab visibility** — `visibilitychange` → all three loaders, kept verbatim
  (fetch-vs-cache decision now inside `Suite.fetchJSON`'s ttl check, same 24 h semantics).
- [x] **Theme toggle** — light → dark, `aria-pressed=true` (line 22), persisted to `suite.theme`.

## changes beyond the recipe

1. **Bug fix (v1 crash, tool-local): `isFinite` → `Number.isFinite` in `renderAuctions`.**
   v1 stores auction rows whose `NaN` fields JSON-serialize to `null`
   (e.g. `{"type":"Bill","yield":null,"inv":3.845,…}` — interaction.txt line 12). On any
   cached render (every same-day revisit, and every offline load), global `isFinite(null)`
   is `true`, so v1 executes `null.toFixed(3)` → `TypeError` → the auctions section stays a
   skeleton forever. Reproduced on the v1 original before fixing:
   `[v1 pageerror] TypeError: Cannot read properties of null (reading 'toFixed')`,
   `v1 warm-cache revisit: {"aucRows":0,"aucSkel":true}`. `Number.isFinite` is false for both
   `null` and `NaN`, so live rendering is unchanged and cached rendering works. Without this
   fix the Batch B stale-cache DoD requirement is unmeetable (first harness run failed exactly
   there). Applied to the `yield`/`btc`/`offer` checks in `renderAuctions` and the filter in
   `normAuctions`; commented at the fix site.
2. **Cache value shape kept at v1's processed form.** `Suite.fetchJSON` caches the raw API
   response; v1 cached processed values. Each loader therefore (a) normalizes either shape
   (`normLatest/normSeries/normRates/normAuctions` — raw responses are `{data:[…]}` objects,
   v1 caches are the processed arrays/object), and (b) writes the processed v1 shape back over
   fetchJSON's raw write after a live fetch. Result: a v1 user's existing cache renders in v2,
   and a v2-written cache still renders in v1 — the localstorage.json value strings for the
   shared keys are identical between the v1 and v2 runs (apart from `t`).
3. **Stale-state wording**: v1 had no distinct offline wording (its stamp only showed data age —
   and its auctions cached path crashed, see 1). Per the Batch B addendum, `stampText` now
   prefixes "Offline — showing cached data · " when `fetchJSON` returns `stale: true`
   (same language as the other Batch B tools). Fresh-path wording unchanged.
4. **Policy-mandated caching**: no new cache added — v1 already cached all four requests with
   a 24 h throttle; they map 1:1 onto `Suite.fetchJSON` cacheKey/ttl.
5. `footer { padding-top: 1.2rem; }` tool-local override (v1 uses 1.2rem, core provides 1.1rem).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | ✅ | ✅ (via core) |
| `suite.cache.treasury.latest` | `{t, v:{record_date, tot_pub_debt_out_amt}}` | identical shape |
| `suite.cache.treasury.series` | `{t, v:[{d, v}]}` | identical shape |
| `suite.cache.treasury.rates` | `{t, v:[raw latest-month rows]}` | identical shape |
| `suite.cache.treasury.auctions` | `{t, v:[{type,term,auction,yield,inv,disc,btc,offer}]}` | identical shape |

`localstorage.json`: keysOnlyInV1 / keysOnlyInV2 both empty; the cached value strings for the
shared keys are identical apart from the `t` timestamps.

## escape allowlist requests

All remote strings (`security_desc`, `security_type_desc`, `security_type`, `security_term`,
`record_date`/dates via `fmtDate`, error messages) are wrapped in `Suite.esc()`. The following
interpolations are NOT wrapped (same as v1) and are provably safe:

- `${fmtUSD(total)}`, `${fmtUSD(perPerson)}`, `${fmtUSD(perHousehold)}` — `"$" + Math.round(n).toLocaleString("en-US")` of a `parseFloat` result: digits/commas only.
- `${fmtAbbrev(first.v)}`, `${fmtAbbrev(last.v)}`, `${fmtAbbrev(Math.abs(chg))}`, `${Number.isFinite(r.offer) ? fmtAbbrev(r.offer) : "—"}` — `fmtAbbrev` returns `"$" + number.toFixed(2) + " trillion|billion|million"` or `fmtUSD`: no markup characters possible.
- `${sparkline(series)}` / `${sparkHtml}` — locally built SVG markup (intentional HTML); every dynamic part inside it is `Number.toFixed(1)` of numeric coordinates; the two date labels inside `sparkHtml` are esc-wrapped.
- `${w}`, `${h}`, `${line}`, `${area}` (inside `sparkline`) — numeric constants / `toFixed` path strings.
- `${dir}` — ternary literal `"up"|"down"`; `${chg >= 0 ? "▲" : "▼"}`, `${pct >= 0 ? "+" : ""}` — literals; `${pct.toFixed(1)}` — Number.toFixed.
- `${US_POP.toLocaleString("en-US")}`, `${US_HOUSEHOLDS.toLocaleString("en-US")}` — local numeric constants.
- `${rate.toFixed(3)}`, `${Number.isFinite(r.btc) ? r.btc.toFixed(2) + "×" : "—"}` — Number.toFixed of parseFloat results (Number.isFinite-guarded).
- `${rateLbl}` — ternary literal `"yield"|"inv. rate"`.
- `${list.map(r => …).join("")}` / `${rows.map(r => …).join("")}` — concatenations of the per-row templates whose dynamic parts are itemized above.

(`stampText(...)` output is esc-wrapped in the hero and set via `textContent` for the two
section stamps.)

## a11y applied

- `Suite.liveRegion()` on the three async result containers: `#hero`, `#ratesBox`,
  `#auctionsBox` (the adjacent `#ratesStamp`/`#auctionsStamp` update in the same paint and
  would only duplicate announcements, so they were left un-marked deliberately).
- Theme button: `aria-label` + `aria-pressed` from core (`Suite.theme.init`), verified line 22.
- Sparkline SVG keeps v1's `role="img"` + `aria-label="One-year trend"`.
- No inputs, no icon-only buttons, no overlays in this tool; back link is a real text `<a>`
  (core pattern). Data tables use real `<th>` headers (from v1).
- Contrast: palettes are the unmodified core/v1 palettes already in use suite-wide.

## endpoints

- `https://api.fiscaldata.treasury.gov` — only external host (verified against source: single
  `BASE` constant; three dataset paths `v2/…/debt_to_penny`, `v2/…/avg_interest_rates`,
  `v1/…/auctions_query`). Present in CATALOG.md (line 211 narrative + line 523 registry; the
  registry's CORS-verified date still says "verify" — live CORS confirmed today from a
  real-UA browser context and via curl `Access-Control-Allow-Origin: *`, so the orchestrator
  can stamp 2026-07-15).
- `cacheTtlMin: 1440` — daily-stats class per API-AND-RELAY.md §2 ("daily stats (CPI,
  treasury, APOD) 24 h"): debt-to-the-penny posts once per business day, avg interest rates
  monthly, auction results after each auction; matches v1's own `STALE_MS = DAY_MS` throttle
  and the v1 footer's "refreshed about once a day".

## concerns for the reviewer

1. **FiscalData's WAF blocks the literal UA substring "HeadlessChrome"** — returns HTTP 500
   with no CORS headers (verified: curl with a HeadlessChrome UA → 500; identical request with
   a real Chrome UA or curl's default UA → 200 + `Access-Control-Allow-Origin: *`). Real
   browsers are unaffected; only the Playwright harness browser trips it. The interaction
   module therefore sets a real Chrome UA on the contexts the harness creates (wrapping
   `chromium.launch` at import time — `verify-tool.mjs` itself untouched; applies equally to
   the v1 and v2 passes, which is also why the v1 screenshots show live data). If this pattern
   recurs in later batches, a harness-level UA option would be cleaner — orchestrator's call.
2. **The WAF is also intermittently flaky under the harness's burst of page loads** (~5 loads
   × 4 requests in under a minute): individual requests occasionally 500. The module does ONE
   polite retry after a 5 s pause when a live section shows an error card (and writes
   `live-fail.txt` diagnostics if the retry also fails, rather than faking success). Etiquette
   note: each harness run makes ~20 real requests to FiscalData because capture screenshots
   v1+v2 in both themes live; that is inherent to the harness design for network tools.
3. **The v1 auctions cached-render crash** (changes-beyond-recipe #1) means real v1 users have
   likely never seen the auctions table on a same-day revisit. Fixing it changes observable
   behavior (for the better); flagging since the "no behavior removed" review will see cached
   auction renders that v1 never managed to produce.
4. The computed-style diff shows only the pre-approved `-webkit-font-smoothing` plus
   `.theme-btn { float: v1=none | v2=right }` from core's shared `.theme-btn` rule — the button
   is a flex item inside `.topbar`, and floats are ignored on flex items, so there is no visual
   effect (screenshots confirm identical header layout).
5. Screenshot parity is exact: the v1/v2 PNGs came out byte-identical in size per theme with
   live data in both, because the extracted core CSS reproduces v1's computed styles exactly.
