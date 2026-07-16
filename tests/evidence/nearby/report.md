# nearby.html — migration report (Batch C, completer pass)

Draft provenance: a prior agent's unverified draft (`handoff/batchC-drafts/nearby.html`) was
diffed line-by-line against v1, found ~99% complete, fixed (one real bug, below), moved to
`tools/nearby.html`, and fully verified. Verification harness: exit 0; the one open item is
the real live Overpass fetch — both v1 endpoints were down upstream for the whole session
(see `overpass-outage.txt`; the interaction module re-takes the live path automatically on
rerun once `overpass-api.de/api/status` answers 200 again).

## v1 feature walk-through

- [x] First-run "Where are you?" card when no `suite.location` — initial harness load, both
  themes, both versions (v1/v2 screenshots); interaction.txt line 1.
- [x] ZIP validation (must be 5 digits) — driven: "1234" -> "Enter a 5-digit US ZIP." (line 2).
- [x] ZIP -> zippopotam.us geocode, saves `suite.location` with "City, ST ZIP" label — LIVE
  fetch verified (200): "Near Los Angeles, CA 90012" (line 3), submitted via the new Enter path.
- [x] "Use my location" geolocation — ported 1:1 (same `getCurrentPosition` options, same
  button-label/error flow), handler converted to `addEventListener`; not machine-driven
  (geolocation permission grants are unreliable on `file://` origins) — code-reviewed only.
- [x] Location bar "Near <b>label</b> change"; "change" returns to the first-run card — driven
  (lines 3-4).
- [x] 9 category pills with icons, active pill highlighted, click re-searches — Pharmacy,
  Library (and Coffee in the live path) clicked across the runs; visual parity in screenshots.
- [x] Radius select (4 options, default 1 mi 1600 m) — present and wired
  (`change` -> `doSearch`); not driven (identical `doSearch` path as the Search button, and a
  drive would spend a second query per the one-live-query budget).
- [x] Search -> Overpass query; results cached per `<cat>.<lat>_<lon>_<radius>` under the v1
  key — driven; cache envelope inspected (localstorage.json).
- [x] Cache-first render + fresh-cache network skip — proven in rl-backoff.txt (second Search:
  0 requests) and the stale path.
- [x] Primary -> kumi.systems mirror fallback (row 64: v1 already had it; kept) — verified
  DETERMINISTICALLY: primary route-aborted, mirror route-fulfilled a distinct payload;
  recorded request sequence `[primary -> mirror]` (line 11).
- [x] Result rows: name (`name|brand|operator|(Category)` fallback), address
  (housenumber + street), extra (opening_hours|brand), distance (m/km formatting), walking
  minutes — all visible in the canned render: "630 W 5th St · Mo-Su 10:00-20:00", "614 m",
  "1.70 km", "~x min walk" (line 12 + screenshots).
- [x] Distance sorting + way/center handling — canned node (614 m) sorts before canned way
  (1.70 km, positioned via `center`) (line 12).
- [x] Empty-result message ("Nothing found in this radius — try a larger one.") — string and
  branch identical to v1; not driven.
- [x] Failure state ("Couldn't reach Overpass. It may be rate-limited…") — driven +
  `error-state.png` (line 6).
- [x] Selection sync list <-> map — list click and keyboard select verified incl. the map dot
  gaining `.sel` (lines 9-10); dot-click -> scrollIntoView is the same shared handler, ported
  1:1, not machine-driven.
- [x] Vanilla slippy map: OSM tiles (LIVE loads, 6/6 HTTP 200 from tile.openstreetmap.org),
  Web Mercator dot placement, `fitZoom` by radius, red you-dot, attribution overlay (line 8).
- [x] Debounced resize redraw — ported 1:1, not driven.
- [x] Stale-cache render with "cached <time>" stamp and "Offline — cached from <time>." note —
  driven with network blocked + 24 h-aged cache; `offline-stale.png` (line 14).
