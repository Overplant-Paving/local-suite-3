# volcano.html migration report (Batch B)

## v1 feature walk-through

Every v1 feature, each verified against the migrated tool (evidence: `interaction.txt`,
screenshots in this directory; run `node verify-tool.mjs volcano`, exit 0):

- [x] **Elevated-volcanoes fetch (HANS `getElevatedVolcanoes`, primary source)** — live-verified:
  4 volcanoes at elevated alert rendered and recorded from the cache envelope; sample
  "Great Sitkin" — color ORANGE, alert WATCH, vnum 311120 (interaction.txt lines 2–10).
  "All quiet" (zero elevated) is a designed state; the live feed had 4, so the populated board
  is what got exercised — the all-quiet branch is code-identical to v1 (verbatim card) and the
  interaction module logs whichever state occurs.
- [x] **Coordinate/threat enrichment (vsc `volcanoApi/elevated`, matched by vnum)** — live-verified:
  4 volcanoes with coords/threat in the vsc response; threat labels render ("High Threat",
  "Very High Threat", "Moderate Threat" — visible in every screenshot) and all 4 cards show a
  distance once a location is set (line 23: "4 of 4").
- [x] **Summary stats (count at elevated alert, highest color)** — "4 AT ELEVATED ALERT",
  "Orange HIGHEST COLOR" (lines 2–3), matching the color-rank reduce.
- [x] **Grouping by color code with group headers + counts** — "ORANGE — WATCH · 2 |
  YELLOW — ADVISORY · 2" (line 4); sort by color rank then alert rank preserved verbatim.
- [x] **Volcano cards: name, observatory, color + alert badges, left-border color class** —
  first card logged with name/badges/obs (line 6); border colors visible in all screenshots.
- [x] **Card meta: notice time (`fmtWhen` of `sent_utc`), threat, distance, activity-notice
  link** — "Notice Jul 14, 4:22 PM High Threat 3,079 mi away Activity notice →" (line 22).
- [x] **Distance from shared location (haversine miles)** — seeded LA per the addendum:
  Great Sitkin 3,079 mi, Kilauea 2,482 mi (v2-after-interaction.png) — sane great-circle values
  for LA→Aleutians/Hawaii.
- [x] **Location chip toggles the ZIP/geolocation form; "distances measured from here" note** —
  chip opens/closes the form (lines 12–13), note renders after a location is set (line 15).
- [x] **ZIP lookup via api.zippopotam.us writes shared `suite.location`** — live-fetched 90012 →
  `{"lat":34.0614,"lon":-118.2385,"label":"Los Angeles, CA"}`, form auto-closed, board
  re-rendered (lines 14–16).
- [x] **ZIP validation error** — code path identical to v1 ("Enter a 5-digit ZIP." /
  "ZIP not found." into #locErr); not driven live to avoid a wasted request.
- [x] **Geolocation button** — logic preserved verbatim (label swap to "Locating…", error
  message "Couldn't get location (may need http://)."); not exercised (headless has no
  geolocation grant), same as the other Batch B tools.
- [x] **Instant paint from cache while the fetch runs** — kept: `render()` draws the stored
  `suite.cache.volcano.elevated` envelope (enriched from the vsc cache) before `loadElevated()`
  resolves, exactly v1's cached-then-fresh sequence.
- [x] **Keep showing cached data when the fetch fails; error card only with no cache** —
  verified via the offline pass (cached board still renders, line 26); the no-cache
  "Couldn't reach the volcano service" card is verbatim v1.
- [x] **Skeleton loaders + reduced-motion guard** — kept tool-local (static innerHTML, no
  interpolation); core adds the suite-wide reduced-motion guard on top.
- [x] **Auto-refresh: visibilitychange + 10-minute interval** — code preserved verbatim; with
  the new 60-min TTL these mostly serve from cache (good-citizen behavior, see below).
- [x] **Legend, footer, tag copy** — byte-identical markup; visible in all screenshots.
- [x] **Theme toggle** — harness probe: light -> dark, aria-pressed=true (line 27).

## changes beyond the recipe

- **Policy-mandated caching (Batch B addendum):** v1 fetched both volcano endpoints on every
  `render()` (boot, tab focus, every 10 min) with no TTL, and manually cached only the merged
  result. v2 routes both through `Suite.fetchJSON` with `ttl: 60 min`:
  - `suite.cache.volcano.elevated` — same key v1 used, but the envelope now holds the **raw**
    HANS response instead of v1's coordinate-enriched copy. Compatible both directions: the
    enrichment properties (`_lat`/`_lon`/`_threat`) are additive, applied in memory after read,
    so a v1 user's existing enriched cache renders identically (its `_lat` values are simply
    overwritten/kept by `enrich()`).
  - `suite.cache.volcano.vsc` — **new key**: the coordinate/threat request v1 fetched uncached
    on every load. Caching it separately is the policy-mandated change; it also makes distances
    survive the offline path (v1 got that via the merged cache).
  Rendering behavior is otherwise identical; the 10-min refresh loop stays but now reuses the
  cache within the TTL instead of re-hitting USGS six times an hour.
