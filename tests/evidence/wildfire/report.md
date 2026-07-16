# wildfire.html — migration report (Batch B)

## v1 feature walk-through

- [x] **First-run location setup card** (ZIP entry + "Use my location" + inline error) — verified: fresh open with no `suite.location` renders the card (`interaction.txt` line 1; the v1/v2 screenshots in both themes are of this state).
- [x] **ZIP lookup via zippopotam.us** — verified live: ZIP 90012 -> `suite.location = {"lat":34.0614,"lon":-118.2385,"label":"Los Angeles, CA"}`, board boots (`interaction.txt` line 2). 404-means-not-found semantics preserved: `Suite.fetchJSON` breaks retry on 404 and throws -> "Couldn't find that ZIP." path intact.
- [x] **ZIP validation** (`/^\d{5}$/` -> "Enter a 5-digit ZIP.") — code path identical to v1; the regex guard runs before the live call.
- [x] **Enter submits ZIP** — v1's keydown handler kept verbatim.
- [x] **Geolocation path** — code identical to v1 (getCurrentPosition -> setLoc -> boot; denial message kept). Not live-driven (no geolocation grant in the harness); logic unchanged apart from `addEventListener`.
- [x] **Locbar with label + "change"** — verified: "Near **Los Angeles, CA** change"; `change` re-opens the setup card (same wiring as v1).
- [x] **Live WFIGS incident query (bounding-box envelope around the user)** — verified live from seeded LA: **135 incidents** returned and cached; sample: **"CALTRANS FRP RX" — 129.2 acres, null% contained, US-CA** (`interaction.txt` lines 4-5). URL construction byte-identical to v1.
- [x] **Distance computation (haversine)** — verified: nearest 7 km; card distances under "Nearest first" are ascending and all <= the 250 km radius (`interaction.txt` lines 12-13).
- [x] **Radius slider (50-800 km, persisted)** — verified: 250->800 km grew the board from 62 to 106 fires (3,142 -> 222,530 total acres); label updates; `suite.wildfire.radius` written (lines 14-15, 18).
- [x] **Sort modes** — verified: "Largest first" yields descending acres [97458, 27393, 26464, 17042, 15526]; "Newest first" puts a Jul 15 2026 discovery on top; "Nearest first" ascending distances; `suite.wildfire.sort` persisted (lines 16-18).
- [x] **Stats row (count / total acres / nearest)** — verified: "62 within 250 km · 3,142 total acres · 7 km nearest" (lines 6-8).
- [x] **Fire cards** (name, Rx badge, state/type/discovered sub-line, acres, containment % + bar, "Containment not reported" fallback, distance) — verified in the after-interaction screenshot: cards render all facts; the live set includes a reported-containment card (SUMMIT, 84% with green bar), unreported ones, and Rx incidents.
- [x] **Instant paint from cache, then network refresh** — kept: `load()` paints the cached envelope before `Suite.fetchJSON` resolves, exactly as v1.
- [x] **Timestamp stamp / connection-issue stamp** — verified: "Data from 3:10 PM" fresh; offline: "Data from 3:10 PM · connection issue: offline — showing cached data" with the `.err` class (lines 9, 19).
- [x] **Stale-cache offline path** — verified per the addendum: cache aged 24 h, all http(s) aborted, reload -> 62 cached cards + err stamp render, screenshot `offline-stale.png` (lines 19-20).
- [x] **No-cache offline path** ("Couldn't reach WFIGS" card) — code path identical to v1 (`state.fires` null -> msg card); not separately driven since the stale path covers the offline branch.
- [x] **Calm empty state** ("No active fires within N km") — code identical to v1; not observable live (LA in July has 62 fires within 250 km — the point of the seed).
- [x] **15-min auto-refresh timer + refresh on tab visibility** — kept verbatim; the 30-min cache TTL now gates how often those triggers hit the network (see TTL note).
- [x] **Theme toggle** — harness probe: light -> dark, `aria-pressed=true`.

## changes beyond the recipe

- **Cache payload shape** (backward-compatible): v1 cached the *mapped* fires array under `suite.cache.wildfire.all`; `Suite.fetchJSON` caches the raw WFIGS GeoJSON under the same key. `mapFires()` accepts both shapes, so a v1 user's existing cache still renders (the array branch recomputes distance with the same haversine — identical values for an unchanged location).
- **TTL policy (policy-mandated, API-AND-RELAY §2)**: v1 fetched on every `load()` (boot, 15-min timer, every tab focus) with no TTL. v2 declares `cacheTtlMin: 30`; within 30 min those triggers serve the fresh cache without a request. Justification for 30 (allowed band 30-60): WFIGS "Current" incident attributes sync from IRWIN on a roughly 15-60-min cadence and size/containment figures move on an hour scale, so 30 min stays comfortably inside the data's real update rate while roughly halving v1's request volume; 60 felt too slow for an active-fire board people check during an event.
- **Footer text**: "Refreshes about every 15 minutes" -> "about every 30 minutes" so the shipped text matches the declared TTL (the 15-min timer stays, but network refresh is TTL-gated). Only content change in the file.
- **Stale wording**: on `r.stale` the stamp shows v1's own error-stamp language ("connection issue: offline — showing cached data") — the same pattern the quakes migration used; v1 had no distinct stale state because its fetch helper never fell back.
- **zippopotam lookup left uncached** (no `cacheKey`): a one-shot setup interaction; caching per-ZIP keys would create storage keys v1 never wrote, and a cached miss would muddy the "not found" UX. Same call shape as the quakes migration.
- **`locLabel` via `textContent`** instead of interpolating `esc(loc.label)` into the shell template — DOM-first per the recipe's "prefer textContent for new code"; rendering identical.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (core) |
| `suite.location` | yes | yes (`Suite.location`) — same JSON shape |
| `suite.wildfire.radius` | bare number string | byte-identical ("250"/"800") |
| `suite.wildfire.sort` | bare string | byte-identical ("dist") |
| `suite.cache.wildfire.all` | `{t, v:[mapped fires]}` | same key, `{t, v:rawGeoJSON}` — v2 reads both shapes |

