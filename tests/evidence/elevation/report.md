# elevation.html — migration report (Batch B)

Evidence produced by `node verify-tool.mjs elevation` (exit 0). Screenshots: `v1-*.png` /
`v2-*.png` (both themes), `v2-after-interaction.png`, `offline-stale.png`. Interaction record:
`interaction.txt`. Style diff: `computed-style-diff.txt`. Storage parity: `localstorage.json`.

## v1 feature walk-through

- [x] **Single-point elevation (Point A → USGS EPQS, US)** — live-verified with seeded LA
  (34.0522, −118.2437): rendered **284 ft (= 86.7 m), badge "USGS"**; cache entry
  `suite.cache.elevation.34.05220,-118.24370 = {"t":…,"v":86.707595825,"src":"USGS"}`
  (interaction.txt lines 4–5).
- [x] **Open-Elevation fallback (non-US / EPQS failure)** — code path preserved verbatim
  (`inUS` gate → `epqs` → `openElevationPoint`); exercised indirectly via the offline
  uncached-point test (Paris coords route through the fallback and fail honestly, line 24).
  Not live-exercised for a non-US point — one exercise per source (etiquette); the profile run
  is the live Open-Elevation proof.
- [x] **Two-point profile A → B** — live-verified LA → Mount Wilson: **"25.68 km (15.95 mi)
  great-circle, 60 samples"**, stats **min 284 ft / max 5,627 ft / +6,192 ft climb / −850 ft
  descent / 5,342 ft relief**; chart renders (1 profline path, 1 area path, 5 gridlines,
  10 axis labels) — lines 7–13 and both post-interaction screenshots.
- [x] **Batch/throttle behavior preserved** — v1 samples N=60 points and POSTs cache misses to
  Open-Elevation in chunks of 100 → a 60-sample profile is exactly **ONE POST**. N=60 and CH=100
  kept byte-identical; verification ran one profile per version (no loops, no retries;
  `Suite.fetchJSON` used with default `tries: 1`).
- [x] **Per-point cache reuse** — 60 unique cache entries after point + profile (Point A
  coincides with sample 0, so the profile POST covered only the 59 misses) — line 14.
- [x] **Unit toggle (feet/meters) re-renders last point + last profile** — 284 ft → 86.7 m
  (point, line 6) and min stat 284 ft → 87 m (profile, line 17).
- [x] **Hover readout + dashed line/dot on the chart** — mid-chart hover: **"12.19 km from A ·
  elevation 843 ft"** (line 15).
- [x] **Swap A↔B** — values exchanged and restored (line 18).
- [x] **Validation messages** — empty Point B → "Enter a valid Point B to draw a profile."
  (line 19); the lat/lon range checks and same-point check are unchanged code.
