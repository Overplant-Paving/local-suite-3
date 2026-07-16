# iss.html migration report (Batch B)

## v1 feature walk-through

Every v1 feature, each verified against the migrated tool (evidence: `interaction.txt`,
screenshots in this directory, run `node verify-tool.mjs iss`, exit 0):

- [x] **Live position poll (api.wheretheiss.at, satellite 25544, every 5 s)** — verified by the
  live fetch in `interact()`: stats rendered `27.18°N / 119.42°E / 425 km / 27,566 km/h`, and the
  raw payload is recorded from the cache envelope (`lat=27.177206989374 lon=119.42182421382
  altitude=425.40675098472 km velocity=27566.48205921 km/h visibility=eclipsed`).
- [x] **Stat blocks: latitude, longitude, altitude (km + mi), speed (km/h + mph)** — all five
  logged verbatim from the rendered DOM (interaction.txt line 1).
- [x] **Distance-from-you stat + you-marker (uses shared `suite.location`)** — seeded LA;
  rendered "6,749 mi FROM LOS ANGELES, CA"; you-marker circle present in `#overlay`
  (overlayCircles=3 = sun + you + ISS). Note: v1 iss.html has **no pass predictions** — the
  "when it passes over you" hub desc is covered by the distance + above/below-horizon line;
  SGP4 pass prediction is passes.html (Batch D). Verified at parity, nothing removed.
- [x] **Visibility line (daylight / Earth's shadow, above/below your horizon)** — rendered
  "In Earth's shadow · below your horizon" (interaction.txt line 3).
- [x] **World map: 8 land rings, graticule, equator emphasis** — landRings=8 logged; visually
  confirmed in all four screenshots.
- [x] **Day/night terminator + subsolar point** — overlay night polygon + terminator line
  (overlayPaths=2 before the track exists) and sun circle; visible in offline-stale.png.
- [x] **Ground track accumulates across polls (antimeridian-splitting path)** — second poll
  driven deterministically via `page.clock.fastForward(5000)`: position moved
  27.18,119.42 -> 27.04,119.56 and overlay paths went 2 -> 3 (track path appeared).
- [x] **Footprint ellipse** — footprintEllipses=1; visible around the ISS dot in screenshots.
- [x] **ISS marker with `<title>` tooltip** — circle present; title text built with textContent.
- [x] **Location chip toggles the ZIP/geolocation form** — click opens (open=true), closes on
  save and on Esc; chip label updates ("📍 Set location for distance" -> "📍 Beverly Hills, CA").
- [x] **ZIP lookup via api.zippopotam.us** — live-fetched 90210 -> wrote
  `suite.location = {"lat":34.0901,"lon":-118.4065,"label":"Beverly Hills, CA"}`, closed the
  form, re-painted the distance stat ("6,760 mi FROM BEVERLY HILLS, CA") — same repaint-on-save
  path as v1 (`if (last) paint(last)`).
- [x] **ZIP validation error** — code path identical to v1 (`Enter a 5-digit ZIP.` /
  `ZIP not found.` into #locErr); not driven live to avoid a wasted request.
- [x] **Geolocation button** — logic preserved verbatim (button label swap, error message
  "Couldn't get location (may need http://)."); not exercised (headless has no geolocation
  grant), same as v1 behavior.
- [x] **Error bar on fetch failure** — v1 message "Couldn't reach the tracker — retrying…" kept
  for the no-cache failure; the new stale branch is additive (see below).
- [x] **Polling pauses when tab hidden (`visibilitychange` + `document.hidden` guard)** —
  code preserved verbatim.
- [x] **Theme toggle** — harness probe: light -> dark, aria-pressed=true.

## changes beyond the recipe

- **Policy-mandated caching (Batch B addendum, fetch conversion):** v1 cached nothing. The
  position fetch now goes through `Suite.fetchJSON` with `cacheKey: "iss.pos", ttl: 0` — ttl 0
  because position data is inherently live (the tool polls every 5 s; any reuse window would
  serve a wrong position). The cache envelope exists purely for the offline fallback: on network
  failure with a cache present, the errbar renders "Offline — position cached from <time> —
  retrying…" and the cached position still paints (verified: offline-stale.png + interaction.txt
  lines 14-15). Rendering behavior on the success path is otherwise identical to v1.
- **ZIP lookup left uncached**, matching the canonical fetcher migration (weather.html does the
  same for its zippopotam call): it is a one-off user action whose result is persisted into
  `suite.location`, so a cache envelope would never be read back.
- `vis.innerHTML = ""` -> `vis.textContent = ""` (pure clear, identical behavior).
- The v1 `getLoc()/setLoc()` helpers are replaced by `Suite.location.get()/set()` (same key,
  same shape; Suite normalizes a missing `label` to `""` where v1 would have rendered
  "📍 undefined" for malformed stored data — strictly a hardening of an error case).
- Known v1 quirk preserved: after a theme toggle the map keeps the previous palette until the
  next 5 s repaint (drawBaseMap reads `--land`/`--grid` at paint time). v2 behaves identically
  (visible in v2-after-interaction.png); not a regression.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.location` | yes | yes (byte-identical shape `{lat,lon,label}`) |
| `suite.cache.iss.pos` | — | new — the policy-mandated `{t,v}` cache envelope for the offline fallback |

`localstorage.json`: keysOnlyInV1 = [], keysOnlyInV2 = ["suite.cache.iss.pos"] (explained above).

## escape allowlist requests

none — the tool builds all dynamic DOM with createElement/textContent (v1 already did); there is
no template-literal interpolation into innerHTML anywhere in the file.

## a11y applied

- `#zipInput` given `aria-label="US ZIP code"` (was placeholder-only).
- `#errbar` and `#locErr` wrapped in `Suite.liveRegion()` — offline/error status and ZIP form
  feedback are announced.
- **Deliberate omission:** `#stats`/`#visInfo` are NOT live regions — they repaint every 5 s and
  a polite live region would announce continuously.
- Enter in the ZIP input submits the lookup (text-entry + button pair rule) — verified live via
  `press("Enter")` in the harness.
- Location chip gets `aria-expanded` reflecting the form's open state (verified true/false in
  interaction.txt lines 8, 13).
