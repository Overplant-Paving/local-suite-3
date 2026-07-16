# air.html — migration report (Batch B)

## v1 feature walk-through

- [x] **First-run "Set your location" card** when `suite.location` is absent — verified: harness opens the tool with no location; interaction.txt line 1 logs the card ("Set your location"); v1/v2 screenshots (both themes) show it side-by-side identical.
- [x] **ZIP lookup via zippopotam.us** (5-digit validation, "Looking up…" progress, saves `suite.location` with "City, ST ZIP" label, then loads data) — verified live: ZIP 90012 -> locLabel "Los Angeles, CA 90012" (interaction.txt line 10), data refetched for the new coordinates.
- [x] **Enter key submits the ZIP field** — v1 had this; listener preserved (keydown -> `#zipGo.click()`). Code identical to v1.
- [x] **"Use my location" geolocation path** — code preserved verbatim (success -> `Suite.location.set` + load; error -> message). Not exercisable headless (no geolocation grant); failure-message path unchanged from v1.
- [x] **"change" button returns to the location card** — verified: interaction clicks `#changeLoc` and the first-run card renders (the ZIP flow ran on it).
- [x] **AQI hero with EPA color band** (number + category colored by band, 6-band table Good->Hazardous) — verified live: AQI 70 -> "Moderate" #cbb733, rendered category and computed color MATCH the expected band for the raw API value (interaction.txt lines 3-4).
- [x] **Color-scale bar with position pin** (gradient, pin at aqi/350) — verified: raw AQI 70 -> expected left=20%, rendered 20%, MATCH (line 5).
- [x] **Advice text per band** — visible in screenshots ("Acceptable. Unusually sensitive people…" for Moderate); text table byte-identical to v1.
- [x] **Pollutant breakdown** (PM2.5, PM10, O3, NO2, SO2, CO with ug/m3 units, PM to 1 decimal) — verified live: PM2.5=26.1, PM10=33.4, Ozone=57, NO2=34, SO2=5, CO=162 (line 6).
- [x] **UV index now** (pill colored by UV band + category + advice) — verified live: raw UV 5.9 -> "High" #e08b2f, rendered pill background MATCH (lines 7-8).
- [x] **Multi-day outlook** (5-day peak AQI + peak UV bars from hourly data, "Today"/weekday names, band-colored badges) — verified: 10 outlook rows rendered (line 9), visible in v2-after-interaction.png and offline-stale.png.
- [x] **Optimistic render from cache, then refresh** — preserved: cached envelope (matching location) renders immediately, then `Suite.fetchJSON` runs.
- [x] **Location-keyed cache** (v1 envelope `{t, key, v}` at `suite.cache.air`; a cache for a different location is never shown) — preserved: mismatched-key entries are removed before fetch (so `Suite.fetchJSON` cannot serve them fresh OR stale), and the `key` field is re-added after every fresh fetch. Exercised: the ZIP flow changed location and refetched (line 10).
- [x] **Offline fallback to cache with "offline · last data <time>"** — verified: cache aged 24 h + network blocked -> rendered AQI 70 from cache with "offline · last data Jul 14, 12 PM" (line 11); offline-stale.png.
- [x] **No-cache error card with Try again** — code path preserved (`catch` -> error card, `#retry` via addEventListener). Reached only when fetch fails with no usable cache; not separately screenshotted (the stale path was the required one).
- [x] **15-min auto-refresh timer + reload on tab visibility** — preserved verbatim.
- [x] **Theme toggle persisting `suite.theme`** — via core `Suite.theme`; harness probe: light -> dark, aria-pressed=true (line 12).
- [x] **Footer data credit incl. the honest no-pollen note** — unchanged.

## changes beyond the recipe