- **Stale/offline stamp:** on stale fallback the stamp renders
  "Offline — cached data from <ago> · <time>" instead of v1's silent "Data from <ago> · <time>"
  (v1 kept showing cached data with no offline indication). Addendum requirement: never pretend
  stale data is fresh. Verified: offline-stale.png, interaction.txt line 25.
- **ZIP lookup left uncached**, matching weather.html and iss.html: a one-off user action whose
  result persists into `suite.location`; a cache envelope would never be read back.
- `main.innerHTML = ""` / `$("#summary").textContent = ""` clears normalized to `textContent`
  (pure clears, identical behavior); the two-skeleton innerHTML string is static markup, kept.
- v1's `getLoc()/setLoc()/cache` helpers replaced by `Suite.location` / `Suite.store`
  (same keys, same shapes; `Suite.location.get` normalizes a missing `label` to `""`, a strict
  hardening of v1's undefined-label edge case).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.location` | yes | yes (byte-identical shape `{lat,lon,label}`) |
| `suite.cache.volcano.elevated` | yes (enriched list) | yes (same key, raw list — compatible, see above) |
| `suite.cache.volcano.vsc` | — | new — policy-mandated `{t,v}` envelope for the enrichment request v1 fetched uncached |

`localstorage.json`: keysOnlyInV1 = [], keysOnlyInV2 = ["suite.cache.volcano.vsc"] (explained above).

## escape allowlist requests

none — all dynamic DOM is built with createElement/textContent (v1 already did); the only
innerHTML assignment is the static two-skeleton loader string with no interpolation.

## a11y applied

- `#zipInput` given `aria-label="US ZIP code"` (was placeholder-only).
- `#locErr` wrapped in `Suite.liveRegion()` — ZIP/geolocation errors are announced.
- `#summary` wrapped in `Suite.liveRegion()` — the count/highest-color stats are announced when
  data arrives. **Deliberate omission:** `#main` is NOT a live region — announcing the entire
  card list on every refresh would be noise; the summary carries the signal.
- Enter in the ZIP input submits the lookup (text-entry + button pair rule) — verified live via
  `press("Enter")` (interaction.txt line 14).
- Location chip gets `aria-expanded` reflecting the form's open state (verified true/false,
  lines 12–13).
- Esc closes the location form (verified, line 13).
- Theme button label/pressed state from core (`aria-label`, `aria-pressed`).
- No icon-only buttons (the chip has text alongside the 📍).

## endpoints

- `https://volcanoes.usgs.gov` — both paths in CATALOG.md: section 2.5 documents
  `hans-public/api/volcano/getElevatedVolcanoes` (CORS ✓ verified Jul 2026, with the note that
  `getVolcanoesUs` does not exist) and the `vsc/api/volcanoApi/elevated` enrichment; the CORS
  table lists `volcanoes.usgs.gov/hans-public` (line 504). One live exercise per source in the
  harness run; the stale-path requests are route-aborted, not sent.
- `https://api.zippopotam.us` — in CATALOG.md (ZIP entry + CORS table). One live request per run.
- No image hosts — the board is pure text/DOM.

