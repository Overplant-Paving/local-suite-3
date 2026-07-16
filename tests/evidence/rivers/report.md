# rivers.html migration report (Batch B)

## REQUIRED: which API does the source actually call? (MIGRATION row 32)

**v1 already targets the NEW USGS Water Data API** — `https://api.waterdata.usgs.gov/ogcapi/v0/collections`
(`latest-continuous` and `monitoring-locations` collections, params 00060/00065). The string
`waterservices.usgs.gov` (the legacy NWIS API sunsetting ~Q1 2027) **appears nowhere in the v1
source**; no API migration was needed. The v1 footer and in-page note both say "new API" and they
are truthful. The only `waterdata.usgs.gov` (non-`api.`) reference is the per-gauge `<a href>`
link-out to the station page — navigation, not a fetch, so not a CSP endpoint.

**However: v1 is broken live today** — see concerns. Fixed with a one-param URL trim, response
shape identical.

## v1 feature walk-through

- [x] **First-run location setup card** (ZIP + geolocation, saved to `suite.location`) — verified:
  interaction.txt line 1 shows the card on fresh open; live ZIP 90012 lookup via zippopotam.us set
  `{"lat":34.0614,"lon":-118.2385,"label":"Los Angeles, CA"}` and booted the board (line 2).
- [x] **ZIP validation + error line** — 5-digit regex, "Enter a 5-digit ZIP." / "Couldn't find that
  ZIP." paths preserved verbatim; Enter key submits (kept from v1).
- [x] **Geolocation path** — code preserved verbatim (Playwright denies geo; error-message path
  unchanged from v1: "Location denied. Try a ZIP instead").
- [x] **Nearby gauges: bbox query, two-request join (latest-continuous + monitoring-locations
  names), grouping by monitoring_location_id, 00060/00065 split, distance sort** — verified live:
  36 gauges rendered for LA, first card "Rio Hondo below Whittier Narrows Dam Ca · USGS 11102300 ·
  15 km away · 0 ft³/s discharge · 0.62 ft gauge height · Read Jul 15, 2:30 PM" (interaction.txt
  lines 5–12; dashboard-v1/v2 screenshots side-by-side, both themes, 36 gauges each).
- [x] **titleCase name expansion (Nr→near, Bl→below, Ab→above, R→River, C→Creek) and
  "Gauge <id>" fallback for unnamed stations** — visible live: "Rio Hondo below Whittier Narrows
  Dam Ca", "Gauge 342804118011501" (dashboard screenshots).
- [x] **Reading cards: fmtVal formatting (thousands separator / rounding / 2-dp), em-dash for
  missing param, unit labels** — visible across the 36 live cards (e.g. "91.20 ft³/s", "—" for
  missing discharge on Topanga Creek).
- [x] **Stale reading marker (>3 h, amber "· stale")** — live gauges with old readings show it
  (e.g. "Read Nov 4, 1:45 AM · stale" on Coyote Creek), same rendering in v1 and v2 dashboards.
- [x] **Favorites: star toggle, `suite.rivers.favs` persistence, ★ Favorites section, per-favorite
  by-id refetch, "favorite · couldn't refresh" placeholder** — verified: star click rendered
  "★ Favorites 1" with the placeholder text (favorites had not been fetched yet — v1 behavior),
  favs key written; after reload the live by-id fetch rendered the favorite with real readings
  (interaction.txt lines 15–22).
- [x] **Per-gauge link-out to waterdata.usgs.gov station page** — href verified:
  `https://waterdata.usgs.gov/monitoring-location/11102300/` (line 12).
- [x] **Location label bar + "change" button back to setup** — locbar renders "Near Los Angeles,
  CA change"; change wired via addEventListener.
- [x] **Data stamp ("Data from <time>") and error stamp ("connection issue: …")** — both observed:
  fresh "Data from 3:14 PM" (line 4) and offline "Data from 3:14 PM · connection issue: Failed to
  fetch" (line 23).
- [x] **Cache-first paint + offline fallback for nearby** (`suite.cache.rivers.near_<lat>_<lon>`,
  v1 envelope `{t,v}` with the grouped gauge list) — verified: envelope written live (line 14);
  after aging 24 h + blocking all network, reload still rendered all 36 cached cards with the
  error stamp (lines 23–24, offline-stale.png).
- [x] **"No active gauges nearby" empty state** — code path preserved verbatim (not triggered:
  LA has gauges; exercised implicitly in the earlier 400-failure run where it rendered).
- [x] **Flood-stage context note** (provisional readings, NWS AHPS caveat, rising-gauge cue) —
  rendered verbatim (line 13; screenshots).
- [x] **15-minute auto-refresh timer + refresh on tab visibility** — code preserved verbatim
  (setInterval 15 min; visibilitychange listener).
- [x] **Theme toggle** — light→dark flip with aria-pressed=true (line 26); dark screenshots match.

## changes beyond the recipe

