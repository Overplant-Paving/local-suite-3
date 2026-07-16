# marine.html — migration report (Batch B)

## v1 feature walk-through

- [x] **First-run card when no location** — verified: clean boot shows `#firstrun`, app hidden
  (interaction.txt line 1; v1/v2 screenshots both themes show this state, pixel-matched).
- [x] **ZIP validation** — typed "12" -> "Enter a 5-digit US ZIP code." rendered in `#frErr`
  (interaction.txt line 2).
- [x] **ZIP lookup via zippopotam.us** — live: 90012 -> `suite.location`
  `{"lat":34.0614,"lon":-118.2385,"label":"Los Angeles, CA 90012"}` (line 4). Enter key submits
  (interact() submitted via Enter, not the button). v1's 404->"Couldn't find that ZIP." semantics
  survive: `Suite.fetchJSON` breaks its retry loop on 404 and, with no cache for that ZIP,
  throws — same catch path as v1.
- [x] **Geolocation button** — code path preserved verbatim (raw `navigator.geolocation`, error
  message unchanged); not live-driven (headless has no geo permission), verified by inspection.
- [x] **Live marine fetch (marine-api.open-meteo.com)** — wave height 2.1 ft "Slight",
  period 10 s from WSW (240°), swell 1.4 ft 5 s from W rendered from a real response
  (interaction.txt lines 6-8; response cached under `suite.cache.marine.34.061,-118.239.marine`).
- [x] **Live wind fetch (api.open-meteo.com)** — 8 kn from SW, gust 9 (line 9).
- [x] **Sea-surface temperature tile** — 72°F "modeled SST" live (line 10) — via the marine API,
  see "changes beyond the recipe": v1's forecast-API source for SST is dead-at-source.
- [x] **Sea-state descriptor + compass + rotated direction arrows** — visible in tiles output.
- [x] **3-day wave chart (SVG)** — 2 paths (area+line), 8 lines (gridlines, day dividers,
  now-line), 7 texts (line 11); visually verified in v2-after-interaction.png.
- [x] **Chart re-render on theme flip** — the harness's theme-toggle probe ran after interact;
  v2-after-interaction.png shows the chart correctly recolored in dark theme (colors are baked
  from CSS vars, so this proves the re-render hook fired).
- [x] **Nearest NDBC buoy link-out** — Santa Monica Basin #46025 ~52 mi,
  `https://www.ndbc.noaa.gov/station_page.php?station=46025` target=_blank rel=noopener
  (lines 12-13). BUOYS table byte-identical to v1.
- [x] **Inland state** — code path preserved verbatim (`waveH==null && swH==null` -> inland card);
  not live-driven (LA seed is coastal per the batch notes), verified by inspection + the live
  proof that the non-inland branch renders.
- [x] **Partial-failure "Wave model note" card** — preserved verbatim; both sources succeeded
  live so the allSettled failure branch was inspected, not driven.
- [x] **Offline / stale-cache path** — caches aged 24 h, network blocked, reload: amber stale dot,
  "cached 3:16 PM", all 5 tiles + chart + buoy card rendered from cache (lines 17-19,
  offline-stale.png). Never pretends stale is fresh.
