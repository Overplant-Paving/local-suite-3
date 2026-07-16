# zip.html migration report (Phase 2, Batch B)

## v1 feature walk-through

Every v1 feature, each verified via the harness run (`interaction.txt`) or the
screenshots in this directory:

- [x] **Three tabs as pills** (ZIP → place / City → ZIPs / Area code); clicking
  switches the visible card — verified by the interaction pass
  (`city tab: cityCard hidden=false, zipCard hidden=true`) and the screenshots
  (ZIP pill "on" by default, identical to v1).
- [x] **ZIP → place (live fetch)**: 90012 → "Los Angeles, CA", "ZIP 90012 ·
  California", facts Latitude=34.0614 / Longitude=-118.2385 / State=CA — real
  api.zippopotam.us response, logged in `interaction.txt` lines 1–5.
- [x] **Enter submits the ZIP field** (v1 behavior, kept) — the live lookup above
  was submitted with Enter, not the button.
- [x] **Input validation**: 5-digit regex guard (unchanged verbatim); non-matching
  input renders the `.msg.err` card (code path identical to v1).
- [x] **"View on OpenStreetMap" link**: logged href
  `https://www.openstreetmap.org/?mlat=34.0614&mlon=-118.2385#map=12/34.0614/-118.2385`
  — same construction as v1 (encodeURIComponent on lat/lon).
- [x] **★ Save as my suite location**: click flips the button to
  "✓ Saved — other suite tools will use it" + disabled, and writes
  `suite.location = {"lat":34.0614,"lon":-118.2385,"label":"Los Angeles, CA"}`
  — byte-identical shape to v1's raw `JSON.stringify` write (see
  `localstorage.json`, v1 and v2 values equal).
- [x] **City → ZIPs (live fetch)**: CA / Beverly Hills → "Beverly Hills, CA",
  "5 ZIP codes", chips [90209, 90210, 90211, 90212, 90213] — sorted, as v1.
  Enter submits from the city field (v1 behavior on both `#stIn` and `#cityIn`,
  kept).
- [x] **zchip click** jumps to the ZIP tab, fills the input, looks the ZIP up, and
  scrolls to top: `zchip "90209" clicked: zip tab shown=true, #zipIn="90209",
  result .big="Beverly Hills, CA"`.
- [x] **Area code lookup (offline, embedded table)**: typing 213 renders
  213 / "Los Angeles (downtown)" / "California" live on `input` — no network.
  Invalid code 999 renders the exact v1 error sentence (logged).
- [x] **Embedded NANP `AREA` table and `ST_NAMES` map survive verbatim** — copied
  unchanged from v1, no entry touched.
- [x] **Offline / stale-cache fallback**: with the cache aged past TTL and the
  network blocked, ZIP 90012 renders the cached result plus the v1-style note
  "Offline — showing cached result from 7/7/2026, 12:26:01 PM." —
  `offline-stale.png`.
- [x] **404 = not-found semantics preserved**: v1's `getJSON` mapped 404 to
  `{_notfound:true}` and showed "No place found…" *without* falling back to
  cache; the v2 `fetchCached` wrapper reproduces this exactly (404 → notFound;
  only network failures fall back to the cached copy).
- [x] **Theme toggle + persistence**: harness clicks the button —
  `light -> dark`, `aria-pressed=true`, `suite.theme` written.
- [x] **Footer / header / tag copy**: byte-identical markup; screenshots match.

## changes beyond the recipe

- **Policy-mandated caching change (Batch B addendum, fetch conversion)**: v1
  always fetched and used its cache only as an offline fallback. v2 routes
  through `Suite.fetchJSON` with `ttl = 10080 min` (7 days — reference-data
  class per API-AND-RELAY.md §2: ZIP↔place mappings and city ZIP sets change on
  postal-service timescales, not daily), so a TTL-fresh cache entry is served
  without a network request. Rendering is otherwise identical; the stale path
  keeps v1's exact "Offline — showing cached result from <time>." wording.
- To preserve v1's 404-means-not-found semantics, `fetchCached` calls
  `Suite.fetchJSON` with `fallbackToCache:false` and performs the v1-style
  manual cache fallback itself on network failure only. (With
  `fallbackToCache:true`, a hypothetical cached-then-delisted ZIP would have
  mislabeled "not found" as "offline".)
- `renderZip`/`renderCity` now take the cache timestamp (`staleT`) instead of
  re-reading the cache entry (v1's `cacheGet(...)` re-parse) for the stale note
  — same rendered text, one less localStorage read. The per-file `getJSON` /
  `cacheGet` / `cacheSet` helpers are gone (recipe).
- Core `.card` is a flex column; v1 zip cards are plain blocks that rely on the
  `hidden` attribute — tool-local `.card` resets `display:block;
  flex-direction:row; gap:normal` and adds `.card[hidden]{display:none}` (same
  pattern as convert/qr/dates). Core `.theme-btn` has `float:right`; v1 zip
  places it in a flex topbar — `.topbar .theme-btn{float:none}` restores parity.
  Computed-style diff confirms zero non-approved differences.
- v1's identity `esc()` helper kept verbatim (all rendering is
  `createElement`/`textContent`; nothing removed).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | inline theme script (bare string) | `Suite.theme` (bare string) |