- [x] **Geolocation for A + suite.location sync** — code path preserved (`Suite.location.set`
  writes the same `{lat, lon, label}` shape); not exercised live (Playwright context has no geo
  permission — the denial branch shows v1's error text). Locbar prefill proves the read side.
- [x] **Saved-location bar + "fill into Point A" + boot prefill** — hidden on fresh open
  (line 1); after seeding LA: "Saved location: Los Angeles, CA — fill into Point A", inputs
  prefilled 34.052200 / −118.243700 (lines 2–3).
- [x] **Error card when both providers fail and nothing cached** — offline + uncached Paris
  point → "Couldn't fetch elevation" card (line 24, visible in v2-after-interaction.png).
- [x] **Offline from cache** — v1 served any-age cache silently with a "· cached" badge; v2
  serves fresh (<7 d) cache identically, and past-TTL cache now renders the stale state (below).
- [x] **Theme toggle** — light → dark, aria-pressed=true (line 25); both-theme screenshots match v1.

## stale-cache offline path (Batch B addendum)

TTL is 7 days, so the cache was aged **8 days** (the addendum's generic 24 h would still be
fresh) and all http(s) routes aborted. Reload → point lookup renders **"284 ft — USGS · cached"**
plus **"Offline — cached from 7/7/2026, 3:33:46 PM."**; profile renders all 60 cached samples
with the same offline note (lines 20–23, `offline-stale.png`). Stale data always says when it's
from — never pretended fresh.

## changes beyond the recipe

- **TTL semantics (policy-mandated, API-AND-RELAY.md §2):** v1's per-point cache never expired.
  v2 keeps the same keys/envelope but honors `cacheTtlMin: 10080` (7 days): entries younger than
  7 days short-circuit exactly like v1; older entries refetch, and serve as the visible-stale
  fallback when the network fails. **Justification for 10080:** terrain elevation is immutable
  reference data (7-day class per §2); the TTL exists only so a corrected upstream DEM
  eventually propagates, while keeping repeat lookups free.
- **Per-point cache stays tool-local (not `Suite.fetchJSON`'s cacheKey):** the cache stores the
  *derived* value `{t, v: meters, src}` per coordinate — shared between both providers and
  between point/profile lookups — which a per-URL response cache cannot express, and v1 users'
  existing entries must keep working. Reads/writes go through `Suite.store` at the byte-identical
  v1 keys.
- **Fetch conversion:** EPQS single point and the Open-Elevation single-point fallback go through
  `Suite.fetchJSON` (the fallback converted from a POST-of-one to the documented GET form
  `…/lookup?locations=lat,lon` — CATALOG.md line 406). The **profile batch POST keeps a local
  `fetchTimeout` wrapper** because `Suite.fetchJSON` is GET-only and core is frozen during Batch B;
  its results land in the same per-point cache. v1 timeouts preserved (9 s EPQS, 20 s O-E).
- **Error-message plumbing:** provider HTTP failures now read "HTTP 503" (Suite.fetchJSON's text)
  instead of v1's "EPQS HTTP 503" — visible only inside the error card's parenthetical.
- **Removed v1's double-escape:** v1 ran `escapeHtml()` on error messages before passing them to
  `showErr`, which assigns via `textContent` — so `&` rendered as `&amp;` on screen. v2 passes the
  raw string to the same `textContent` sink (still injection-safe, now displays correctly).
- **Stale rendering added** (required by the addendum): "Offline — cached from <time>." line on
  the point card and profile card, matching the suite's offline language (weather.html pattern).

## localStorage keys (v1 vs v2)

Identical — `localstorage.json` shows `keysOnlyInV1: []`, `keysOnlyInV2: []` after equivalent
interactions (seeded location → one point lookup → one profile) on both versions:

| Key | v1 | v2 |
|---|---|---|
| `suite.theme` | ✓ | ✓ (via Suite.theme) |
| `suite.location` | ✓ | ✓ (via Suite.location) |
| `suite.cache.elevation.<lat5>,<lon5>` ×60 | ✓ | ✓ — same `{t, v, src}` shape and key order |

## escape allowlist requests

All rendering is `createElement`/`textContent` (v1 discipline preserved) except three
string-concat `innerHTML` writes, none of which interpolate remote strings:

- `'<div class="card msg"><span class="spin"></span> Looking up elevation…</div>'` — static.
- `'…Sampling ' + N + ' points along ' + distKm.toFixed(1) + ' km…'` — `N` is the literal 60;
  `distKm.toFixed(1)` is a formatted local number.
- `"<b>" + (distKm * i / (elev.length - 1)).toFixed(2) + " km</b> from A · elevation <b>" +
  fmt(elev[i]) + " " + unitLabel() + "</b>"` (readout) — `.toFixed(2)` of a local number;
  `fmt()` is `Number.prototype.toLocaleString` of an arithmetic result (a non-numeric API value
  yields the string "NaN"); `unitLabel()` returns the literal "ft"/"m".

Note these are `+`-concatenations, not template literals, so the `--check` heuristic should not
flag them; listed here for the record anyway.

## a11y applied

- `Suite.liveRegion()` on `#pointResult`, `#profResult`, `#formErr`, `#locbar`, and the profile
  `#readout` (async/updating result containers).
- Unit toggle: `role="group"` + `aria-label="Display units"` on the container, `aria-pressed`
  kept in sync on both buttons (verified: `aria-pressed(m)=true` after toggle, line 6).
- **Keyboard path for the chart-hover mouse path:** the profile SVG is focusable
  (`tabindex="0"`, `role="img"`, descriptive `aria-label`); ArrowLeft/ArrowRight step the same
  readout/crosshair the mouse drives; blur clears it. Verified: focus + 2×ArrowRight →
  "0.44 km from A · elevation 312 ft" (line 16). The visible readout copy stays v1's
  ("Hover the profile…") to preserve parity; the aria-label documents the keys.
- Enter in the Point A fields runs "Elevation of A"; Enter in the Point B fields runs the
  profile (text-entry + button pairs).
- All inputs already had `<label for>` in v1 (kept); no icon-only buttons exist; theme button
  labeling/`aria-pressed` comes from core. No overlays, so no Esc handling needed.

## endpoints

- `https://epqs.nationalmap.gov` — in CATALOG.md (§9.3 and the host table, marked "CORS verify");
  this run is a live CORS proof from a browser context (badge "USGS" rendered from a real fetch),
  so the orchestrator may want to touch its verification date.
- `https://api.open-elevation.com` — present in CATALOG.md §9.3 prose but **missing from the
  host summary table** (around line 504, which lists only EPQS for this tool) — flagging per the
  addendum for the orchestrator to add.
- Both are JSON APIs (connect-src); no image hosts.

## concerns for the reviewer

1. **The profile batch POST bypasses `Suite.fetchJSON`** (GET-only core helper; core frozen in
   Batch B). It keeps v1's AbortController timeout wrapper and feeds the same cache. If a
   `method`/`body` option ever lands in `Suite.fetchJSON`, this is the first call site to convert.
2. **Open-Elevation single-point fallback changed POST→GET** (documented form in CATALOG). The
   GET path was NOT live-verified against api.open-elevation.com in isolation — the live profile
   POST proves the host/CORS, but not that specific query form. If the reviewer wants it proven,
   one manual GET for a non-US point would do it (I avoided a second live source exercise).
3. **v1 caches never expired; v2 refetches after 7 days.** Marginally more network over months of
   use, but policy-aligned and stale-safe. A v1 user's old entries (any age) remain readable and
   serve as offline fallback.
4. Console shows 4 × `net::ERR_FAILED` during the interaction record — these are the deliberate
   offline-path aborts (the harness classifies them as non-hard); no other console output.
5. EPQS was healthy during verification; the EPQS-timeout → Open-Elevation fallback for US points
   was therefore only exercised by code inspection plus the offline test, not by a live EPQS
   outage.

## Phase 4 a11y audit

Re-verified 2026-07-16 against QUALITY.md §2 (Phase 4 audit addendum). Full runtime log in
`a11y-phase4.txt` (harness: `tests/a11y-phase4-batch.mjs`; USGS EPQS + Open-Elevation
route-fulfilled — zero live requests in the audit run).

| # | Checklist item | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | icon-only controls named | n-a | no icon-only buttons or links (all worded; A/B dots are decorative) |
| 2 | aria-live on async containers | pass | runtime `aria-live=polite` on #formErr, #pointResult, #profResult, #locbar, and the dynamically created #readout |
| 3 | keyboard path | pass | point lookup (Enter in a Point-A field), profile (Enter in a Point-B field), unit toggle (Tab+Enter, `aria-pressed`), and the SVG chart readout (`tabindex=0`, ArrowLeft/Right mirror hover) all keyboard-only; no positive tabindex; no overlays |
| 4 | input labels | pass | latA/lonA/latB/lonB all `<label for>` (enumerated at runtime) |
| 5 | contrast, both palettes | fixed | see below — 2 tool-local failures fixed, 2 suite flags |
| 6 | focus visibility | pass | 8/8 — buttons/links get the core outline; the number inputs keep the v1 pattern (tool CSS `outline:none` + `:focus` border flips `--line`→`--accent`), a visible indicator recorded in the log |

Contrast measurements:
- FIXED: `button.go` and `.unit-tog button.on` were `#fff` on `var(--accent)` — **2.36:1 dark**.
  Now `color: var(--bg)` (5.26:1 light / 7.60:1 dark).
- FIXED: the error red was hardcoded `#c0392b` (5.35:1 light but **3.00:1 on the dark card**) in
  `.err h2` and the #formErr inline style — now `--bad` added to the tool's existing 3-layer
  accent block (#c0392b light / #e0766a dark 5.41:1).
- SUITE FLAG (not fixed locally): `--muted` on `--bg` = **4.36:1 light** (footer);
  `--muted` on `--chip` = **4.10:1 light** (`code` spans). Dark passes both.
- Passing spot-checks: `--up`/`--down` stats are large bold text — 3.79/5.35 light ≥3.0,
  6.66/6.33 dark; `.srcbadge` accent-on-soft 4.95/6.30.

Fixes made: the CSS changes above (tools/elevation.html only; no behavior change).

Harness after fix: `node verify-tool.mjs elevation` could NOT reach exit 0 on 2026-07-16 —
**live-source failure, documented, not hammered** (2 runs + 3 probes, then stopped):
api.open-elevation.com's CORS preflight is 504-flapping (Node probe: OPTIONS answered 204 once,
then 504 with correct ACAO/ACAM headers; a real Chrome POST from file:// is therefore blocked —
"Response to preflight request doesn't pass access control check"). The v1 original fails the
same way in a browser today (its profile wait timed out), so this is environmental, not a
regression: the audit's change is CSS-only, and the tool's full point + profile + keyboard-readout
flow ran console-clean against route-fulfilled endpoints in `a11y-phase4.txt` (the targeted
verification). The last good live-source harness evidence is in git history (Batch B completion
commit ac2c83a); today's interaction.txt intentionally archives the degraded-source run.

Found in passing (pre-existing v2 bug, out of audit scope — spawned as its own task): when the
profile POST fails with nothing cached, elevationBatch's sparse new Array(n) plus
Array.prototype.some (which skips holes) lets a NaN chart render instead of the error card —
see the SVG "Expected length, NaN" console errors in today's interaction.txt.
