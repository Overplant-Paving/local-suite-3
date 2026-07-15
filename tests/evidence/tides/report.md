# tides.html migration report

> Note: this report was reconstructed from the archived evidence by a finisher agent — the
> migrating agent completed and verified the work but was terminated before writing this file.
> The harness was re-run at reconstruction time (`node verify-tool.mjs tides`, exit 0), which
> refreshed all evidence in this directory; line numbers below cite the refreshed
> `interaction.txt`.

## v1 feature walk-through

Every v1 feature, verified against the migrated tool (evidence: `interaction.txt`, screenshots in
this directory; harness exit 0):

- [x] **Auto-select nearest station from `suite.location` on first run** — with LA seeded, the
  tool booted straight into Santa Monica (9410840), the nearest of the 46 embedded stations
  (interaction.txt line 1: station line "Santa Monica" · "CA · station 9410840").
- [x] **Persisted station (`suite.tides.station`)** — saved on load, identical `{id,n,s,lat,lon}`
  shape in both v1 and v2 dumps (`localstorage.json`).
- [x] **Live CO-OPS fetches: hilo predictions (48 h), 6-min curve (today), water temperature
  (today)** — all three landed live (status dot "ok", "updated 3:06 PM", line 2) and wrote their
  cache envelopes (line 11).
- [x] **Next highs & lows list (up to 8, arrows, heights, day + clock + countdown, "next"
  badge)** — 6 events rendered; first four logged verbatim with correct H/L arrows, feet values,
  Today/Tomorrow labels, and countdowns (lines 3–7); event[0] carries the "next" badge (line 4).
- [x] **Now strip: interpolated current height, trend (rising/falling with arrow), time to next
  event** — "Now2.3 ft Trendfalling ↓ Next lowin 1h 18m" (line 8); interpolation and trend logic
  byte-identical to v1.
- [x] **Today's tide curve SVG (area + line paths, hi/lo markers with time labels, now-line +
  dot, gridlines, hour axis)** — 2 paths, 5 circles, 13 texts (line 9), matching the expected
  area+line + marker composition. Colors baked from computed CSS vars at draw time, as in v1.
- [x] **Chart re-render on theme flip** — v1 called `renderAll(lastData)` inside its own toggle;
  v2 keeps the behavior via a click listener on `#themeBtn` alongside core's toggle (theme
  toggled to dark in the run, line 17, and the dark screenshots show the re-baked palette).
- [x] **Water temperature card (latest non-empty reading, °F, sensor timestamp)** — "70°F as of
  12:54 PM, station sensor" (line 10); the "doesn't report water temperature" fallback is kept
  verbatim (code inspection).
- [x] **Station picker modal: nearest-4 ranked by haversine from `suite.location`** — rows
  "Santa Monica CA 15 mi / Los Angeles (Outer Harbor) CA 23 mi / Santa Barbara CA 86 mi /
  La Jolla (Scripps) CA 100 mi" (line 12) — correct distance ordering.
- [x] **Full popular-station list sorted by state then name** — sort logic verbatim; 46-entry
  embedded STATIONS table byte-identical to v1 (diff-checked).
- [x] **Manual station-ID entry (6–8 digit validation, unknown IDs become "Station <id>")** —
  code path identical to v1, including the `pickErr` validation message; not driven live to
  avoid a wasted request against an arbitrary station.
- [x] **Picker close paths: Cancel button, backdrop click, Escape** — Esc verified (line 13:
  backdrop open = false); the other two handlers preserved verbatim.
- [x] **Offline / cache fallback** — offline reload rendered from cache: status dot class
  "statusdot stale" (line 14), updated text "cached 3:06 PM" (line 15), all 6 events still
  rendered (line 16).
- [x] **Error state ("Couldn't load this station", http.server hint)** — kept verbatim,
  message still `esc()`d; reached only when no cache exists (code inspection).
- [x] **Footer datum/zone caveats, MLLW, LST/LDT parsing (`parseLST`)** — unchanged from v1.
- [x] **Theme toggle** — light -> dark, `aria-pressed=true` (line 17), via `Suite.theme.init()`.

### Required change: `application=local-suite` on every CO-OPS request — CONFIRMED

All three request URLs are built from the single shared query string
`base = "station=...&units=english&time_zone=lst_ldt&format=json&application=local-suite"`
(tools/tides.html line 240, flagged in-source with the API-AND-RELAY.md §2 good-citizen
comment), and `hilo`, `curve`, and `temp` each interpolate `${base}` (lines 242–244). There is
no other fetch in the file, so every CO-OPS request carries `application=local-suite`. (v1
already sent this parameter; v2 preserves it and documents why.)

## changes beyond the recipe