- [x] **Error card (no cache, no network)** — preserved verbatim (`Couldn't load marine data` +
  esc'd message); the offline test exercised the *with-cache* branch, the no-cache branch throws
  through the identical v1 catch.
- [x] **"change" button -> first-run** — verified (line 15); reload restores the app from the
  fresh cache with no refetch (line 16).
- [x] **Refresh on tab focus (>10 min)** — preserved verbatim; `data.when` is set to the oldest
  payload timestamp so a stale render still triggers a retry on next focus, matching v1's
  cached-`when` behavior.
- [x] **Theme toggle persists `suite.theme`** — light->dark, aria-pressed=true (line 20).
- [x] **Footer attribution incl. NDBC explanation** — byte-identical text.

## changes beyond the recipe

1. **SST moved from the forecast API to the marine API (functional fix, evidence-backed).**
   v1 requested `hourly=sea_surface_temperature` from `api.open-meteo.com/v1/forecast`. Verified
   Jul 15 2026: that variable now returns **all-null with units "undefined" at every point
   tested** (downtown LA, Hermosa Beach, Catalina, Key West, Nantucket) — it is recognized (a
   bogus variable name 400s) but never populated. So v1's water-temp tile is permanently
   "not modeled here" — a silently dead feature, and "water temp" is in the hub description.
   `marine-api.open-meteo.com` serves real SST for the same snapped ocean cell
   (70-72°F at LA during verification). v2 adds `sea_surface_temperature` +
   `temperature_unit=fahrenheit` to the marine request and drops the dead `hourly=` clause from
   the forecast request (now current-wind only). A fallback still reads
   `wx.hourly.sea_surface_temperature` if ever present. Consequence for the evidence: v1 vs v2
   *post-fetch* renders differ in that one tile (v1 "— / not modeled here", v2 "72°F / modeled
   SST") — a justified content difference, not a style drift.
2. **Per-request caching replaces v1's single combined cache entry** (same reshaping the tides
   migration did): v1 wrote one `suite.cache.marine.<lat,lon>` envelope containing both
   responses and only read it when *both* fetches failed. v2 routes each fetch through
   `Suite.fetchJSON` (`.marine`, `.wx` sub-keys), which also means one source failing no longer
   poisons the cache for the other, and adds the policy-mandated 30-min TTL (v1 always refetched
   on load; its cache was fallback-only).
3. **ZIP lookup now cached** (`suite.cache.marine.zip.<zip>`, same TTL) — the Batch B
   "v1 didn't cache it -> add caching" rule. Note: the weather.html pilot predates this rule and
   leaves its zippopotam call uncached; flagging the divergence for the reviewer.
4. `encodeURIComponent()` around the buoy id in the NDBC href (defense-in-depth on a local
   constant; rendering identical).
5. Dead local variable `lastDay` in the chart function dropped.

## localStorage keys

| | v1 | v2 |
|---|---|---|
| theme | `suite.theme` (bare string) | same, via Suite.store |
| location | `suite.location` (JSON `{lat,lon,label}`) | same, byte-identical value proven in localstorage.json |
| cache | `suite.cache.marine.<lat,lon>` (combined) | `suite.cache.marine.<lat,lon>.marine`, `...<lat,lon>.wx`, `...zip.<zip>` |

`keysOnlyInV1` / `keysOnlyInV2` are exactly the cache-key reshaping above (changes 2-3) —
same `suite.cache.marine.` prefix, same `{t,v}` envelope, covered by the manifest's
`suite.cache.marine.*` pattern. No user data (theme/location) renamed or lost; a v1 user's
orphaned combined-cache entry is inert (30 min of value at most).

## escape allowlist requests

All remote-data interpolations into `innerHTML` are either `Suite.esc()`'d (`e.message`,
`data.marineErr`, `buoy.b.n`, `buoy.b.id`) or provably-safe under the tightened `val()` helper,
which now coerces with `Number()` and returns only finite numbers or null (v1's `isNaN` check
let numeric *strings* through). Requesting allowlist for:

- `${waveH!=null?waveH.toFixed(1):"—"}`, `${waveP!=null?waveP.toFixed(0)+" s":"—"}`,
  `${swH!=null?swH.toFixed(1)+" ft":"—"}`, `${swP!=null?swP.toFixed(0)+" s":""}` —
  `Number.prototype.toFixed` on val()-coerced finite numbers yields digit strings only.
- `${Math.round(waveD)}`, `${Math.round(windS)}`, `${Math.round(gust)}`, `${Math.round(sst)}`,
  `${Math.round(buoy.d)}` — `Math.round` returns a primitive number.
- `rotate(${waveD}deg)` / `rotate(${windD}deg)` (style attr) — null-checked finite numbers from
  `val()`; cannot contain quote/angle characters.
- `${compass(waveD)}`, `${compass(windD)}`, `${compass(swD)}` — lookup into a fixed 16-entry
  local array, returns only those literals.
- `${waveH!=null?seaState(waveH):...}`, `${sst!=null?"modeled SST":"not modeled here"}` and the
  other ternary string literals — fixed local strings.
- `drawWaveChart` builds `svg.innerHTML` from `toFixed()` digits, `getComputedStyle` color values
  (browser-normalized, local), and `toLocaleDateString(...,{weekday:"short"})` (browser-generated
  weekday token) — no remote strings enter the SVG.

## a11y applied

- `aria-label="US ZIP code"` on `#zipIn` (was placeholder-only).
- `aria-hidden="true"` on the decorative `#statusDot` and on the rotated `.dir` arrow spans
  (the adjacent text already says "from WSW (240°)").
