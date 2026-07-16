# currency.html — migration report (Batch B)

## v1 feature walk-through

- [x] **Latest-rates board (12 currencies, per 1 USD)** — live fetch of
  `https://api.frankfurter.dev/v1/latest?base=USD` verified; interaction.txt logs concrete
  rendered values (EUR 0.8767, GBP 0.7460, JPY 162.39 per 1 USD, rates as of 2026-07-15).
  Board renders flag + code + name + formatted rate exactly as v1 (`fmtRate` unchanged).
- [x] **Converter (amount x from -> to, cross-rate via USD)** — exercised with a known amount:
  250 USD -> EUR, expected 250 x 0.87673 = 219.18, observed "250 USD = 219.18 EUR"; the
  "1 FROM = rate TO" subline renders ("1 USD = 0.8767 EUR"). Live-updates on amount input
  and both select changes, as v1.
- [x] **Swap button** — clicked after the conversion: 250 EUR -> USD, expected 250 / 0.87673
  = 285.15, observed "250 EUR = 285.15 USD · 1 EUR = 1.141 USD". Values swap, result recomputes.
- [x] **Board card click selects currency + loads its trend** — clicked GBP: card gets `.sel`
  (and new `aria-pressed=true`), trend title flips to "GBP · 30-day trend", chart redraws
  (2 paths + 5 gridlines + 12 labels logged), note "0.7451 -> 0.7460 per USD · +0.13%".
- [x] **30-day trend chart (SVG: gridlines, y labels, date labels, area+line, end dot,
  up/down color)** — initial EUR trend fetched live from
  `https://api.frankfurter.dev/v1/<start>..<end>?base=USD&symbols=EUR`; note logged
  "0.8616 -> 0.8767 per USD · +1.76% over the period". Screenshots show the identical chart
  in both themes vs v1.
- [x] **Theme toggle redraws the chart with the new palette** — v1's `if(state.rates)drawTrend()`
  kept as an extra listener on #themeBtn (Suite.theme's toggle runs first, then the redraw
  reads the flipped CSS variables). Dark screenshots show the dark chart palette.
- [x] **Fallback source open.er-api.com** — code path preserved verbatim (normalizer accepts the
  raw er-api shape; status/footer switch to the attribution text; trend card shows the
  "needs the Frankfurter source" note). Not live-exercised: frankfurter was up during the run,
  and deliberately failing one source while fetching the other would mean hammering; the shape
  handling is unit-visible in `normalizeLatest` and the fallback fetch is exercised (aborted)
  in the offline test — see concerns.
- [x] **12 h fresh-cache fast path** — subsumed by `Suite.fetchJSON` TTL (now 24 h, see below);
  verified by the "restored (from fresh cache, no refetch)" step: with fresh cache timestamps
  and network untouched, reload rendered the full board with no live request.
- [x] **Total-failure error state** — v1's "Couldn't reach a rate source..." + "No rates available
  offline." kept verbatim for the no-cache-and-offline case. With cache present the stale path
  supersedes it (v1 had no stale path at all — see changes).
- [x] **Offline/stale path (new, Batch B mandate)** — cache back-dated 24 h, all http(s) aborted,
  reload: board renders from stale cache with status "Offline — cached from 12:27 PM Jul 14 ·
  Rates as of 2026-07-15 · European Central Bank via Frankfurter", trend renders with
  "Offline — trend cached from 12:27 PM Jul 14." (offline-stale.png).

## changes beyond the recipe

- **TTL 12 h -> 24 h and no unconditional refetch.** v1 painted a <12 h cache instantly and then
  *always* refetched. v2 uses `Suite.fetchJSON` with `cacheTtlMin: 1440` (ECB publishes once per
  business day): a fresh cache serves with no request. Policy-mandated (API-AND-RELAY.md §2).
- **Trend requests now cached** (`suite.cache.currency.trend.<CODE>`, same 24 h TTL) — v1 fetched
  the trend uncached on every click. Policy-mandated; rendering unchanged.
- **Stale-serve added.** v1 ignored caches older than 12 h and showed a hard error offline.
  v2 serves stale with a visible "Offline — cached from <time>" status prefix and an
  "Offline — trend cached from <time>." note under the chart — never pretending stale is fresh.