- [x] Theme toggle persisting `suite.theme` — harness probe, light -> dark, aria-pressed (line 15).
- [x] NEW (Batch C rl mandate, not in v1): 429/504/403 backoff — throttle note "Overpass is
  rate-limiting — showing cached data from <time>." + doubled effective TTL, verified
  deterministically in `rl-backoff.txt` / `rl-note.png` (see concerns for why it runs outside
  verify-tool.mjs).

## changes beyond the recipe

1. **Cache TTL 30 min -> 60 min** (manifest `cacheTtlMin: 60`; burn-down row 64 mandates
   TTL + mirror for Overpass fair-use). Footer text updated 30 -> 60 accordingly.
2. **Overpass POST -> GET `?data=`** — `Suite.fetchJSON` is GET-only; Overpass documents the
   GET form (overpass-turbo uses it). Queries are ~200 chars encoded, far below URL limits.
   Untestable live during the outage — confirm on the live rerun.
3. **Cache value shape**: v1 cached the *processed results array*; v2 (via `fetchJSON`) caches
   the *raw Overpass response*. `toResults()` accepts both, so a v1 user's existing cache
   keeps rendering (keys unchanged; see localStorage section).
4. **Rate-limit backoff added** (Batch C `flags:["rl"]` requirement, new over v1): on
   HTTP 429/504/403 from both endpoints the effective TTL doubles (`ttlBoost`) and the
   throttle note renders over cached data.
5. **Real escaping**: v1's local `esc()` was an identity passthrough (`String(s)` only); v2
   binds `esc = Suite.esc` (actual HTML escaping). Name/address rendering was already
   DOM/textContent in v1 and stays so.
6. **ZIP error wording preserved**: `fetchJSON`'s generic "HTTP 404" is mapped back to v1's
   "ZIP not found" message.
7. **Completer fix of a draft bug**: the draft's `.card { display:block; … }` core-override
   defeated the `hidden` attribute (author display beats the UA `[hidden]{display:none}`),
   leaving the first-run card permanently visible once a location was set. Caught in the
   first run's screenshots; fixed with `.card[hidden] { display: none; }`; re-verified.
8. **zippopotam left uncached** — matches the dominant Batch B precedent (alerts, air, iss,
   quakes, almanac uncached; only marine caches it); the result is immediately persisted into
   `suite.location`, which is the durable artifact.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | identical (via `Suite.store`) |
| `suite.location` | JSON `{lat,lon,label}` | identical (via `Suite.location`) |
| `suite.cache.nearby.<cat>.<lat>_<lon>_<radius>` | `{t, v:[processed results]}` | same key, `{t, v:<raw Overpass response>}`; both value shapes readable (change #3) |

localstorage.json: `keysOnlyInV1: []`, `keysOnlyInV2: []` — exact key parity.

## escape allowlist requests

none — every template-literal interpolation into `innerHTML` is wrapped in `esc(` (bound to
`Suite.esc`); remaining `innerHTML` writes are static literals; all remote-data rendering
(names, addresses, hours, dot titles) uses `createElement`/`textContent`/property assignment.
Adversarial evidence: canned mirror payload carried the name `<b>Kumi & Mirror</b> Library` —
rendered as literal text, `document.querySelector(".item .nm b")` = null (interaction.txt
line 13).

## a11y applied

- `aria-label="US ZIP code"` on the ZIP input; `<label for="radius">` on the radius select.
- Enter submits the ZIP (text-entry + button pair rule) — used live in the harness.
- `Suite.liveRegion()` on `#list`, `#resStamp`, `#searchMsg`, `#frMsg`.
- Category pills carry `aria-pressed` reflecting the active category.
- Result rows: `role="button"`, `tabindex="0"`, Enter/Space select — keyboard selection driven
  in the harness.
- Map dots `aria-hidden="true"` (decorative duplicates; every dot action is reachable from
  the keyboard-focusable list).
- Theme button label/pressed state from core `Suite.theme.init()`.

## endpoints

| host | CSP use | CATALOG.md |
|---|---|---|
| `https://overpass-api.de` | connect-src | present (Overpass row + registry) |
| `https://overpass.kumi.systems` | connect-src | present (named as the mirror in the Overpass row prose) |
| `https://tile.openstreetmap.org` | img-src (plain `<img>` tiles) | present (Overpass row prose) |
| `https://api.zippopotam.us` | connect-src | present (Zippopotam rows) |

`cacheTtlMin: 60` — above the floor row 64 mandates for Overpass fair-use; tiles are
browser-cache-managed image loads; zippopotam is a one-off geocode persisted into
`suite.location`.

## concerns for the reviewer

1. **The live Overpass fetch is NOT captured — upstream outage.** overpass-api.de answered
   HTTP 406 to everything (even `/api/status`, any method/UA), kumi.systems' backend hung or
   429'd, and a third public instance also hung, while zippopotam/tile loads (also live in
   this evidence) were instant — full forensics in `overpass-outage.txt`. v1 fails identically
   right now. The interaction module probes `/api/status` node-side and takes the live path
   automatically: rerun `cd tests; node verify-tool.mjs nearby` after recovery to replace
   the canned-path evidence with live evidence. Until then this row's DoD "live fetch
   recorded" box is honestly open.