- Esc closes the location form (verified, line 13).
- Theme button label/pressed state from core (`aria-label`, `aria-pressed`).
- Map SVG already had `role="img"` + `aria-label` in v1 (kept).

## endpoints

- `https://api.wheretheiss.at` — in CATALOG.md (section 3.1 and the CORS table, line 515).
  CATALOG notes ~1 req/sec; the 5 s poll is well inside it. Harness run makes ~6 position
  requests total (4 screenshot loads + 2 interaction polls); the stale-path request is
  route-aborted, not sent.
- `https://api.zippopotam.us` — in CATALOG.md (ZIP entry, line 325, and CORS table line 542).
  One live request per run.
- No image hosts: the map is locally generated inline SVG (no tiles).

`cacheTtlMin: 0` — justification: live positional telemetry; the tool's own 5 s poll interval is
the refresh policy (kept from v1), and TTL-based reuse would show a stale position as current.
The cache exists only for the stale-offline fallback, which never pretends freshness.

## concerns for the reviewer

- **Orchestrator note said "verify the pass-prediction rendering" — v1 iss.html has no pass
  predictions.** CATALOG section 3.1 marks passes as the L-complexity variant; this tool is cx
  "S" (position + distance + horizon line), and SGP4 passes live in passes.html (#71, Batch D).
  I verified the features v1 actually has; flagging in case the orchestrator expected otherwise.
- The manifest `desc` ("…and when it passes over you", given as the v1 hub desc) therefore
  slightly oversells this tool until passes.html lands; kept verbatim as instructed.
- `interaction.txt` shows one console error `net::ERR_FAILED` — that is the deliberately
  route-aborted fetch of the stale-path test; the harness filters net::ERR and exited 0.
- Computed-style diff: the only differences are `--built` (v1=undefined, v2=core palette value)
  on every selector — an unused core custom property inherited from `core/suite.css`; nothing
  references it in this tool, zero rendering effect.
- The v1/v2 side-by-side screenshots were captured at the harness's fixed 700 ms mark, before
  the first live fetch resolves, so both show the identical pre-data state (map + chrome, no
  stats). The data-rendered state is evidenced by v2-after-interaction.png and offline-stale.png;
  stat-block styling parity is additionally covered by the .stat CSS being carried over verbatim.
- localStorage writes now occur every 5 s while the tab is open (the ~500 B cache envelope).
  Deliberate consequence of the good-citizen cache; negligible churn, flagging for awareness.

## Phase 4 a11y audit (2026-07-16)

Re-verification of the QUALITY.md §2 checklist, executed against the running tool from
`file://` with `tests/phase4-a11y-net.mjs` — all network route-fulfilled from shape-matched
payloads behind a catch-all abort (zero live requests during the audit). Machine log:
`phase4-a11y.json` in this directory. Verdict: **fixed**.

| checklist item | verdict | evidence |
|---|---|---|
| 1. icon-only controls have accessible names | pass | none present |
| 2. async result regions carry aria-live | pass | `#errbar` -> `aria-live=polite`; `#locErr` -> `aria-live=polite` |
| 3. keyboard path for every mouse path | pass | primary flow driven keyboard-only (log below); no positive tabindex; no traps |
| 4. inputs labelled | pass | `input#zipInput[text]` (aria-label) |
| 5. contrast AA, both palettes | fixed | measured table below; remaining failures are suite-palette pairs (flagged, not fixable locally) |
| 6. visible focus indicator | pass | Tab-focus on `a.back`: `solid 2px rgb(47, 111, 106)` vs blurred `none 3px rgb(107, 114, 128)` |

### Keyboard-only drive of the primary feature (page.keyboard only)

- KEYBOARD: Enter on location chip opens form; aria-expanded=true
- KEYBOARD: ZIP + Enter -> location saved, form closed; chip now: 📍 Beverly Hills, CA
- KEYBOARD: Esc closes the location form (overlay path)
- live note: #stats repaints every 5 s from polling — aria-live deliberately omitted there (would announce continuously); the state-change regions (#errbar, #locErr) are live.

### Contrast measurements (computed from getComputedStyle, ancestor-composited backgrounds)

Light palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| .stat b | `#23282e` | `#fffdf9` | 14.61 | 3 | pass |
| .stat span | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .legend | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| #visInfo | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .errbar (probe) | `#c0392b` | `#f5f3ee` | 4.90 | 4.5 | pass |
| #locErr | `#c0392b` | `#fffdf9` | 5.35 | 4.5 | pass |
| .locchip | `#23282e` | `#fffdf9` | 14.61 | 4.5 | pass |
| footer | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |

Dark palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| .stat b | `#e7e5e0` | `#1d2026` | 12.96 | 3 | pass |
| .stat span | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .legend | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| #visInfo | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .errbar (probe) | `#f07167` | `#15171b` | 6.21 | 4.5 | pass |
| #locErr | `#f07167` | `#1d2026` | 5.64 | 4.5 | pass |
| .locchip | `#e7e5e0` | `#1d2026` | 12.96 | 4.5 | pass |
| footer | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |

### Fixes made (tool-local CSS/vars; no behavior changes beyond the one noted)

- `--err` var (all four theme contexts): `.errbar` and `#locErr` used `--iss` (`#d9534f`) as text — 3.57:1 / 3.90:1 in light. Error text now `#c0392b` light / `#f07167` dark (4.9:1 / 6.2:1). `--iss` itself is untouched (map marker + footprint fills, non-text).

### Suite-wide contrast failures — flagged, NOT fixed locally (core palette)

- Light `--muted` `#6b7280` on `--bg` `#f5f3ee` = **4.36:1** (needs 4.5) — affects: `footer`, `header .tag`.
- Same pair passes in dark (6.8:1). A ~one-step darker light `--muted` (e.g. `#61686f`, 4.9:1 on `--bg`) would clear every instance suite-wide; decision belongs to the orchestrator, not this tool.

### Verification

- `node verify-tool.mjs iss` -> exit 0 (live wheretheiss.at polling, ZIP path, offline-stale path green).
