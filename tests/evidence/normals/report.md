# normals.html — migration report (Batch B)

## v1 feature walk-through

Every v1 feature, each verified (evidence in `interaction.txt` unless noted):

- [x] **First-run state** — no location, no saved station -> station picker auto-opens over the
  "No station selected" card. Verified: `picker auto-open=true`, content card `"No station
  selected"` (interaction.txt line 1; v1/v2 screenshots show this exact state, both themes).
- [x] **Embedded 54-station table** — byte-identical copy of v1's `STATIONS` array (diffed
  against v1 lines 164–219; harness counted `embedded station rows=54`).
- [x] **Nearest-station auto-select from `suite.location`** — LA seed (34.0522, -118.2437)
  auto-selected Los Angeles Downtown USW00093134 (3 mi, the true haversine nearest), line 2.
- [x] **NCEI normals fetch** (`units=standard`, `dataset=normals-daily`, placeholder year 2010,
  `DLY-TMAX-NORMAL`/`DLY-TMIN-NORMAL`) — URL preserved byte-for-byte from v1; request verified
  live: 366 daily rows, today 07-15 TMAX-NORMAL=83.3°F / TMIN-NORMAL=63.7°F — real °F, not
  tenths, confirming the CATALOG `units=standard` gotcha is honored (line 5).
- [x] **Today's actual conditions** (Open-Meteo forecast: current + today's hi/lo) — live:
  current 89.7°F, forecast hi 92.5 / lo 66 (line 6).
- [x] **Verdict computation** (±1.5° "About normal" band, warmer/cooler wording, sub line) —
  recomputed v1's rule from the raw cached responses: 92.5 - 83.3 = 9.2 -> "9° warmer than
  normal" -> rendered verdict is byte-identical -> **MATCH** (line 7).
- [x] **Five comparison tiles** (Right now / Today's high / Normal high / Today's low /
  Normal low) — all populated with live values (line 4).
- [x] **Year chart** (hi/lo band + two lines, gridlines, month initials, dashed today marker,
  today hi/lo dots) — 3 paths, 2 circles, 17 axis texts (line 8); visible in
  `v2-after-interaction.png` and `offline-stale.png`.