2. **POST->GET conversion rides on the same outage** (change #2) — standard API surface, but
   the live rerun is the proof.
3. **429 evidence lives outside the harness** (`rl-verify.mjs` + `rl-backoff.txt` +
   `rl-note.png` in this directory): a fulfilled HTTP 429 logs a non-`net::ERR` console error,
   which `verify-tool.mjs`'s console gate (correctly) refuses. The harness run itself is
   exit 0 with a clean console.
4. **`ttlBoost` never resets to 1** after a later successful fetch (persists until page
   reload). The addendum doesn't require a reset and the failure mode is benign (longer
   caching), but it's a deliberate simplification worth knowing.
5. **Bigger cache values than v1** — raw Overpass payloads (<=120 elements with tags) instead
   of v1's trimmed arrays; bounded by the query's `out … 120` and per-key overwrite.
6. **Not machine-driven** (ported 1:1, code-reviewed): geolocation button (file:// permission
   limits), radius-change re-search and dot-click scroll (same shared handlers as driven
   paths), empty-result branch, resize redraw.
7. **First-run screenshots show a focus ring on the ZIP input in v2 only** — core's
   `:focus-visible` a11y outline (QUALITY.md §2 "once in core") on the auto-focused input;
   the only other visual delta is the footer's mandated 30 -> 60 text (change #1).