- **Cache value kept in the v1 shape.** `Suite.fetchJSON` caches the raw response, so after a
  live fetch the tool rewrites `suite.cache.currency.latest` to v1's normalized
  `{rates, date, source}` (verified in localstorage.json: v2's envelope starts `{"rates":...`).
  `normalizeLatest()` also accepts both raw API shapes defensively.
- **Trend point values coerced** (`+data.rates[d][code]`, `isFinite` filter instead of `!= null`)
  so all chart math is provably numeric before interpolation into the SVG string. Identical
  rendering for real API data.
- **`aria-pressed` on board cards** reflects the selected currency (a11y-exempt addition).
- **Style-diff neutralizers:** `.topbar .theme-btn { float:none }` (same as convert.html — v1's
  button is a flex child, core adds an inert float) and `.card { display:block;
  flex-direction:row; gap:normal; ... }` restoring v1's block card against core's flex `.card`.
  Computed-style diff is now clean except the pre-approved `-webkit-font-smoothing`.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via Suite.theme) |
| `suite.cache.currency.latest` | yes — `{t, v:{rates,date,source}}` | yes — same key, same value shape (rewritten normalized after fetch) |
| `suite.cache.currency.trend.<CODE>` | no | new — policy-mandated trend caching (explains `keysOnlyInV2`: trend.EUR, trend.GBP) |

`keysOnlyInV1` is empty. A v1 user's cache is read by v2 (`normalizeLatest` handles the v1
shape), and v2's rewritten cache remains readable by v1.

## escape allowlist requests

All expressions interpolated directly into `.innerHTML` template literals are wrapped in
`Suite.esc()` (board, selects, converter result, trend errors) — no requests there. The trend
SVG is built in a plain string variable `g` assigned once via `svg.innerHTML = g`; if the
heuristic reaches into it, these are the unescaped expressions, all provably local:

- `${padL}`, `${W-padR}`, `${yy}`, `${(+yy+3).toFixed(1)}`, `${x(i).toFixed(1)}`,
  `${x(0).toFixed(1)}`, `${x(n-1).toFixed(1)}`, `${y(pts[n-1].v).toFixed(1)}`, `${H-padB+16}`,
  `${line}`, `${area}` — arithmetic on local layout constants and `Number`-coerced points;
  `toFixed` output is `[0-9.-]` only.
- `${grid}`, `${muted}`, `${col}` — `getComputedStyle` values of this document's own CSS
  variables, not remote data.
- `${fmtRate(v)}` (axis labels) — `v` is `lo+(hi-lo)*k/4` over `Number`-coerced rate values;
  `toLocaleString`/`toFixed` of a finite number.

Remote-derived strings in the SVG (the API's date keys) go through `esc(fmtD(...))`, as in v1.

## a11y applied

- `Suite.liveRegion()` on `#status` (fetch state), `#convResult` (conversion result),
  `#trendNote` and `#trendErr` (trend summary / errors). Deliberately NOT on `#board`: it
  re-renders wholesale on every selection click and a polite region there would re-announce
  twelve cards each time.
- Icon-only buttons: `#swapBtn` already had `aria-label="Swap"` (v1); theme button labeled +
  `aria-pressed` by core `Suite.theme.init()`.
- Inputs: `#amt`, `#from`, `#to` all had `<label for>` in v1 — kept.
- Board cards are real `<button>`s (keyboard path exists); added `aria-pressed` so the selected
  currency is exposed to AT, not just via the `.sel` border.
- Enter-submits: not applicable — the converter live-updates on input/change; there is no
  text-entry + button pair.
- No overlays, so no Esc handling needed.

## endpoints

Every host the tool can contact, all JSON fetches via `Suite.fetchJSON`:

- `https://api.frankfurter.dev` — `/v1/latest?base=USD` (board/converter) and
  `/v1/<start>..<end>?base=USD&symbols=<CODE>` (30-day trend). In CATALOG.md: present.
- `https://open.er-api.com` — `/v6/latest/USD`, fallback when Frankfurter fails
  (attribution rendered in status + footer, as v1). In CATALOG.md: present.

No image hosts. `cacheTtlMin: 1440` — daily-stats class (ECB reference rates are published once
per business day; API-AND-RELAY.md §2).

## concerns for the reviewer

- **The er-api fallback path was not live-exercised.** Frankfurter answered during the run, and
  forcing a frankfurter-only failure against the live er-api would be a synthetic extra hit.
  The fallback fetch itself is proven reachable in the offline test (it is attempted and
  aborted), and `normalizeLatest` handles the raw er-api shape, but no live er-api response was
  rendered end-to-end. If you want it proven, one targeted run with only
  `api.frankfurter.dev` routed to abort would do it.
- **TTL semantics changed** (12 h paint-then-always-refetch -> 24 h no-refetch-when-fresh). Users
  now see up-to-24-h-old rates without a network hit. Policy-mandated, and consistent with the
  data actually changing once per business day, but it is a real behavior difference from v1.
- **`keysOnlyInV2`: `suite.cache.currency.trend.EUR/.GBP`** — the policy-mandated trend cache;
  v1 never wrote these. No v1 key is missing.
- The stale screenshot shows the GBP card with an accent border — that is v1's own `.fx:hover`
  style (the harness mouse rests where it clicked GBP before the reload), not a selection bug;
  EUR is the selected card.
- v1's status line built `esc(v.date)` into a string assigned via `textContent` (double-escape
  would have shown literals for entity-bearing dates); v2 drops the redundant `esc` in the
  `textContent` assignment — identical output for real dates (`YYYY-MM-DD`).