- **Policy-mandated TTL caching (API-AND-RELAY.md §2):** v1 fetched on every load and used the cache only as an offline fallback. v2 serves the cache when it is fresher than 10 min (`ttl: TTL` on `Suite.fetchJSON`). Rendering is otherwise identical; the "updated <reltime>" line stays honest because it always shows the data's fetch time.
- **Cache-envelope handling:** `Suite.fetchJSON` writes `{t, v}`; the tool immediately rewrites `{t, key, v}` after each fresh fetch to preserve v1's location-key semantics, and purges a mismatched-key entry before fetching (one raw `localStorage.removeItem`, commented — `Suite.store` has no delete). v1 envelopes are read compatibly by both the tool and `Suite.fetchJSON`.
- **ZIP lookup left uncached**, matching the canonical fetcher migration (weather.html does the same for its zippopotam call): it is a one-off user-triggered geocode, not a polled data source, and caching it would create per-ZIP localStorage keys v1 never wrote.
- `.back` tool-local override (muted at rest, accent on hover, nowrap) and `.theme-btn { margin-left: auto }` — v1 diverged from the core chrome here; footer override (margin-top 2.5rem, .82rem, padding-top 1rem) likewise.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | same (core `Suite.theme`) |
| `suite.location` | JSON `{lat, lon, label}` | same (`Suite.location`) |
| `suite.cache.air` | JSON `{t, key, v}` | same envelope, same key |

localstorage.json: `keysOnlyInV1` and `keysOnlyInV2` both empty. (Values differ only because the v2 run ended on the ZIP-derived location — same key set.)

## escape allowlist requests

All remote scalar values are wrapped in `Suite.esc()` (AQI/UV numbers, all six pollutant readings, outlook badge values, day names, error message). Remaining unwrapped interpolations into `innerHTML`, all provably safe:

- `${band.col}` (x2), `${uvb.col}`, `${b.col}` (x4 across the two outlook builders) — hex color literals from the tool's own `AQI`/`UVB` constant tables; remote data only selects which constant.
- `${pinPct}` and `${pct}` (x2) — results of `Math.min(100, (number/const)*100)` arithmetic; always a Number.
- `${aqiOutlook || '<div class="card-msg">No forecast.</div>'}` and `${uvOutlook}` — HTML strings assembled immediately above with every remote field esc'd.
- `${band ? ... : ...}` and `${uvb ? ... : ...}` — nested template literals whose remote fields are esc'd individually; `${esc(band.cat)}`, `${esc(band.advice)}`, `${esc(uvb.cat)}`, `${esc(uvb.advice)}` are esc'd (local constants anyway).
- `${isToday(day) ? "Today" : esc(dayName(day))}` (x2) — the un-esc'd branch is the string literal "Today".
- The `${msg ? ... : ""}` wrapper in `renderFirstRun` — inner value is `${esc(msg)}`; outer is a local template.

## a11y applied

- `Suite.liveRegion()` on `#main` (all fetched panels render into it) and `#updated` (freshness/offline announcements).
- Theme button `aria-label` + `aria-pressed` via core `Suite.theme.init()`.
- ZIP input keeps its v1 `<label for="zip">`; Enter submits (v1 behavior kept).
- All controls are real `<button>`s (v1 already); no icon-only buttons besides the core-labeled theme button; no overlays, so no Esc path needed.
- Focus-visible outlines and reduced-motion guard from core; v1's explicit `.skel { animation: none }` reduced-motion rule kept.

## endpoints

