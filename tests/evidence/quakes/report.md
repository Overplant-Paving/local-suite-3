# quakes.html migration report

> Note: this report was reconstructed from the archived evidence by a finisher agent — the
> migrating agent completed and verified the work but was terminated before writing this file.
> The harness was re-run at reconstruction time (`node verify-tool.mjs quakes`, exit 0), which
> refreshed all evidence in this directory; line numbers below cite the refreshed
> `interaction.txt`.

## v1 feature walk-through

Every v1 feature, verified against the migrated tool (evidence: `interaction.txt`, screenshots in
this directory; harness exit 0):

- [x] **First-run location setup card (ZIP or geolocation)** — rendered when `suite.location`
  is absent (interaction.txt line 1: "first-run setup card visible: true").
- [x] **ZIP lookup via api.zippopotam.us** — live-fetched 90012, wrote
  `suite.location = {"lat":34.0614,"lon":-118.2385,"label":"Los Angeles, CA"}` and re-booted into
  the dashboard (lines 2–3). Same parse of `places[0]` / `place name` / `state abbreviation`
  as v1.
- [x] **ZIP validation error** — code path identical to v1 (`Enter a 5-digit ZIP.` /
  `Couldn't find that ZIP. Try another.` into `#setupErr`); not driven live to avoid a wasted
  request. Enter in the ZIP field submits (kept from v1, `keydown` -> click).
- [x] **Geolocation button** — logic preserved verbatim (Locating… message, denied-error text);
  not exercised (headless has no geolocation grant), same as v1.