8. The draft shipped one real bug (hidden-card, change #7 above) — an argument for keeping
   screenshot review in the loop for the remaining Batch C drafts.

## Phase 4 a11y audit (2026-07-16)

Independent re-verification of the QUALITY.md §2 checklist, executed in the running tool
(Playwright/Chrome from file://, light + dark, keyboard-only drive of the primary feature,
contrast computed from getComputedStyle with ancestor alpha-compositing).

| # | Checklist item | Verdict | Evidence |
|---|---|---|---|
| 1 | icon-only controls have accessible names | pass | unnamed: (none) |
| 2 | async/result regions carry aria-live | pass | runtime check below |
| 3 | keyboard path for every mouse path | pass | keyboard-only drive log below; no positive tabindex ((none)); no traps |
| 4 | inputs labelled | pass | unlabelled: (none) (labelled: 1) |
| 5 | contrast, both palettes | fixed (see below); remaining FAILs are the suite-wide --muted flags | full pair tables below |
| 6 | visible focus indicator | pass | light: all stops show an indicator; dark: all stops show an indicator |

### Contrast — light
```
contrast pairs (8 unique fg/bg combos):
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.1px/400 — footer ". Results cached 60 minutes per "
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 12.8px/400 — span#resStamp.stamp "2 found"
  pass 5.26 (need 4.5) fg=#2f6f6a bg=#f5f3ee 16px/700 — b "1.14 km"
  pass 5.26 (need 4.5) fg=#f5f3ee bg=#2f6f6a 14.4px/400 — button#searchBtn.btn.primary "Search"
  pass 12.09 (need 4.5) fg=#333333 bg=#f9fafb 10px/400 — div.map-attr "©"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 27.2px/700 — h1 "Nearby Finder"
  pass 13.39 (need 4.5) fg=#23282e bg=#f5f3ee 15.2px/600 — div.nm "Second Canned Pharmacy"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.link [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> select#radius [outline] -> button#searchBtn.btn [outline] -> a [outline] -> div.item [outline] -> div.item [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.link [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline]
```

### Contrast — dark
```
contrast pairs (8 unique fg/bg combos):
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 12.5px/600 — h2 "What are you looking for?"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.1px/400 — footer ". Results cached 60 minutes per "
  pass 7.6 (need 4.5) fg=#6fb5ae bg=#15171b 13.6px/400 — button.link "change"
  pass 7.6 (need 4.5) fg=#15171b bg=#6fb5ae 14.4px/400 — span "💊"
  pass 12.09 (need 4.5) fg=#333333 bg=#f9fafb 10px/400 — div.map-attr "©"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 27.2px/700 — h1 "Nearby Finder"
  pass 14.25 (need 4.5) fg=#e7e5e0 bg=#15171b 14.1px/700 — b "Los Angeles, CA"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.link [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> select#radius [outline] -> button#searchBtn.btn [outline] -> a [outline] -> div.item [outline] -> div.item [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.link [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline] -> button.cat [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached Coffee category control (BUTTON after 11 tab(s))
  Enter on Coffee category -> search ran, items rendered (keyboard category switch)
  Tab -> reached first result item (DIV after 13 tab(s))
  Enter on result item -> selected "Canned Test Pharmacy" (map dot sync: true)

### aria-live runtime check
  #list: aria-live=polite
  #resStamp: aria-live=polite
  #searchMsg: aria-live=polite
  #frMsg: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
- `.cat.on` and `.btn.primary` (+ its hover) text `#fff` -> `var(--bg)`: white on the dark-theme accent was 2.36:1; now 5.26:1 light / 7.60:1 dark.

### Notes
- Overpass was route-fulfilled with the canned payload throughout (upstream outage per the migration report — not hammered). OSM tiles aborted; zippopotam route-fulfilled.

### Suite-wide contrast flags (REPORTED, not fixed locally — core palette)

The light palette's `--muted` (#6b7280) misses WCAG AA 4.5:1 on two core surfaces
(it passes on `--card` at 4.76, and the dark palette passes everywhere, 5.5-6.8):

| pair | ratio | where it shows in this tool set |
|---|---|---|
| `--muted` on `--bg` #f5f3ee | **4.36** | core `footer` rule; tool taglines/hints/stamps on the page background (every tool) |
| `--muted` on `--chip` #efece4 | **4.10** | core `.chip`; tool-local chip-bg recreations (jobs #dataStamp, markets .caveat, settings/transit/passes `code`, airport chips, hub chips) |
| `--muted` on `--accent-soft` #e3efed | **4.11** | parks `.code` chip inside picker rows |

Root cause is the palette value, not any one tool: per the audit addendum these are
suite-wide failures — fixing them tool-by-tool would fork the palette across 71 files.
Suggested one-line core remedy (NOT applied): darken light `--muted` to ~#5f6670
(-> 5.23 on --bg, 4.91 on --chip, 5.71 on --card). Decision belongs to core.

### Harness re-runs
- `node verify-tool.mjs nearby` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
