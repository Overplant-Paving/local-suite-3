# radar.html migration report (Batch B)

## v1 feature walk-through

- [x] **First-run "Set your location" card** (no `suite.location`) — rendered as the harness
  screenshot state in both versions (`v1-light/dark.png` vs `v2-light/dark.png`); interaction log
  line 18 re-enters it via "change".
- [x] **ZIP lookup (api.zippopotam.us, live)** — invalid ZIP "123" rejected with "Enter a 5-digit
  ZIP code."; live lookup of 90012 resolved to `{"lat":34.0614,"lon":-118.2385,"label":"Los
  Angeles, CA 90012"}` and booted into the radar view (interaction.txt lines 19-22).
- [x] **Enter submits the ZIP field** — the 90012 lookup was submitted with the Enter key
  (v1 already had this handler; preserved).
- [x] **Geolocation path** — code preserved verbatim (callback bodies unchanged); not
  live-driven (headless has no geolocation permission), same as other Batch B tools.
- [x] **"Skip — just satellite"** — handler preserved (`view="sat"; setTab(); renderSat()`);
  the sat view itself is exercised below via the tab.
- [x] **Nearest-station suggestion from suite.location** — with LA seeded, hint rendered
  "Nearest to Los Angeles, CA: KSOX (62 km)" and the select auto-picked KSOX
  (interaction.txt lines 3-4) — haversine + STATIONS table byte-identical to v1.
- [x] **Radar loop loads (radar.weather.gov RIDGE)** — KSOX loop LOADED 600x550 px,
  `img.complete && naturalWidth > 0` (line 5); caption + "animated ~1-hour loop · loaded
  <time>" rendered (line 6).
- [x] **Station switching** — select -> KOKX: `suite.radar.station=KOKX` stored, new loop
  LOADED 600x550, caption "New York City · KOKX" (lines 7-9). Per-station distance suffix
  visible in the select ("KOKX — New York City · 4030 km" in `v2-after-interaction.png`).
- [x] **Refresh buttons (↻)** — same `show()` path as the change handlers (station switch and
  region/product switches exercise it); listeners converted from `.onclick`.
- [x] **GOES satellite view (cdn.star.nesdis.noaa.gov)** — CONUS GEOCOLOR LOADED 1250x750
  (line 11 — the v1 `sizeFor` CONUS size), caption "Continental US · GeoColor (true-ish
  color)" (line 12).
- [x] **Region switching** — psw sector LOADED 1200x1200 via the `/SECTOR/` URL branch
  (line 13); CONUS/FD vs SECTOR path logic unchanged.
- [x] **Product switching** — product "13" (clean infrared) LOADED 1200x1200 (line 14).
- [x] **Sector/product persistence** — `suite.radar.sector=psw`, `suite.radar.product=13`
  stored as bare strings; after a full reload both selects restored (psw / "13") — line 17.
  This specifically proves the `"13"`-parses-as-number hazard is handled (see below).
- [x] **Image-failure error states** — network blocked: radar view rendered "Couldn't load the
  KOKX radar loop. Try another station or refresh." and sat view "That imagery combination
  isn't available right now…" — v1's designed `.err` cards, not a blank (lines 23-24,
  `offline-stale.png`).
- [x] **Tabs radar/sat** — clicking flips `.on` styling and re-renders; verified lines 10, 23-25.
- [x] **Theme toggle** — light -> dark, `aria-pressed=true` (harness probe, line 26).
- [x] **Footer attribution** — byte-identical text; visible in all screenshots.

## changes beyond the recipe

- **`getPref()` String() normalization on `suite.radar.station/sector/product` reads.** v1 read
  these with a raw-string getter. `Suite.store.get` JSON-parses when it can, and the GOES
  product code `"13"` parses to the *number* 13, which would break the `p[0]===savedProd`
  select-restore comparison. Reads go through `String()`; writes stay bare strings so the
  stored bytes are identical to v1 (proven: localstorage.json shows `"13"` in both, and the
  reload-restore test passed). Station/sector ids are all non-JSON letter strings; only
  "13" is actually at risk, but all three reads are normalized for uniformity.