- [x] **Live USGS feed fetch (all_day GeoJSON)** — 276 quakes landed in the cache envelope
  (line 4); sample feature parsed correctly (line 5: M3.5 — "51 km ENE of Denali National Park,
  Alaska").
- [x] **Three feeds: all_day / 2.5_week / significant_month** — FEEDS table byte-identical to
  v1; feed switch exercised in the offline segment (lines 25–26) including persistence of the
  choice (`persisted feed = all_day`).
- [x] **Stats row: shown / largest / nearest / new** — all four logged from the rendered DOM
  (lines 6–9: 273 SHOWN, M5.7 LARGEST, 30 km NEAREST, 0 NEW). The NEW stat only appears after
  the first render (`firstRenderDone` gate), exactly as v1.
- [x] **Seen-quake tracking (`suite.quakes.seen`, capped at 600 ids)** — persisted and
  identical in the v1/v2 localStorage dumps (`localstorage.json`).
- [x] **Min-magnitude slider (0–7, step 0.5)** — dragged to 4.5: label "M4.5", shown fell
  273 -> 12, list rows = 12 (lines 17–18). Value persisted to `suite.quakes.minMag`.
- [x] **Max-distance slider (250–20000 km, "anywhere" at 20000)** — dragged to 1000 km of LA:
  label "1000 KM", shown 112, nearest 30 km, list rows = 112 (lines 19–20); distance metadata in
  rows correct under the filter (line 21). Persisted to `suite.quakes.maxDist` (line 22).
- [x] **Quake list (sorted by time desc, capped at 250 rows)** — 250 rows rendered from a
  273-quake result (line 11); first row carries magnitude badge, place link, depth · distance
  meta, and relative + clock time (line 12).
- [x] **Magnitude color badge + USGS-ish 6-band scale** — `magColor()` byte-identical to v1;
  6 legend swatches rendered (line 16).
- [x] **Equirectangular SVG world map: graticule, equator label, dots sized by magnitude,
  home crosshair** — map present (line 13), 273 dots (line 14), home marker = 2 lines + circle
  (line 15). `role="img"` + `aria-label` kept from v1.
- [x] **Per-quake USGS detail link (`target="_blank" rel="noopener"`)** — markup preserved,
  URL escaped (see allowlist section).
- [x] **Tsunami flag** — `q.tsunami` boolean gates the hardcoded red "tsunami" span, verbatim
  from v1 (code inspection; no tsunami-flagged quake in the live feed during the run).
- [x] **Cache-first paint, then network** — instant paint from `suite.cache.quakes.<feed>`
  before the fetch resolves, kept from v1 (now reading the shared `{t,v}` envelope).
- [x] **Data stamp with stale/error states** — fresh: "Data from 3:06 PM" (line 10); offline:
  "· showing cached, retrying · connection issue: offline — showing cached data" (line 23);
  uncached-feed failure keeps the previous data and reports "Failed to fetch" (line 25).
- [x] **Offline resilience** — with the network cut, the cached list (250 rows) and map
  (273 dots) still render (line 24); switching to an uncached feed fails gracefully without
  wiping the display (line 25); switching back to the cached feed recovers (line 26).
- [x] **5-minute auto-refresh + refresh-on-visibilitychange** — `setInterval(load, 5*60*1000)`
  and the `visibilitychange` handler preserved verbatim.
- [x] **"No quakes match" empty state** — v1 message kept verbatim (code inspection; live feed
  never emptied under the tested filters).
- [x] **Theme toggle** — light -> dark, `aria-pressed=true` (line 27), now via
  `Suite.theme.init()`.

## changes beyond the recipe

- **`esc()` is now a real escaper.** v1's local `esc()` was an identity function
  (`String(s==null?"":s)`) — `q.place` and `q.url` from the USGS feed reached `innerHTML`
  unescaped in v1. The migration binds `esc = Suite.esc`, so both remote strings are now
  genuinely HTML-escaped at every interpolation site. Strictly a hardening; rendered output is
  unchanged for benign data.
- **Policy-mandated TTL cache (manifest `cacheTtlMin: 5`).** v1 wrote its own cache and
  *always* refetched on load. v2 routes through `Suite.fetchJSON(url, {cacheKey, ttl: 5min})`:
  within the 5-minute window a reload serves the envelope without a network hit (good-citizen
  interval matching the feed's own refresh cadence); the stale branch surfaces as
  "offline — showing cached data" via `r.stale` (verified, line 23). The stamp now shows the
  envelope's fetch time `r.t` rather than an unconditional `Date.now()` — identical on a fresh
  fetch, honest on a cache-served paint.
- Storage access via `Suite.store` (same keys, same shapes — see below); theme via core;
  inline `on*` handlers converted to `addEventListener`; CSS deduplicated into
  `core/suite.css` + tool-local overrides (the `--ocean` map backdrop kept as a 3-layer
  light/dark/data-theme block, and v1's pill-style `.back` link preserved over core's bare
  link).
- No feature was removed; all rendering logic (`renderData`, `drawMap`, `renderList`,
  `renderStamp`) is line-for-line v1 apart from the points above.

## localStorage keys

From `localstorage.json` (keysOnlyInV1 = [], keysOnlyInV2 = []):

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.location` | yes | yes (identical shape `{lat,lon,label}`) |
| `suite.quakes.feed` | yes | yes |
| `suite.quakes.minMag` | yes | yes |
| `suite.quakes.maxDist` | yes | yes |
| `suite.quakes.seen` | yes | yes (identical id list, 600-cap kept) |
| `suite.cache.quakes.<feed>` | yes (`{t,v}` self-rolled) | yes (same `{t,v}` shape, now written by `Suite.fetchJSON`) |

## escape allowlist requests

Remote strings that reach `innerHTML` are escaped: `${esc(q.place)}` (map `<title>` and list
row), `${esc(q.url)}` (list-row `href`). The following interpolations lack `Suite.esc()` and are
requested for the allowlist:

- `${k}`, `${k===state.feed?" selected":""}`, `${v.label}` (renderShell `feedOpts`) — keys and
  labels of the hardcoded `FEEDS` constant.
- `${state.minMag}`, `${state.maxDist}` (renderShell) — `parseFloat()` results; can only be a
  number or `NaN`.
- `${shown.length}`, `${newCount}` (stats) — array lengths.
- `${largest>-Infinity?"M"+largest.toFixed(1):"—"}` (stats) — `toFixed` of a number or a literal.
- `${loc&&shown.length&&shown.some(q=>q.dist!=null)?Math.round(Math.min(...shown.filter(q=>q.dist!=null).map(q=>q.dist)))+" km":"—"}` (stats) — `Math.round` output or a literal.
- `${firstRenderDone?`<div class="stat"><b>${newCount}</b><span>new</span></div>`:""}` (stats) — boolean-gated hardcoded markup.
- `${x}`, `${y}`, `${(py(0)-4).toFixed(1)}`, `${W}`, `${H}` (drawMap graticule/viewBox) — `toFixed` strings and the 980/490 constants.
- `${cls}` (drawMap) — one of two literals, `"grat"`/`"grat eq"`.
- `${px(q.lon).toFixed(1)}`, `${py(q.lat).toFixed(1)}`, `${r.toFixed(1)}`, `${op}` (drawMap dots) — remote coordinates forced through arithmetic + `toFixed` (numeric strings only), `isFinite`-guarded.
- `${magColor(q.mag)}` / `${col}` (dot fill, badge background) — returns one of seven hardcoded hex literals for any input.
- `${q.mag!=null?q.mag.toFixed(1):"?"}` / `${magTxt}` (dot title, badge) — `toFixed` of remote number or `"?"`.
- `${hx-6}`, `${hx+6}`, `${hy-6}`, `${hy+6}`, `${hx}`, `${hy}` (home marker) — arithmetic on trusted `suite.location` floats.
- `${l}`, `${c}` (legend) — hardcoded label/hex pairs.
- `${g}`, `${dots}`, `${home}`, `${legend}` (drawMap assembly) — concatenations of the strings above.
- `${isNew?" new":""}`, `${isNew?`<span class="newtag">NEW</span>`:""}` (list row) — boolean-gated literals.
- `${meta}` (list row) — join of `Math.round(...)` depth/distance numeric strings and literals.
- `${tsu}` (list row) — boolean-gated hardcoded span.
- `${relTime(q.time)}` (list row) — arithmetic on the remote timestamp; output is always `"<n>s|m|h|d ago"`.
- `${new Date(q.time).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}` (list row) — browser-generated locale string from a number-coerced date.

No unescaped remote interpolation was found; no defect to fix.

## a11y applied

(from the v1 -> v2 diff)

- Setup ZIP input given `aria-label="US ZIP code"` (was placeholder-only).
- Control labels wired to their inputs: `for="feedSel"`, `for="minMag"`, `for="maxDist"` (v1
  labels were bare).
- `Suite.liveRegion()` on `#stats`, `#stamp`, and `#setupErr` — filter results, data-freshness /
  connection status, and setup errors are announced.
- Theme button `aria-pressed` state via core (verified true after toggle, interaction.txt
  line 27).
- Map SVG `role="img"` + `aria-label="World map of recent earthquakes"` already in v1 (kept).
- Enter in the ZIP input submits (kept from v1).

## endpoints

Fetched hosts in the source, cross-checked against `manifest-entry.json` and CATALOG.md:

- `https://earthquake.usgs.gov` — three feed URLs under
  `/earthquakes/feed/v1.0/summary/` (all_day, 2.5_week, significant_month). In the manifest
  `endpoints` array; in CATALOG.md (USGS GeoJSON entry, line 101; CORS table line 501, keyless,
  CORS ✓).
- `https://api.zippopotam.us` — one-off `/us/{zip}` lookup in first-run setup. In the manifest
  `endpoints` array; in CATALOG.md (line 325; CORS table line 542, keyless, CORS ✓).

Manifest sanity check: the two manifest endpoints exactly cover the two fetched hosts — no
extra endpoint listed, no fetched host missing. `cacheTtlMin: 5` matches the tool's
`TTL = 5*60*1000` and the tool's own 5-minute refresh interval. `storage` list matches the keys
table above (with `suite.cache.quakes.*` as the wildcard).

## concerns for the reviewer

- **This report was reconstructed from evidence by a finisher agent** after the migrating agent
  was terminated pre-report. The harness was re-run and passed (exit 0); all claims trace to the
  refreshed evidence or direct source inspection.
- **v1 shipped with a no-op `esc()`** — remote `q.place`/`q.url` hit `innerHTML` raw in v1. v2
  closes this. Anyone diffing rendered output byte-for-byte should know escaping is the one
  intentional behavioral delta on hostile data.
- `q.url` is escaped but not scheme-validated before use as an `href`. It comes from USGS's own
  feed (always an `earthquake.usgs.gov` event page in practice) and v1 was identical; flagging
  only for completeness.
- interaction.txt line 22 reads `persisted filters: feed=null` — not a bug: `suite.quakes.feed`
  is only written on a user feed *change* (v1 identical), and the harness sampled persistence
  before its first feed switch. Line 26 confirms the key persists (`all_day`) once changed.
- In `localstorage.json` the v2 cache envelope's `t` is ~24 h older than v1's — an artifact of
  the harness backdating the envelope to drive the offline/stale rendering test, not a tool
  behavior difference (the fresh-run stamp on line 10 shows the true fetch time).
- The three `net::ERR_FAILED` console errors in interaction.txt are the deliberately
  route-aborted fetches of the offline test segment; the harness filters these and exited 0.
- Computed-style diff (24 values per theme) is entirely `-webkit-font-smoothing` (core sets
  `antialiased`; v1 had `auto`) and a whitespace-only re-serialization of `--shadow`
  (`,0` vs `, 0`). No geometry, color, or layout deltas.
- Map dots (273) exceed list rows (250) because the list caps at 250 — v1's cap, preserved
  (lines 11, 14).

## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks against tools/quakes.html from file:// in both themes, the USGS feed + zippopotam
route-fulfilled with a 7-quake fixture spanning all magnitude bands; raw measurements in
[a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | zero symbol-only buttons/links |
| 2 | aria-live on async containers | pass | `#stats` + `#stamp` are `Suite.liveRegion` (the designed announcements: counts/largest/nearest and the data/offline stamp); the 250-row `#list` and map are deliberately not live — announcing them wholesale would flood a screen reader. First-run `#setupErr` is live |
| 3 | Keyboard paths | pass | keyboard-only: ZIP + Enter → dashboard; magnitude/distance range sliders respond to arrow keys with live value labels (logged); feed `<select>` native; no overlays |
| 4 | Input labels | pass | `#zip` aria-label; feed/sliders have `<label for=>` |
| 5 | Contrast, both palettes | **fixed** | magnitude badges: white ink failed on the four lighter bands (#6a9e57 3.2, #c9a227 **2.4**, #e08a2e 2.7, #d9622b 3.7) → new `magInk()`: dark #16191d ink below M6 (4.8–7.3:1), white on M6+ (5.3/7.6:1); band colors themselves unchanged. `tsunami` marker #c23b3b = 3.1:1 on the dark card → theme-split `--tsu` (dark #e0685a 4.9:1). `.stamp.err` #c07f2d = 3.1:1 on the light bg → theme-split `--stale` (light #986424 4.5:1); `.err-inline` #c0603a (4.16/3.86) → theme-split `--errsoft` (#b65b37 / #c6704e, both ≥ 4.5:1) |
| 6 | Focus visibility | pass | core `:focus-visible` outline confirmed via real-Tab probe |

Note: map quake dots keep the USGS-ish band colors — magnitude is triple-encoded (dot size,
badge text, list) so the dots are not the sole conveyor. Suite-wide flag (not fixed locally):
`--muted` on `--bg` = 4.36:1. No behavior change; re-verified with `node verify-tool.mjs quakes` — exit 0, evidence files in this directory regenerated 2026-07-16.