`cacheTtlMin: 60` — justification: volcanic alert levels and aviation color codes change on the
scale of days to weeks (HANS notices are issued at most a few times a day per volcano), so this
is neither weather-class (10 min) nor daily-stats-class (1440); 60 min catches an escalation
within the hour while cutting v1's six-fetches-per-hour polling to at most one. The vsc
coordinate feed shares the TTL — coordinates are static; its only churn is the elevated set
itself.

## concerns for the reviewer

- **Cache-envelope shape shift under the same key:** v1 stored the coordinate-enriched list in
  `suite.cache.volcano.elevated`; v2 stores the raw HANS response there and the vsc payload
  separately. Both directions were reasoned through (additive `_lat`/`_lon`/`_threat` props,
  enrichment re-applied in memory on every draw) and the v1-cache-read path is exercised by the
  instant-paint branch, but a v1→v2 user's very first paint (before the vsc fetch resolves)
  renders distances from the v1 enriched cache while a v2 user's first-ever paint has none until
  the fetch lands — same as v1's own first load. No data loss either way.
- `interaction.txt` shows two `net::ERR_FAILED` console errors — the deliberately route-aborted
  fetches of the stale-path test; the harness filters net::ERR and exited 0.
- Computed-style diff: the only differences are `--built` (v1=undefined, v2=core palette value)
  on every selector — an unused core custom property inherited from `core/suite.css`; nothing in
  this tool references it, zero rendering effect. `-webkit-font-smoothing` matches (v1 volcano
  already set it).
- The v1/v2 side-by-side screenshots were both captured after the live fetch resolved (700 ms was
  enough this run), so they show the identical populated board — a genuinely strong parity proof,
  but it means the skeleton state appears in no screenshot; the skeleton markup/CSS is carried
  over verbatim.
- The stale flag is taken from the **primary** (HANS) response only; a fresh HANS + stale vsc
  combination renders fresh alert data with slightly stale coordinates and no offline stamp.
  Deliberate: the alert levels are the product, coordinates are near-static decoration.
- `notice_url` from the API is assigned to `a.href` exactly as v1 did (DOM property, no HTML
  injection possible; a hostile `javascript:` URL from USGS is the theoretical residual — kept
  at v1 parity rather than adding validation).

## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks against tools/volcano.html from file:// in both themes, HANS + vsc + zippopotam
route-fulfilled with a 5-volcano fixture covering every color code (RED/ORANGE/YELLOW/GREEN/
unassigned); raw measurements in [a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | zero symbol-only buttons/links (the 📍 chip carries its location text) |
| 2 | aria-live on async containers | **fixed** | `#summary` and `#locErr` were live, but `#main` — where the board AND the "Offline — cached data from …" stamp render — was not; added `Suite.liveRegion($("#main"))` (matches the snow/air pattern) |
| 3 | Keyboard paths | pass | keyboard-only: Tab→location chip→Enter opens the form (`aria-expanded` kept in sync), **Esc closes it** (verified), ZIP + Enter sets the location and distances render |
| 4 | Input labels | pass | `#zipInput` has `aria-label="US ZIP code"` |
| 5 | Contrast, both palettes | **fixed** | aviation color-code badges: white ink failed on yellow (**2.58**), orange (3.08) and gray (3.25) in light, and on ALL five pastel codes in dark (1.8–3.3) → new per-code inks `--on-green/-yellow/-orange/-red/-gray` (light: white on green/red 5.0/5.4, dark ink #15181c on yellow/orange/gray 5.5–6.9; dark theme: dark ink on all, 5.4–9.9). Code colors themselves unchanged; `.locErr` already used `var(--red)` (5.4/5.0) |
| 6 | Focus visibility | pass | core `:focus-visible` outline confirmed via real-Tab probe |

Note: the vcard's colored left border (yellow 2.5:1 vs card) is redundant with the textual
badge, which now passes — border kept as-is. Suite-wide flag (not fixed locally): `--muted`
on `--bg` = 4.36:1. Re-verified with `node verify-tool.mjs volcano` — exit 0, evidence files in this directory regenerated 2026-07-16.