- **Per-request TTL cache envelopes (manifest `cacheTtlMin: 60`).** v1 cached the whole
  combined payload as one `suite.cache.tides.<id>` blob, written only after a fully successful
  load and read only in the catch block. v2 routes each of the three requests through
  `Suite.fetchJSON(url, {cacheKey: "tides.<id>.{hilo|curve|temp}", ttl: 60min, tries: 2})`, so
  each product falls back to stale independently (e.g. a temp-sensor outage no longer risks the
  predictions' freshness accounting). The "updated"/"cached" stamp now uses the oldest envelope
  `t` and any-stale detection (`anyStale`), verified in the offline segment (lines 14–16).
- **Remote `e.type` no longer reaches markup raw.** v1 interpolated the CO-OPS `type` field
  directly into a class attribute (`class="arrow ${e.type}"`). v2 normalizes it to a local
  boolean first (`const isHigh = e.type === "H"`) and interpolates only literals — the
  in-source comment marks this. Defensive hardening; rendered classes are identical for valid
  data.
- `esc = Suite.esc` replaces v1's local div-textContent escaper (same semantics); `stationRow`
  additionally escapes `s.id` and `s.s`, which v1 interpolated raw (embedded local data —
  purely defensive).
- Storage via `Suite.store` (JSON handled by core; same keys apart from the cache split, see
  below); inline `on*` handlers converted to `addEventListener`; CSS deduplicated into
  `core/suite.css` + tool-local overrides (`--tide/--high/--low/--water` kept as a 3-layer
  block; v1's pill `.back` link and flexbox theme-button placement preserved against core
  defaults).
- No feature was removed; `renderAll`, `drawChart`, and the picker logic are line-for-line v1
  apart from the points above (plus the a11y additions below).

## localStorage keys

From `localstorage.json`:

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.location` | yes | yes (identical shape `{lat,lon,label}`) |
| `suite.tides.station` | yes | yes (identical shape `{id,n,s,lat,lon}`) |
| `suite.cache.tides.<id>` | yes (single combined blob) | — (replaced) |
| `suite.cache.tides.<id>.curve` | — | new (per-request `{t,v}` envelope) |
| `suite.cache.tides.<id>.hilo` | — | new (per-request `{t,v}` envelope) |
| `suite.cache.tides.<id>.temp` | — | new (per-request `{t,v}` envelope) |

keysOnlyInV1 = `["suite.cache.tides.9410840"]`, keysOnlyInV2 = the three per-request envelopes —
the expected consequence of the per-request cache migration described above; all keys stay under
the manifest's `suite.cache.tides.*` wildcard. Stale v1-format blobs are simply never read
(harmless orphan for users upgrading in place; ~14 KB per station).

## escape allowlist requests

Remote strings that reach `innerHTML` are escaped: `${esc(e.message||String(e))}` (error card).
The following interpolations lack `Suite.esc()` and are requested for the allowlist:

- `${chartHTML}` (renderAll) — one of two hardcoded literals (SVG shell or "unavailable" msg).
- `${curHeight!=null?curHeight.toFixed(1):"—"}` (now strip) — remote value forced through
  `parseFloat` + `toFixed`; numeric string or literal.
- `${trend?trend+" "+(trend==="rising"?"↑":"↓"):"—"}` (now strip) — `trend` is a local variable
  restricted to "rising"/"falling"/"".
- `${nextEvent?`<div class="now-item">…${nextEvent.type==="H"?"high":"low"}…${relTime(nextEvent.t,now)}…</div>`:""}` (now strip) — boolean-gated literals plus `relTime`, whose output is always `"in <n>h <mm>m"`/`"in <n>m"`/`"passed"`.
- `${tempStr!=null?…:…}` with `${Math.round(tempStr)}` and `${fmtClock(tempWhen)}` (water-temp
  card) — `Math.round` of a `parseFloat`ed value and a browser locale time string from a
  number-constructed `Date`.
- `${isHigh?"H":"L"}`, `${isHigh?"▲":"▼"}`, `${isHigh?"High tide":"Low tide"}` (event rows) —
  literals gated by the locally normalized boolean (remote `e.type` never hits markup raw).
- `${idx===0?'<span class="badge">next</span>':''}` (event rows) — index-gated literal.
- `${e.v.toFixed(1)}` (event rows) — remote value forced through `parseFloat` + `toFixed`.
- `${dc.time}`, `${dc.day}`, `${relTime(e.t,now)}` (event rows) — locale clock string,
  "Today"/"Tomorrow"/short-weekday locale string, and the fixed-shape countdown string; all
  derived from `parseLST`-constructed Dates.
- drawChart (`svg.innerHTML=s`): `${pad.l}`, `${W-pad.r}`, `${y.toFixed(1)}`, `${(y+3).toFixed(1)}`, `${v.toFixed(1)}`, `${x.toFixed(1)}`, `${H-pad.b}`, `${H-pad.b+14}`, `${(e.type==="H"?y-8:y+15).toFixed(1)}`, `${dArea}`, `${dLine}` — constants and `toFixed` numeric strings (paths are concatenations of the same).
- drawChart hour labels: `${h===0?"12a":h===12?"12p":h<12?h+"a":(h-12)+"p"}` — computed from
  the local loop counter.
- drawChart colors: `${line}`, `${muted}`, `${tideCol}`, `${highCol}`, `${lowCol}`,
  `${softFill}`, `${col}` — `getComputedStyle` values of custom properties defined by the
  tool's/core's own stylesheets.
- `${fmtClock(e.t)}` (hi/lo marker labels) — browser locale time string.
- `${dist!=null?Math.round(dist)+" mi":"#"+esc(s.id)}` (stationRow) — `Math.round` number or an
  already-escaped id (listed because the expression as a whole is unescaped).

No unescaped remote interpolation was found; no defect to fix.

## a11y applied

(from the v1 -> v2 diff)

- Picker modal given `role="dialog"`, `aria-modal="true"`, `aria-label="Choose a tide station"`.
- Station-ID input given `aria-label="NOAA station ID"` (was placeholder-only); focus moves to
  it when the picker opens.
- Station rows made keyboard-operable: `role="button"`, `tabindex="0"`, and Enter/Space
  activation alongside click (v1 was click-only divs).
- `Suite.liveRegion()` on `#content`, `#updated`, and `#pickErr` — data loads, freshness
  changes, and picker validation errors are announced.
- Status dot marked `aria-hidden="true"` (decorative; state is conveyed by the updated text).
- Theme button `aria-label`/`aria-pressed` via core (verified, line 17).
- Esc-to-close kept from v1 (verified, line 13); Enter submits the station-ID field (kept).
- Chart SVG `role="img"` + `aria-label="Today's tide curve"` already in v1 (kept).

## endpoints

Fetched hosts in the source, cross-checked against `manifest-entry.json` and CATALOG.md:

- `https://api.tidesandcurrents.noaa.gov` — the only fetched host (three products off
  `/api/prod/datagetter`). It is the sole entry in the manifest `endpoints` array; in CATALOG.md
  (tides entry, line 79 — which also documents the `application=local-suite` param — and CORS
  table line 498). CATALOG's CORS column says "verify (widely used)": now verified live by the
  harness (status dot "ok" with real data over CORS, line 2).

Manifest sanity check: one endpoint, one fetched host, exact match. `cacheTtlMin: 60` matches
the tool's `TTL = 60*60*1000` (harmonic predictions are stable for hours). `storage` list
matches the keys table above (`suite.cache.tides.*` covers the new per-request envelopes).
The station-metadata mdapi mentioned in CATALOG is not fetched — the popular-station table is
embedded, same as v1.

## concerns for the reviewer

- **This report was reconstructed from evidence by a finisher agent** after the migrating agent
  was terminated pre-report. The harness was re-run and passed (exit 0); all claims trace to the
  refreshed evidence or direct source inspection.
- **Cache-shape break with v1:** users upgrading in place keep an orphaned
  `suite.cache.tides.<id>` blob that nothing reads or deletes (~14 KB per previously viewed
  station). Harmless, but a one-line cleanup sweep could be considered suite-wide.
- The evidence expectation string on line 15 reads `expect "cached <~24h-ago time>"` while the
  actual text is `cached 3:06 PM` (same-day time). The harness backdates the envelopes ~24 h to
  force staleness, and `toLocaleTimeString` renders only the clock time — so a 24 h-old cache is
  indistinguishable from a same-day one in the UI. v1 had the identical limitation (clock-only
  stamp); flagging as a possible future UX nit, not a regression.
- The six `net::ERR_FAILED` console errors in interaction.txt are the deliberately
  route-aborted fetches (3 products × offline reload segments); the harness filters these and
  exited 0.
- Computed-style diff (13 values per theme) is entirely `-webkit-font-smoothing` (core sets
  `antialiased`; v1 had `auto`). No geometry, color, or layout deltas.
- `parseLST` trusts CO-OPS timestamp format; garbage would yield `Invalid Date`/`NaN` rows
  rather than markup injection (all downstream interpolation is number-coerced or locale
  formatting). Same as v1.
- Unknown manually entered station IDs are regex-validated (`^\d{6,8}$`) before being placed in
  a URL via `encodeURIComponent`, and the synthesized name "Station <id>" reaches the DOM via
  `textContent`. No concern; noted because it is the only user-supplied value that reaches a
  request URL.