- [x] **Chart re-draw on theme flip** (v1's `themeBtn.onclick` re-render) — preserved via a
  second listener on `#themeBtn` after `Suite.theme.init()`; `v2-after-interaction.png` (taken
  after the harness's theme toggle) shows the chart in the dark palette.
- [x] **Station picker: nearest list** (top 4 by distance when a location exists) — LA Downtown
  3 mi · LAX 11 mi · San Diego 110 mi · Las Vegas 223 mi (line 11).
- [x] **Station picker: full list sorted by state then name** — screenshots (AK, AK, AZ, CA…).
- [x] **Row click loads station** — San Diego row -> live NCEI fetch, "11° warmer than normal"
  (line 14).
- [x] **Manual GHCND ID entry + validation** — bad ID "xyz" -> v1's exact error text (line 12);
  valid ID USW00023174 loaded (line 15). Enter key submits (v1 listener kept).
- [x] **Esc / backdrop-click / Cancel close the picker** — Esc verified (line 13); the other two
  handlers converted 1:1 from v1.
- [x] **Open-Meteo archive (ERA5) fallback when NCEI unreachable** — forced live by blocking
  only ncei.noaa.gov: computed 1991–2020 climatology (366 MM-DD entries, today hi/lo
  80.4/63.0°F), ERA5 footer attribution, verdict rendered (lines 15–17). The computed
  climatology is cached at v1's key `suite.cache.normals.archive.33.94,-118.39` with v1's
  90-day window.
- [x] **Error states** — no-coords NCEI failure card and double-failure card kept verbatim
  (code paths unchanged; not triggerable live without faking, see concerns).
- [x] **Status dot** (ok / stale / err) + **updated line** + **footer source note** — ok +
  "updated 3:18 PM" live (line 10); stale + offline line on the offline path (line 21).
- [x] **Saved station persists** (`suite.normals.station`) — reload during the stale test
  re-loaded San Diego from storage (lines 18–21).
- [x] **Stale-cache offline path** (Batch B DoD) — caches aged 8 days (the addendum's 24 h is
  still fresh under this tool's 7-day TTL), all network blocked, reload: normals render from
  the stale cache with "offline — cached from 3:18 PM Jul 7", stale status dot, and the actual
  tiles honestly "—" with v1's "Today's temperature couldn't be fetched." sub (lines 19–21,
  `offline-stale.png`).

## changes beyond the recipe

- **NCEI response now cached (policy-mandated, API-AND-RELAY.md §2).** v1 wrote a *write-only*
  assembled `{station, normals, actual}` envelope at `suite.cache.normals.<stationId>` and never
  read it back (its only `cacheGet` call was for the archive key). v2 routes the NCEI fetch
  through `Suite.fetchJSON` with `cacheKey: "normals.<stationId>"` — the **same key** — so the
  raw row array is cached (7-day TTL) and serves the stale/offline path. A legacy-shape guard
  clears a v1 envelope on that key before fetching so it is never served as a row array (no
  regression: v1 never used it).
- **Open-Meteo actual now cached (policy-mandated).** v1 fetched it uncached on every load; v2
  uses `cacheKey: "normals.actual.<lat2>,<lon2>"`, 10-minute weather-class TTL, and
  `fallbackToCache: false` — a stale "Right now" must not render as current; on failure the v1
  null path ("—" tiles + "couldn't be fetched" verdict) runs exactly as before.
- **Archive fetch goes through `Suite.fetchJSON` as transport only** (no `cacheKey`): the raw
  response is 30 years of daily data (~300 KB); v1 deliberately cached the small *computed*
  climatology instead at `suite.cache.normals.archive.<lat>,<lon>` with a 90-day window — that
  key, shape, and window are kept byte-identical.
- **`tries: 2` on the NCEI fetch** (v1 had no retry): NCEI is the least reliable NOAA API
  (CATALOG); one polite retry before falling back to ERA5, mirroring the canonical
  weather.html's use of `tries`.
- **"offline — cached from <time [date]>" updated-line** for the stale path (new state — v1 had
  no offline rendering at all, it just failed through to the archive/error paths). Wording
  follows the weather.html pattern; date is appended only when not today.
- **cacheTtlMin: 10080 justification** — 1991–2020 normals are static reference data (fixed
  until the 2030s normals release), so the 7-day reference-class TTL applies; the
  current-conditions side-fetch uses its own 10-minute weather-class TTL, and the archive
  fallback keeps v1's 90-day computed cache.
- Tool-local CSS overrides where core defaults differ from this tool's v1: pill-style `.back`,
  `float:none` on the topbar `.theme-btn`, block-layout `.card` (core's is a flex column), and
  the tighter v1 footer (2.5rem/.82rem/1rem). Verified by the computed-style diff: only
  `-webkit-font-smoothing` (pre-approved) and the focus-ring lines explained below remain.

## localStorage keys

| Key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | unchanged (via `Suite.store`) |
| `suite.location` | JSON `{lat,lon,label}` | unchanged (via `Suite.location`) |
| `suite.normals.station` | JSON station object | unchanged, byte-identical serialization |
| `suite.cache.normals.<stationId>` | `{t, v:{station,normals,actual,srcNote,when}}` — write-only, never read | `{t, v: <raw NCEI rows>}` — written and read by `Suite.fetchJSON` (same key, `{t,v}` envelope; legacy shape cleared on first v2 load) |
| `suite.cache.normals.archive.<lat>,<lon>` | `{t, v: computed climatology}`, 90-day window | unchanged, byte-identical |
| `suite.cache.normals.actual.<lat>,<lon>` | — (v1 didn't cache this fetch) | new, policy-mandated caching |

Harness verdict (`localstorage.json`): `keysOnlyInV1: []`;
`keysOnlyInV2: [3x suite.cache.normals.actual.*, suite.cache.normals.archive.33.94,-118.39]` —
the `actual.*` keys are the policy-added cache above; the `archive.*` key appears only in v2
because the ERA5 fallback was live-exercised only on the v2 run (blocking NCEI in `v1Interact`
would have doubled the heavy archive fetch for no parity gain — v1 writes the identical key
when its fallback runs, same code path). All are inside the declared
`suite.cache.normals.*` manifest pattern.

## escape allowlist requests

All remote data interpolated into `innerHTML` is `Suite.esc()`'d (verdict, sub, error messages,
and the five comparison-tile values — the tile numbers are `Math.round()` outputs but were
wrapped anyway to keep the heuristic quiet). Remaining unwrapped expressions, all provably
local:

- `${vclass}` (render, headline class) — one of the local literals `"warm"|"cool"|"norm"`.
- `${cmp}` (render) — trusted fragment composed two lines above; every interior value escaped.
- `stRow()`: `${s.id}`, `${s.s}`, `${dist!=null?Math.round(dist)+" mi":s.id}` — fields of the
  embedded `STATIONS` constant plus a `Math.round` output; user-typed IDs never flow through
  `stRow` (only `STATIONS.find` results are rendered as rows). `${esc(s.n)}` already escaped.
- `drawYearChart()` (`svg.innerHTML = s` and the `No data` branch): `${high}`, `${low}`,
  `${accent}`, `${line}`, `${muted}` — `getComputedStyle` values of the tool's own CSS custom
  properties; `${pad.l}`, `${W-pad.r}`, `${v}°`, `${MON[m][0]}` and every coordinate — local
  numeric constants / `.toFixed(1)` outputs of parsed floats (remote-derived numbers pass
  through `parseFloat` -> `Number.toFixed`, which cannot yield markup).

## a11y applied

- `aria-label="GHCND station ID"` on `#idIn` (placeholder-only in v1).
- Picker modal: `role="dialog" aria-modal="true" aria-label="Choose a station"`; input focused
  on open (matches the weather.html precedent).
- Station rows (`.st`, mouse-only in v1): `role="button" tabindex="0"` + Enter/Space handler in
  `bindRows()` — keyboard path for every mouse path.
- `Suite.liveRegion()` on `#content`, `#updated`, `#pickErr` (async result/error containers).
- `#statusDot` marked `aria-hidden="true"` (decorative; state is conveyed by the updated line).
- Esc close, Enter-submits-ID, theme-button `aria-label`/`aria-pressed` (core): kept/inherited.
- Style-diff note: the four `.fld input { outline-* }` lines in `computed-style-diff.txt` are
  core's `:focus-visible` ring on the now-auto-focused ID input — the intended a11y outcome,
  visible as the only difference in the first-run screenshots.

## endpoints

- `https://www.ncei.noaa.gov` — normals-daily; in CATALOG §1.9 (with the `units=standard`
  gotcha, honored verbatim; request URL unchanged from v1).
- `https://api.open-meteo.com` — today's current/hi/lo (the "additional current-conditions
  host"). **Not present in CATALOG.md as a literal host** — only the `*.open-meteo.com`
  registry row and other subdomains (air/marine/geocoding) appear.
- `https://archive-api.open-meteo.com` — ERA5 fallback. **Also missing as a literal host** in
  CATALOG.md; same wildcard-only coverage. -> orchestrator: the `--check` CATALOG cross-check
  will likely warn on these two; CATALOG §1.9 could mention both Open-Meteo hosts.

All three verified live in this run (NCEI + forecast on the happy path; archive by blocking
NCEI). No image hosts.

## concerns for the reviewer

1. **Raw NCEI cache is ~72 KB per station** (all response columns), vs v1's ~11 KB write-only
   assembled envelope. Two stations ~= 150 KB of localStorage — well within quota, but a user
   who browses many stations accumulates one 72 KB entry each (keys are per-station and never
   pruned, same growth pattern v1 had for `archive.*`). Accepted for simplicity; a
   row-projection before caching would drop ~85 % of it if it ever matters.
2. **The hub `desc` mentions "records"** ("…normals and records: is this month actually
   unusual?") but v1 implements normals only — no record highs/lows anywhere in v1's code. The
   desc was used exactly as supplied per instructions; parity preserved, nothing added. Flagging
   the desc/feature mismatch as inherited from the v1 hub.
3. **Verdict wording drift by design**: the stale path's `fetchActual` uses
   `fallbackToCache:false`, so offline the tiles show "—" (v1's fetch-failure rendering) rather
   than day-old "current" temps. Deliberate honesty trade-off, documented above.
4. **The addendum's 24 h cache-aging snippet was changed to 8 days** in the interaction module —
   24 h is still fresh under this tool's 7-day normals TTL and would have exercised the
   fresh-from-cache path, not the stale path.
5. **Error-card paths not live-triggered**: the "unknown ID with no coords" and
   "NCEI + archive both failed" cards were code-reviewed 1:1 against v1 but not driven in the
   harness (triggering them would mean hammering NCEI with a bogus ID; the bad-ID *validation*
   path was driven instead).
6. Console shows five `net::ERR_FAILED` resource errors in `interaction.txt` — all from the
   deliberately blocked NCEI/full-network phases; the harness classifies them as soft and the
   tool rendered its fallback/stale states instead of failing.