1. **Dropped `&application=local-suite` from the three USGS URLs.** The OGC API now rejects
   unknown query params as property filters (HTTP 400 `InvalidQuery`, "At least one requested
   property wasn't found" — verified by curl 2026-07-15). **This breaks v1 live today.** Removing
   the param is the entire fix; response shape verified identical (features with
   `monitoring_location_id`, `parameter_code`, `value`, `unit_of_measure`, `time`,
   `geometry.coordinates`). See concerns.
2. **Policy-mandated TTL (API-AND-RELAY.md §2):** a nearby cache fresher than 15 min is served
   without a refetch (v1 refetched on every open); rendering identical. Justification for 15 min:
   USGS instantaneous values transmit on a ~15-minute cadence and v1's own refresh interval (and
   footer text) is 15 minutes.
3. **Policy-mandated per-favorite caching:** v1 fetched favorites uncached on every load; v2 routes
   them through `Suite.fetchJSON` with `cacheKey: rivers.fav_<id>`, ttl 15 min. Offline, the stale
   cache now renders the favorite's readings (with the card's own amber ">3 h · stale" reading-age
   marker) instead of v1's data-less "favorite · couldn't refresh" placeholder; the placeholder
   still renders when there is no cache at all. This is the addendum's serve-stale rule; the
   reading timestamp shown is always the gauge's real reading time, so stale data never pretends
   to be fresh.
4. **zippopotam ZIP lookup left uncached** — one-off user-triggered lookup; matches the canonical
   weather.html and every other Batch B tool (quakes, iss, air, alerts).
5. **aria-pressed added to star buttons** (a11y state exception allowed by the recipe).
6. v1's `esc()` was an **identity function** (`String(s)` — no escaping) despite being applied at
   every interpolation site; v2's `esc = Suite.esc` performs real HTML escaping at the same sites,
   plus two sites v1 left bare (see escaping below). No visual change for real data.