- **Tabs got `aria-pressed`** (toggled in `setTab()`) — a11y-only addition.
- **ZIP lookup stays uncached** (no `cacheKey`), matching the reviewed precedent in
  weather.html and alerts.html: it is a one-shot user action that writes `suite.location`,
  not a periodic data source, and v1 did not cache it either. Flagging per the Batch B
  addendum's add-caching policy: I read that policy as applying to data-feed fetches; if the
  orchestrator wants the ZIP response cached too, it is a two-token change.
- Nothing else: STATIONS / SECTORS / PRODUCTS tables, haversine, URL construction
  (including the `?t=${Date.now()}` cache-busters), all copy, and all rendering logic are
  byte-identical to v1.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | same (via Suite.theme) |
| `suite.location` | JSON `{lat,lon,label}` | same (via Suite.location) |
| `suite.radar.station` | bare string e.g. `KOKX` | byte-identical |
| `suite.radar.sector` | bare string e.g. `psw` | byte-identical |
| `suite.radar.product` | bare string e.g. `13` | byte-identical |

No `suite.cache.*` keys in either version (images are deliberately cache-busted live
imagery; the ZIP lookup is uncached). Parity: `keysOnlyInV1` and `keysOnlyInV2` both empty,
all five values byte-identical (localstorage.json).

## escape allowlist requests

All interpolations of remote/user-influenced data are `Suite.esc()`'d (`esc(loc.label)`,
`esc(id)`, `esc(msg)` — as in v1). The following template-literal interpolations into
`innerHTML` are unescaped and provably safe (all from build-time constants in this file):

- `${s[0]}` (twice), `${s[3]}`, `${s[0]===saved?" selected":""}` — fields of the embedded
  `STATIONS` const array (renderRadar option builder).
- `${dist}` — `" · " + Math.round(haversine(...)) + " km"` or `""`; numeric + literals.
- `${opts}` — the joined string built from the two expressions above.
- `${near.s[0]}`, `${Math.round(near.km)}` — embedded-table id + number (nearest hint).
- `${near ? ... : ""}` / `${msg ? ... : ""}` — outer ternary wrappers whose dynamic
  inner parts are esc()'d or constant.
- `${s[0]}`, `${s[0]===savedSec?" selected":""}`, `${s[1]}` and `${p[0]}`,
  `${p[0]===savedProd?" selected":""}`, `${p[1]}` — fields of the embedded `SECTORS` /
  `PRODUCTS` const arrays; `${secOpts}`, `${prodOpts}` — their joins.
- Note `savedSec`/`savedProd`/`saved` come from localStorage but only feed `===`
  comparisons against table constants — they are never interpolated themselves.

## a11y applied

- `Suite.liveRegion(mainEl)` — the whole `#main` region re-renders on every load/tab/station
  change (loop loaded, error cards, first-run card), so updates are announced.
- `Suite.liveRegion(locMsg)` on the first-run status line (lookup progress/errors).
- `aria-pressed` on the two view tabs, kept in sync by `setTab()`.
- Theme button `aria-label` + `aria-pressed` from core `Suite.theme.init()`.
- Existing v1 a11y preserved: `<label for="zip">`, selects wrapped in `<label class="fld">`
  (implicit association), Enter submits ZIP, `img.alt` on both imagery types, all controls
  are real buttons/selects (keyboard path everywhere). No icon-only buttons ("↻ Refresh"
  has text). No overlays, so no Esc handling needed.

## endpoints

- `https://radar.weather.gov` — RIDGE loop GIFs (`/ridge/standard/{ID}_loop.gif`), plain
  `<img>` loads -> needs CSP **img-src**. In CATALOG.md line 54. OK
- `https://cdn.star.nesdis.noaa.gov` — GOES-19 ABI sector imagery JPGs, plain `<img>` loads
  -> needs CSP **img-src**. In CATALOG.md line 54. OK