## Phase 4 a11y audit (2026-07-16)

Re-verification of the QUALITY.md §2 checklist, executed against the running tool from
`file://` with `tests/phase4-a11y-net.mjs` — all network route-fulfilled from shape-matched
payloads behind a catch-all abort (zero live requests during the audit). Machine log:
`phase4-a11y.json` in this directory. Verdict: **pass-as-was**.

| checklist item | verdict | evidence |
|---|---|---|
| 1. icon-only controls have accessible names | pass | `button#swapBtn.swap` text="\u21c4" -> aria-label="Swap" |
| 2. async result regions carry aria-live | pass | `#status` -> `aria-live=polite`; `#convResult` -> `aria-live=polite`; `#trendNote` -> `aria-live=polite`; `#trendErr` -> `aria-live=polite` |
| 3. keyboard path for every mouse path | pass | primary flow driven keyboard-only (log below); no positive tabindex; no traps |
| 4. inputs labelled | pass | `input#amt[text]` (label[for]); `select#from[select-one]` (label[for]); `select#to[select-one]` (label[for]) |
| 5. contrast AA, both palettes | pass* | measured table below; remaining failures are suite-palette pairs (flagged, not fixable locally) |
| 6. visible focus indicator | pass | Tab-focus on `button.fx `: `solid 2px rgb(47, 111, 106)` vs blurred `none 3px rgb(35, 40, 46)` |

### Keyboard-only drive of the primary feature (page.keyboard only)

- KEYBOARD: amount typed -> result: 250 USD = 215.5 EUR 1 USD = 0.8620 EUR
- KEYBOARD: 'to' select arrowed -> GBP -> result: 250 USD = 185.5 GBP 1 USD = 0.7420 GBP
- KEYBOARD: swap via Enter -> from=GBP to=USD
- KEYBOARD: board button Enter -> trend switched: GBP · 30-day trend

### Contrast measurements (computed from getComputedStyle, ancestor-composited backgrounds)

Light palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| #status | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| #convResult | `#23282e` | `#fffdf9` | 14.61 | 3 | pass |
| #convResult small | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .fx .code | `#23282e` | `#fffdf9` | 14.61 | 4.5 | pass |
| .fx .name | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .fx .rate | `#23282e` | `#fffdf9` | 14.61 | 4.5 | pass |
| #trendNote | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .errbox (probe) | `#b23b3b` | `#fffdf9` | 5.77 | 4.5 | pass |
| .swap | `#23282e` | `#fffdf9` | 14.61 | 4.5 | pass |

Dark palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| #status | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| #convResult | `#e7e5e0` | `#1d2026` | 12.96 | 3 | pass |
| #convResult small | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .fx .code | `#e7e5e0` | `#1d2026` | 12.96 | 4.5 | pass |
| .fx .name | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .fx .rate | `#e7e5e0` | `#1d2026` | 12.96 | 4.5 | pass |
| #trendNote | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .errbox (probe) | `#e0736b` | `#1d2026` | 5.31 | 4.5 | pass |
| .swap | `#e7e5e0` | `#1d2026` | 12.96 | 4.5 | pass |

### Suite-wide contrast failures — flagged, NOT fixed locally (core palette)

- Light `--muted` `#6b7280` on `--bg` `#f5f3ee` = **4.36:1** (needs 4.5) — affects: `#status`, `header .tag`.
- Same pair passes in dark (6.8:1). A ~one-step darker light `--muted` (e.g. `#61686f`, 4.9:1 on `--bg`) would clear every instance suite-wide; decision belongs to the orchestrator, not this tool.

### Verification

- not modified — no re-run required (Batch B evidence stands).