- `Suite.liveRegion()` on `#content`, `#updated`, and `#frErr` (async result + error containers).
- Enter submits the ZIP field (v1 already had this; verified live by submitting via Enter).
- Theme button label/pressed state from core (`aria-pressed` flip verified).
- Chart SVG keeps v1's `role="img" aria-label="Wave height forecast"`.
- Keyboard path: all controls are real `<button>`/`<input>`/`<a>` elements; no overlays exist
  (first-run is a view swap, not a modal), so no Esc handling is needed.

## endpoints

- `https://marine-api.open-meteo.com` — waves + SST (CATALOG.md line 85 ok, CORS ok proven live).
- `https://api.open-meteo.com` — current wind (in CATALOG; `*.open-meteo.com` row + weather
  alternates line).
- `https://api.zippopotam.us` — first-run ZIP lookup (in CATALOG).
- `www.ndbc.noaa.gov` — **navigation link-out only** (`<a target="_blank">`), never fetched, so
  it is deliberately *not* in the manifest endpoints (CSP connect-src/img-src don't govern link
  navigation). MIGRATION row 29 confirmed: v1 shipped **zero** NDBC fetch code or placeholders —
  only the embedded 28-buoy table for nearest-buoy ranking, the link-out card, and honest footer
  text. Nothing produces a broken/silent state; v2 preserves exactly that.

**cacheTtlMin: 30** — justification: Open-Meteo's wave model itself only updates a few times a
day and SST is similarly slow-moving, so the weather-class 10-min TTL would triple request volume
for no fresher data; the one fast-moving datum is current wind (15-min model steps), for which
30 min still keeps a marine-planning page honest. 60 would make the wind reading noticeably
stale. v1's own focus-refresh threshold (10 min, kept) still governs how eagerly the tool
*checks*; the TTL governs how often a check hits the network.

## concerns for the reviewer

1. **The SST source change (change #1) is a behavior fix, not a pure port.** I judged it
   required by "no behavior removed" — as shipped today, v1's SST tile can never show data —
   but it does alter a request URL and one tile's output vs a v1 side-by-side. If you'd rather
   ship byte-parity first, reverting is one line each in `marineURL`/`wxURL` and the SST fix
   becomes a follow-up.
2. **Cache-key reshaping** (combined -> per-request) means a v1 user's existing marine cache
   entry is not read by v2 — worst case one extra fetch on first open, and the orphan entry
   lingers until manually cleared. Identical trade to the accepted tides migration.
3. **interaction.txt shows 4 `net::ERR_FAILED` console errors** — these are the deliberately
   aborted requests of the offline test (2 sources x 2 tries); the harness classifies them as
   non-hard and exits 0. No other console output.
4. The zippopotam cache addition (change #3) diverges from the weather.html pilot, which leaves
   its ZIP lookup uncached — suggest deciding suite-wide which way Batch B tools should go.
5. Not live-verified: geolocation button (headless), inland card, no-cache error card — all
   preserved verbatim from v1 and inspected; the surrounding branches were live-driven.
## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks against tools/marine.html from file:// in both themes, Open-Meteo marine/forecast +
zippopotam route-fulfilled with fixtures; raw measurements in [a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | zero symbol-only buttons/links (📍/🛟 emoji sit inside labeled text; direction ↑ arrows are `aria-hidden` beside compass text) |
| 2 | aria-live on async containers | pass | `#content`, `#updated`, `#frErr` are `Suite.liveRegion` |
| 3 | Keyboard paths | pass | first-run driven keyboard-only: Tab→ZIP input, 90012 + Enter renders the tile dashboard |
| 4 | Input labels | pass | `#zipIn` has `aria-label="US ZIP code"` |
| 5 | Contrast, both palettes | **fixed** | all four tile accents pass 3:1 as large text in both themes (wave 4.0, swell 5.85, wind 4.3, temp 3.4 on the light card; 5.5–7 dark); one fix: `.err` #b0472f = 2.95:1 on the dark card → theme-split `--err` (dark #c2715f, 4.5:1) |
| 6 | Focus visibility | pass | core `:focus-visible` outline confirmed via real-Tab probe |

Suite-wide flag (not fixed locally): `--muted` on `--bg` = 4.36:1 (header tag, meta rows).
No behavior change; re-verified with `node verify-tool.mjs marine` — exit 0, evidence files in this directory regenerated 2026-07-16.

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.btn`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