## localStorage keys (v1 vs v2)

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.location` | yes | yes (Suite.location, same shape) |
| `suite.rivers.favs` | yes | yes (Suite.store, same JSON array) |
| `suite.cache.rivers.near_<lat>_<lon>` | yes — `{t,v:[grouped gauges]}` | yes, byte-compatible — the manual grouped-result envelope is kept at the v1 key (Suite.fetchJSON is transport only for the two raw requests) |
| `suite.cache.rivers.fav_<id>` | no | **new** — policy-added per-favorite cache (change 3) |

localstorage.json: `keysOnlyInV1: []`; `keysOnlyInV2: ["suite.cache.rivers.fav_USGS-11102300"]` —
exactly the policy-added cache. **Note:** v1 could only produce its keys in the harness because
`v1Interact` strips the now-rejected `&application=` param via a Playwright route rewrite
(unmodified v1 400s and writes no cache keys at all); v1's own fetch/group/cache code ran on live
data. Documented in tests/interactions/rivers.mjs.

## escape allowlist requests

Interpolations into innerHTML not wrapped in `Suite.esc(` (all local/provably safe):

- `renderAll`: `${cards}` (x3) — HTML strings assembled by `gaugeCard()`, whose every remote field
  is already `Suite.esc()`'d; escaping again would destroy the markup.
- `renderAll`: `${favList.length}`, `${lastNear.length}` — `.length` of arrays, always a number.
- `gaugeCard`: `${disch}${height}` — HTML built two lines above with esc'd values.
- `gaugeCard`: `${on?" on":""}`, `${on?"Remove favorite":"Add favorite"}`, `${on?"true":"false"}`,
  `${on?"★":"☆"}`, `${stale?" stale":""}`, `${stale&&!g.offline?" · stale":""}` — boolean-selected
  string constants.
- `gaugeCard`: `${distTxt?" · "+esc(distTxt):""}` — the value half IS esc'd; the ternary shape may
  still trip the heuristic.

Remote data escaped (all fields from API responses): `esc(g.name)`, `esc(g.id)`, `esc(num)`,
`esc(url)`, `esc(fmtVal(q.v))`, `esc(fmtVal(h.v))` (v1 left both fmtVal sites bare — fmtVal
returns the raw remote value when non-numeric), `esc(distTxt)` (new), `esc(timeTxt)`,
`esc(loc.label)` (user/zippopotam data).

## a11y applied

- ZIP input: `aria-label="US ZIP code"` (was placeholder-only).
- Setup error line: `Suite.liveRegion(#setupErr)` — lookup errors are announced.
- Data stamp: `Suite.liveRegion(#stamp)` — fetch results/failures announced after load.
  (The gauge grids were deliberately NOT made live regions — announcing 36 re-rendered cards per
  refresh would be noise; the stamp carries the async status. Same call as quakes.html.)
- Star buttons: v1's `aria-label="Toggle favorite"` kept, `aria-pressed` state added; verified
  flipping to `true` on click (interaction.txt line 16).
- Theme button: aria-label + aria-pressed from core `Suite.theme.init()`.
- Enter submits the ZIP field (v1 behavior, kept). All interactive elements are real
  `<button>`/`<a>`/`<input>` — keyboard paths exist for every mouse path; no overlays, so no Esc
  handling needed. Focus-visible outlines from core.

## endpoints

- `https://api.waterdata.usgs.gov` — nearby (2 requests) + one per favorite. In CATALOG.md
  ("USGS water (new)", verified Jul 2026). **The CATALOG etiquette note "identify via
  `application=` query param" is now stale for this API** — the OGC endpoint rejects the param
  (concerns below); CATALOG's gotcha list should record this.
- `https://api.zippopotam.us` — first-run ZIP lookup. In CATALOG.md.
- `waterdata.usgs.gov` (no `api.`) — `<a href>` link-outs only, never fetched; excluded from the
  manifest endpoints (CSP `connect-src`/`img-src` do not govern link navigation).

## concerns for the reviewer

1. **PROMINENT (required check): no legacy API anywhere.** v1 calls the NEW
   `api.waterdata.usgs.gov` OGC API exclusively; `waterservices.usgs.gov` does not appear in v1 or
   v2. No migration risk from the ~Q1 2027 NWIS sunset.
2. **v1 is broken live as of 2026-07-15** — its `&application=local-suite` etiquette param now
   draws HTTP 400 `InvalidQuery` from the OGC API (unknown query params are treated as property
   filters; curl-verified: identical URL returns 200 without the param, 400 with it). v2 drops the
   param (trivial URL trim, identical response shape — within the "trivial swap" allowance).
   Consequences the orchestrator should act on:
   - CATALOG.md's "identify per etiquette" advice is unfulfillable for this API from a browser
     (custom User-Agent is CORS-forbidden; the query param is rejected). Suggest a CATALOG gotcha
     note dated 2026-07-15.
   - The side-by-side dashboard screenshots and the v1 localStorage parity run required a harness
     route that strips only that param from v1's requests so v1's own code could run (documented
     in rivers.mjs; dashboard shots produced by a scratchpad script with the same route);
     unmodified v1 renders "connection issue: HTTP 400" + "No active gauges nearby".
3. **Sample staleness in `latest-continuous`:** the collection returns some very old "latest"
   readings (one LA-area feature dated 2008). v1's `isStale`/amber marker handles this and v2 is
   identical, but reviewers eyeballing screenshots will see "Read Nov 4, 1:45 AM · stale" cards —
   that is the source's data, not a rendering bug.
4. **keysOnlyInV2 is non-empty by design** — the single policy-added `suite.cache.rivers.fav_<id>`
   key (addendum's cache-everything rule). No v1 key was renamed or dropped.
5. The offline favorite card renders stale readings rather than v1's empty "couldn't refresh"
   placeholder (change 3 above) — deliberate, per the serve-stale policy; flagging since it is a
   visible offline-behavior difference from v1.
6. Evidence console log shows only `net::ERR_FAILED` entries from the deliberate offline pass
   (harness-classified as non-hard); the live run is console-clean.

## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks against tools/rivers.html from file:// in both themes, the USGS OGC API + zippopotam
route-fulfilled with a 4-gauge fixture; raw measurements in [a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | the ★/☆ `.starbtn` is the tool's one symbol-only control — carries `aria-label="Toggle favorite"`, state `title`, and `aria-pressed` (all five instances enumerated and verified) |
| 2 | aria-live on async containers | pass | `#stamp` (data/offline announcements) + first-run `#setupErr` are `Suite.liveRegion`; the gauge grids are deliberately not live (bulk content) |
| 3 | Keyboard paths | pass | keyboard-only: ZIP + Enter → gauge board; Tab → `.starbtn` + Enter starred a gauge (aria-pressed=true, Favorites section rendered, `suite.rivers.favs` written) |
| 4 | Input labels | pass | `#zip` has `aria-label="US ZIP code"` |
| 5 | Contrast, both palettes | **fixed** | unstarred ☆ was `var(--line)` — **1.3:1** (invisible) → `var(--muted)` (4.8/6.8:1); starred ★ light `--star` #d9a521 2.2:1 → #b88c1c **3.04:1** — the star is a graphical control (state also in glyph shape ★/☆ + `aria-pressed`), so the 3:1 non-text minimum is the applied criterion; `.stamp.err`/`.g-time.stale` #c07f2d = 3.1:1 on light → theme-split `--stale` (#986424 / #c07f2d); `.err-inline` → theme-split `--errsoft`. Reading values (--water) pass both themes (5.4/6.5:1) |
| 6 | Focus visibility | pass | core `:focus-visible` outline confirmed via real-Tab probe (incl. star buttons) |

Suite-wide flags (not fixed locally): `--muted` on `--bg` = 4.36:1; `--muted` on `--chip`
(the .note box) = **4.10:1** — core-palette pairs. No behavior change; re-verified with
`node verify-tool.mjs rivers` — exit 0, evidence files in this directory regenerated 2026-07-16.

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.btn.primary`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