- `https://air-quality-api.open-meteo.com` — the single data source: AQI, pollutants, **and UV** all come from one `/v1/air-quality` call. **v1 has no EPA fetch and no AirNow keyed path** — CATALOG.md lists `data.epa.gov` and `airnowapi.org` as *options*, but the shipped v1 never calls them (its footer credits Open-Meteo for both AQI and UV), so nothing to migrate and no key mechanics to keep. Host is in CATALOG.md (`*.open-meteo.com`, verified).
- `https://api.zippopotam.us` — ZIP -> coordinates on the first-run card. In CATALOG.md (verified).
- Both hosts must be in the manifest `endpoints` for CSP `connect-src`; no image hosts.
- `cacheTtlMin: 10` — weather-class source per API-AND-RELAY.md §2 (Open-Meteo's air-quality model updates hourly, but the suite's weather-ish class is 10 min; v1's own refresh timer is 15 min, so a 10-min TTL never makes the tool staler than v1).

## concerns for the reviewer

- **Interaction console noise:** the stale-path reload logs one `Failed to load resource: net::ERR_FAILED` (the deliberately blocked fetch). The harness classifies `net::ERR` as non-hard; exit code was 0. No other console output.
- **Live-fetch volume:** the run makes 2 Open-Meteo calls on v2 (seeded LA + ZIP-90012 refetch, which also proves the cache-purge-on-location-change path) and 1 on v1, plus 1 zippopotam call — slightly more than the one-per-source minimum, noted for etiquette transparency.
- **Fresh-within-TTL serve** is a small observable behavior change vs v1 (v1 always refetched on load): reopening the tool within 10 min shows "updated N min ago" instead of "updated just now". This is the enforced good-citizen policy, flagged as required.
- **CO displays in ug/m3** — preserved exactly as v1 labels it; flagged only in case a data-accuracy pass is ever wanted.
- The `v2-after-interaction.png` is in dark mode because the harness's theme-toggle probe runs before that screenshot; it doubles as a dark-theme shot of the fully rendered stale state.
## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks against tools/air.html from file:// in both themes, Open-Meteo + zippopotam
route-fulfilled with fixtures spanning five AQI bands; raw measurements in
[a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | zero symbol-only buttons/links found |
| 2 | aria-live on async containers | pass | `#main` and `#updated` are `Suite.liveRegion`; first-run `#locMsg` sits inside the `#main` live subtree |
| 3 | Keyboard paths | pass | first-run ZIP field auto-focused, typed 90012 + Enter renders the full dashboard (keyboard-only log) |
| 4 | Input labels | pass | `<label for="zip">` |
| 5 | Contrast, both palettes | **fixed** | see table below — EPA band colors used as text/badges failed AA |
| 6 | Focus visibility | pass | core `:focus-visible` outline confirmed on link/buttons via real-Tab probe |

Contrast fixes (the EPA scale gradient, pin, and pill backgrounds keep the exact EPA colors):
- Hero AQI number/category text: raw band colors on the card failed (e.g. #cbb733 "Moderate" = **2.0:1**, #4caf50 = 2.7:1). Now theme-aware text variants `--t-good…--t-hazardous` (light: #39833c/#827521/#a66723/#cd483b/#8b61bc/#7a3b45, all ≥ 4.5:1 on the card; dark: #5cb85c/#d6c34a/#e2a24f/#e0685a/#a17bd6/#a67c82, all ≥ 4.5:1).
- Outlook badges (11px bold on colored chips): white ink failed on every band ≤ 300 (2.0–4.36:1). Now per-band ink — dark #1e2418 on Good/Moderate/USG (5.7–7.8:1), white on the rest; the two mid-tone bands where neither ink reached 4.5 got a nudged badge bg: Unhealthy #d34a3d→#cb473b (white 4.66:1), Very Unhealthy #8e63c0→#8d62be (white 4.54:1).
- UV pill (38px, 3:1 required): white on #cbb733/#e08b2f failed (2.0/2.7) → dark ink on those two bands, white elsewhere.
- First-run error note: `#c0392b` both themes → theme-split `--errnote` (dark #cf695e, 4.5:1).

`tests/interactions/air.mjs` updated accordingly: the EPA band check now models the hero TEXT
variant (`text` field, light-theme values) while the UV pill background check still asserts the
exact EPA color. (Also fixed in air.mjs while here: the scale-pin check now compares numerically — the old string compare false-MISMATCHed on any AQI whose percentage exceeds the browser's ~6-digit style serialization.) Suite-wide flag (not fixed locally): `--muted` on `--bg` = 4.36:1.

No behavior change; re-verified with `node verify-tool.mjs air` — exit 0, evidence files in this directory regenerated 2026-07-16.