| `suite.cache.zip.z<zip>` | `cacheSet` `{t,v}` envelope | `Suite.fetchJSON` `{t,v}` envelope (same key, same shape) |
| `suite.cache.zip.c<ST>-<city lowercase>` | same | same |
| `suite.location` | raw `JSON.stringify({lat,lon,label})` | `Suite.location.set` — identical shape and key order |

`localstorage.json`: `keysOnlyInV1: []`, `keysOnlyInV2: []` — parity exact
(five keys on both sides; v2 cache `t` values differ only because the stale-path
step deliberately ages them).

## escape allowlist requests

none — the only `innerHTML` uses are bare `= ""` clears; all dynamic DOM
(including every API-derived string) is built with `createElement`/`textContent`,
unchanged from the v1 pattern.

## a11y applied

- `<label for=…>` added on all four inputs: `zipIn`, `stIn`, `cityIn`, `acIn`
  (v1 labels had no `for`).
- `Suite.liveRegion()` on the three async result containers: `#zipOut`,
  `#cityOut`, `#acOut`.
- `aria-pressed` state on the tab pills, toggled in sync with the `.on` class.
- **Keyboard path for the zchips** (v1 gap fixed): the clickable ZIP
  `<span>`s now get `role="button"`, `tabindex="0"`, and an Enter/Space keydown
  handler mirroring the click.
- Enter submits on `#zipIn`, `#stIn`, `#cityIn` (already in v1, preserved);
  area-code lookup runs live on `input`, no submit pair exists.
- Theme button label + `aria-pressed` from core (`Suite.theme.init`), verified
  in the harness. No overlays, so no Esc path needed.

## endpoints

- `https://api.zippopotam.us` — the only host the tool contacts (both ZIP and
  city lookups). Present in CATALOG.md (line 542 endpoint table + the zip.html
  tool entry, CORS ✓). `cacheTtlMin: 10080` — reference-data class per
  API-AND-RELAY.md §2 ("reference data (factbook, zip) 7 d").
- `https://www.openstreetmap.org` appears only as a user-clicked `<a href>`
  link-out (navigation, not a fetch or img load) — not a CSP endpoint, matching
  how the weather manifest treats the same link.

## concerns for the reviewer

- **Stale-path aging deviates from the addendum's example snippet**: the
  addendum ages caches by 24 h, but this tool's TTL is 7 days — a 24 h-old entry
  is still TTL-fresh and would be served from cache without touching the
  network, never exercising the offline branch. The interaction module ages by
  8 days instead (commented in `tests/interactions/zip.mjs`). Intent honored,
  literal snippet not.
- `interaction.txt` shows one `console.error: Failed to load resource:
  net::ERR_FAILED` — that is the deliberately blocked fetch during the
  stale-path step (the harness's own net::ERR filter recognizes it; exit 0).
  Not a defect.
- The v2-after-interaction screenshot shows the stale-offline state in dark
  theme (the stale step is the last interaction before the harness's theme
  toggle); the fresh-result render is evidenced by the logged values earlier in
  the run rather than a dedicated screenshot.
- Edge case accepted: on network failure the manual cache fallback uses any
  cached entry regardless of age — exactly v1's behavior (v1 also used
  arbitrarily old cache on failure).
- `Suite.location.set` throws on non-finite lat/lon where v1's raw write would
  have stored `null`s; unreachable in practice because the save button only
  renders when `lat && lon` are truthy API strings. Behavior for valid data is
  identical.

## Phase 4 a11y audit

Re-verified 2026-07-16 against QUALITY.md §2 (Phase 4 audit addendum). Full runtime log in
`a11y-phase4.txt` (harness: `tests/a11y-phase4-batch.mjs`, all http(s) route-fulfilled).

| # | Checklist item | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | icon-only controls named | n-a | no icon-only buttons or links render (★/✓/✕ glyphs all appear inside worded buttons) |
| 2 | aria-live on async containers | pass | runtime `aria-live=polite` on #zipOut, #cityOut, #acOut |
| 3 | keyboard path | pass | full flow keyboard-only: Tab→#zipIn, Enter submits; Tab+Enter saves location, switches pills, jumps via a `.zchip` (`role=button` `tabindex=0` + Enter/Space); area code fully offline via keyboard; no positive tabindex; no overlays |
| 4 | input labels | pass | all four inputs have `<label for>` (visible acIn in the main scan; zipIn/stIn/cityIn confirmed by the hidden-tab probe in a11y-phase4.txt) |
| 5 | contrast, both palettes | fixed | see below — 1 tool-local failure fixed, 1 suite flag |
| 6 | focus visibility | pass | 8/8 tabbed elements show the core 2px accent outline |

Contrast measurements:
- FIXED: `.pill.on` and `button.go` were `#fff` on `var(--accent)` — 5.83:1 light but **2.36:1
  dark**. Now `color: var(--bg)`: 5.26:1 light / 7.60:1 dark. No visible light change.
- SUITE FLAG (not fixed locally): `--muted` on `--bg` = **4.36:1 light** (footer, `.fact span`
  labels on the `--bg` fact tiles). Dark passes (6.81:1).
- Passing spot-checks: `.sub` muted-on-card 4.76, `.fact b` accent-on-bg 5.26/7.60, `.big` ≥13.

Fixes made: the two `color:#fff` → `color:var(--bg)` swaps above (tools/zip.html only).
Harness after fix: `node verify-tool.mjs zip` → exit 0 (live Zippopotamus fetches + stale path).