- `https://api.zippopotam.us` — one JSON fetch on the change-location path -> needs CSP
  **connect-src**. In CATALOG.md lines 325/542. OK
- `cacheTtlMin: null` — the only JSON fetch is the uncached one-shot ZIP lookup; both image
  sources are live imagery that v1 deliberately cache-busts with `?t=` (re-fetch on refresh
  is the tool's documented behavior, see its footer). Nothing has a TTL to declare.

## concerns for the reviewer

- **`?t=` cache-buster + no image caching is v1 behavior, kept.** Every refresh/station
  switch is a full image re-download (~0.5-3 MB for loops). That is the tool's design
  ("Images load directly in the browser and are re-fetched when you refresh"), but it means
  cacheTtlMin: null — confirm you agree that the Batch B add-caching policy does not apply
  to `<img>` loads (the addendum's "plain image loads stay plain" line suggests it doesn't).
- **ZIP lookup uncached** — see "changes beyond the recipe"; matches weather/alerts
  precedent but is technically a JSON fetch without a TTL.
- **`.field input` computed-style diff `outline-offset 0->2px`**: the first-run ZIP input is
  auto-focused at capture time; core's `:focus-visible` a11y rule contributes
  `outline-offset: 2px`. The tool keeps v1's `outline: none` on `.field input:focus` (higher
  specificity), so the visible focus treatment (accent border) is unchanged — the offset is
  residue from the core rule with no visual effect while outline is none. All other diffs
  are the pre-approved `-webkit-font-smoothing`.
- **Console "issues" in interaction.txt are the two expected `net::ERR_FAILED`** image loads
  during the deliberately network-blocked offline pass — the harness's own filter treats
  them as non-fatal, and the run exited 0.
- **GOES-19 dependency**: sector/product availability is NOAA's (e.g. some product x sector
  combos legitimately 404 -> the v1 error card). All four exercised combinations loaded live
  today; nothing to fix, just an external-availability note.

## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks executed against tools/radar.html from file:// in both themes, all network
route-fulfilled with fixtures; raw measurements in [a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | programmatic enumeration found zero symbol-only buttons/links ("↻ Refresh", "◐ theme" carry text) |
| 2 | aria-live on async containers | pass | `#main` is `Suite.liveRegion` — every view (radar, satellite, first-run incl. `#locMsg`) renders inside it |
| 3 | Keyboard paths | pass | primary feature driven keyboard-only: Tab→change→Enter, ZIP+Enter sets location, station `<select>` via ArrowDown, tab switch + sector switch via Enter/arrows (log in a11y-phase4.txt); no overlays, so no Esc path needed |
| 4 | Input labels | pass | `<label for="zip">`; both selects wrapped in `<label class="fld">` |
| 5 | Contrast, both palettes | fixed | one tool-local fail: the conditional first-run error note was `#c0392b` in both themes → 3.0:1 on the dark card. Now `var(--errnote)` (#c0392b light 5.4:1 / #cf695e dark 4.5:1). `.imgwrap` load/err text on the fixed #0b1420 backdrop: 12.4:1 / 7.9:1 |
| 6 | Focus visibility | pass | core `:focus-visible` outline (2px accent) confirmed by real-Tab probe on tabs, selects, buttons, links |

Suite-wide failures observed here but NOT fixed locally (core palette — flagged to the auditor):
- `--muted` #6b7280 on `--bg` #f5f3ee = **4.36:1** (< 4.5) — back link, hints, captions; every tool shares this pair.
- white text on `--accent` in **dark** theme (#fff on #6fb5ae) = **2.36:1** — `.tab.on` here, and the `.btn`/`.btn.primary` filled-button pattern suite-wide. Light theme passes (5.85:1).

Fix delta: theme-split `--errnote` variable + one inline style swap. No behavior change; re-verified with `node verify-tool.mjs radar` — exit 0, evidence files in this directory regenerated 2026-07-16.

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.tab.on`, `.btn`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