`localstorage.json`: `keysOnlyInV1: []`, `keysOnlyInV2: []`.

## escape allowlist requests

All remote-data interpolations (`f.name`, `f.state`, `f.type`, ZIP place fields) are wrapped in `Suite.esc()` — v1's `esc()` was a no-op `String()` cast, so v2 strictly hardens here. Provably-safe unwrapped expressions:

- `${state.radius}` (range `value` attribute + two stat/msg texts) — `parseFloat` of a range input / stored number; always numeric.
- `${state.sort==="dist"?" selected":""}` (and `size`/`new` variants) — ternary over string literals.
- `${fires.length}` — array length, number.
- `${totalAcres>=1000?Math.round(totalAcres).toLocaleString():Math.round(totalAcres)}` — arithmetic over numbers.
- `${nearest!=null&&isFinite(nearest)?Math.round(nearest)+" km":"—"}` — number or literal.
- `${acres}` — `Math.round(...).toLocaleString()` / `.toFixed(1)` of a numeric field, or the "—" literal.
- `${pct!=null?pct+"%":"—"}` and `width:${pct}%` — `pct` is `Math.max(0,Math.min(100,...))`-clamped, so numeric.
- `${name}` — composition of an already-`Suite.esc()`-ed string plus the literal Rx-badge markup.
- `${sub}` — join of already-escaped parts and `"discovered "+fmtDate(...)` (`toLocaleDateString` output).
- `${contain}` — locally built HTML whose only interpolation is the clamped `pct`.
- `${Math.round(f.dist)}` — number.
- `fires.map(fireCard).join("")` — local HTML built by the functions above.

## a11y applied

- `aria-label="US ZIP code"` on the setup ZIP input (was placeholder-only).
- `Suite.liveRegion()` on `#setupErr`, `#stats`, and `#stamp` (async-updating regions).
- `<label for="rad">` and `<label for="sortSel">` — v1's labels were unassociated.
- Enter-submits-ZIP kept from v1; theme-button labeling/`aria-pressed` from core.
- All `onclick=`/`.onX=` handlers converted to `addEventListener` (zipBtn, geoBtn, changeLoc, rad input, sortSel change).

## endpoints

- `https://services3.arcgis.com` — WFIGS Incident Locations Current feature service (NIFC). In CATALOG.md (§2.3 and the CORS table, `services3.arcgis.com/T4QMspbfLg3qTGWY`). Present.
- `https://api.zippopotam.us` — ZIP setup lookup. In CATALOG.md (CORS table). Present.
- **No map/tile/image hosts**: verified in source — the tool renders no imagery; its only network calls are the two JSON fetches above. CATALOG §2.3 mentions optional WFIGS perimeters and NASA FIRMS; v1 never used them and v2 adds nothing.

## concerns for the reviewer

- **Geolocation and the calm/empty/no-cache branches were not live-driven** (harness has no geo grant; LA-in-July guarantees fires). The code in those branches is v1's verbatim apart from the mechanical conversions; flagging for the Phase 4 smoke/a11y audit rather than pretending they were exercised.
- **v1-era cache readers**: if a v1 user's cached array is served stale, distances are *recomputed* against the current location (v1 showed the fetch-time distances). Only observable if the user changed location while offline with a pre-v2 cache — arguably a fix, but it is a micro-divergence.
- **Footer text changed** (15 -> 30 minutes) to match the declared TTL — the one visible content diff in the side-by-side screenshots; everything else is pixel-equal.
- **"null% contained" in a log line** is the harness printing a raw cache field, not a UI defect — the UI renders "Containment not reported" / "—" for null containment (v1 behavior, confirmed in the after-interaction screenshot).
- Console during verification: only `net::ERR_FAILED` resource errors from the deliberate offline abort; the harness classifies those as non-hard, zero other console output.
## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks against tools/wildfire.html from file:// in both themes, WFIGS + zippopotam
route-fulfilled with a 5-incident fixture (incl. an Rx burn and a null containment); raw
measurements in [a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | zero symbol-only buttons/links |
| 2 | aria-live on async containers | pass | `#stats` + `#stamp` are `Suite.liveRegion`; first-run `#setupErr` live; the incident list is deliberately not live (bulk content, stamp announces updates) |
| 3 | Keyboard paths | pass | keyboard-only: ZIP + Enter → board; radius slider responds to arrows with live "km" label; sort `<select>` via arrows (logged) |
| 4 | Input labels | pass | `#zip` aria-label; radius/sort have `<label for=>` |
| 5 | Contrast, both palettes | **fixed** | the bold acreage figure (18.4px/700 → 4.5:1 required) in light `--fire` #c94f2b measured **4.46:1** — nudged to #c74e2b (4.54:1; dark unchanged at 5.5:1); `.stamp.err` → theme-split `--stale`, `.err-inline` → theme-split `--errsoft` (same failing pairs as quakes/rivers). Containment bar #3a7d44 vs chip track 4.3:1 (≥3), fire card border-left 4.2:1 |
| 6 | Focus visibility | pass | core `:focus-visible` outline confirmed via real-Tab probe |

Suite-wide flag (not fixed locally): `--muted` on `--bg` = 4.36:1. No behavior change;
re-verified with `node verify-tool.mjs wildfire` — exit 0, evidence files in this directory regenerated 2026-07-16.
