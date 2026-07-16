# geo.html migration report (Batch B)

## v1 feature walk-through

- [x] **Shared location bar** — renders "Suite location: <label> (lat, lon)" from `suite.location`, or the "No suite location saved yet" prompt. Verified both states: interaction.txt line 1 (seeded LA renders), line 11 (updates live after "save as suite location"); empty state visible in the four theme screenshots.
- [x] **Forward geocode, Open-Meteo source** — live-verified with "Denver": name=Denver, Colorado, United States · pop 729,019, coords 39.739150, -104.984700 (interaction.txt line 8). Result card shows name/sub/coords/source-tag exactly as v1.
- [x] **Forward geocode, Census source (JSONP)** — live-verified with "1600 Pennsylvania Ave NW, Washington, DC": matched address `1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500`, coords 38.898699, -77.035188 (line 13). JSONP path kept byte-equivalent to v1 (see concerns).
- [x] **Forward geocode, Nominatim source** — code path identical to v1 (same URL, same email param, same mapping); not live-exercised to stay within the one-request etiquette budget for Nominatim — the reverse lookup exercises the same `nominatim()` helper, throttle, and renderer end-to-end.
- [x] **Reverse geocode (Nominatim, 1 req/s throttle)** — live-verified with 38.8977, -77.0365 → "White House", full display_name, coords 38.897639, -77.036552 (lines 14–15). The v1 client-side throttle (`lastNom` + 1 s wait) is preserved verbatim and now wraps `Suite.fetchJSON`.
- [x] **parsePair input tolerance** — same function verbatim; exercised via reverse geocode and distance inputs.
- [x] **Decimal → DMS** — 38.8977, -77.0365 → `38° 53' 51.72" N` / `77° 2' 11.40" W` (line 2); matches hand computation (0.8977×60=53.862; 0.862×60=51.72).
- [x] **DMS → decimal round trip** — back to 38.897700 / -77.036500, conv-out echoes `38.897700, -77.036500` (lines 4–5).
- [x] **Distance & bearing (haversine, offline)** — LA→SF: 559.12 km · 347.42 mi, initial bearing 319.0° (NW), plus m/ft lines (line 6). Math is byte-identical to v1; 559.12 km matches the well-known LA–SF great-circle distance. Note: the task sheet suggested "~324°" but the forward-azimuth formula gives 318.96° for these coordinates (hand-checked: y=−0.05757, x=0.06575, atan2 → −41.2° → 318.8°); v1 produces the same 319.0°.
- [x] **"use in tools" button** — copies coords into decimal fields + Point A and runs the DMS conversion (line 9).
- [x] **"save as suite location" button** — writes `suite.location` `{"lat":39.73915,"lon":-104.9847,"label":"Denver"}` (v1 shape and property order), updates the loc bar, shows the transient "saved ✓" label (lines 10–11).
- [x] **Error UX** — empty-query, bad-pair, and failure hints preserved verbatim (same strings, same `.hint.err` styling); failure messages now go through the real `Suite.esc`.
- [x] **Theme toggle** — light → dark, `aria-pressed=true` (line 22).
- [x] **Visual parity** — v1/v2 screenshots indistinguishable in both themes; computed-style diff is only the pre-approved `-webkit-font-smoothing`.

## changes beyond the recipe

1. **Policy-mandated caching (API-AND-RELAY.md §2)** — v1 cached nothing. All three sources now cache in the `{t, v}` envelope under `suite.cache.geo.*` with a 7-day TTL: Open-Meteo and Nominatim via `Suite.fetchJSON` `cacheKey`/`ttl`; Census by hand in `censusGeocode()` (JSONP can't go through `fetchJSON`), same envelope, same TTL, same stale-on-failure fallback. **TTL justification (cacheTtlMin: 10080):** geocode answers are reference data — a place's coordinates and an address's location don't change on any timescale shorter than weeks, so the 7-day reference-data class fits exactly (same class and value as zip.html).
2. **Stale-offline rendering** — on network failure with a cached answer, results render normally plus an appended "Offline — showing cached results from <time>." hint (zip.html's pattern). Verified for all three sources (interaction.txt lines 16–21, offline-stale.png).
3. **`esc` is now a real escaper** — v1's local `esc()` was an identity function (`String(s)`, no escaping). v2 aliases `Suite.esc`. It is only used on error messages interpolated into `innerHTML`; result rendering was already createElement/textContent in v1 and stays that way.
4. **Enter-to-submit added** on decLat/decLon (→ DMS), dmsLat/dmsLon (→ decimal), and ptA/ptB (→ measure) — the a11y "Enter submits where a text-entry+button pair exists" rule; v1 only had it on fwdQ/revQ (kept).
5. **jsonp() `s.onerror` →** `s.addEventListener("error", …)` per the no-`.onX=` rule; all v1 `.onclick=` assignments converted to `addEventListener`.

## localStorage keys

| Key | v1 | v2 |
|---|---|---|
| `suite.theme` | ✓ (bare string) | ✓ identical (Suite.store writes strings bare) |
| `suite.location` | ✓ `{"lat":…,"lon":…,"label":…}` | ✓ byte-identical shape and property order via `Suite.location.set` |
| `suite.cache.geo.fwd.om.<query>` | — | new (policy caching, change 1) |
| `suite.cache.geo.fwd.nom.<query>` | — | new (policy caching) |
| `suite.cache.geo.rev.<lat,lon>` | — | new (policy caching) |
| `suite.cache.geo.census.<query>` | — | new (policy caching, manual envelope) |

localstorage.json: `keysOnlyInV1` empty; `keysOnlyInV2` is exactly the three cache keys written during the interaction — all explained above. Parity verdict: **pass**.

## escape allowlist requests

All in template literals assigned to `.innerHTML`; every remote-data interpolation is `Suite.esc()`'d (only `e.message` qualifies — result rendering is DOM/textContent). Provably-safe local expressions:

- `renderLocBar`: `l.lat.toFixed(4)`, `l.lon.toFixed(4)` — Number.prototype.toFixed output, digits/./- only. (The label and coords span are filled via `textContent` after the innerHTML skeleton, as in v1.)
- `showConv`: `lat.toFixed(6)`, `lon.toFixed(6)` — toFixed output.
- `measure`: `km.toFixed(2)`, `mi.toFixed(2)`, `brng.toFixed(1)`, `(km*1000).toLocaleString(undefined,{maximumFractionDigits:0})`, `(mi*5280).toLocaleString(undefined,{maximumFractionDigits:0})` — numeric formatting of local math; `compass` — element of a fixed 16-string literal array.
- `doForward` catch: `src === "census" ? "Census only covers US street addresses." : "Try another source."` — ternary over two string literals (`e.message` beside it IS escaped).

## a11y applied

- `<label for=…>` added to all 9 inputs/select (fwdQ, fwdSrc, revQ, decLat, decLon, dmsLat, dmsLon, ptA, ptB) — v1 labels were unassociated.
- `Suite.liveRegion()` on the five async/result containers: `#locBar`, `#fwdRes`, `#revRes`, `#convOut`, `#dbOut`.
- Enter submits on every text-entry+button pair (change 4 above; v1 already covered fwdQ/revQ).
- No icon-only buttons (all buttons have text); theme button labeled by core; no overlays, so no Esc handling needed.
- Result-card actions are real `<button>`s (v1 already) — keyboard path complete.

## endpoints

- `https://geocoding-api.open-meteo.com` — in CATALOG (§9.2, quick-reference `*.open-meteo.com`).
- `https://nominatim.openstreetmap.org` — in CATALOG (§9.2 + quick-reference; 1 req/s, identify yourself — the v1 email param and client throttle are preserved).
- `https://geocoding.geo.census.gov` — in CATALOG (§9.2 + quick-reference: "✗ fetch / ✓ JSONP").

All three hosts appear in CATALOG.md; no CATALOG update needed.

## concerns for the reviewer

1. **PROMINENT — Census JSONP vs the dist CSP.** v1's Census path is real JSONP (script-tag injection with a `callback=` param), and it still is in v2 — the Census geocoder **still does not support CORS** as of 2026-07-15. Evidence: (a) curl GET with `Origin: https://example.com` returns 200 with **no** `Access-Control-Allow-Origin` header (`Vary: Origin` only); OPTIONS preflight returns no CORS grant; (b) from the harness `file://` page, `fetch(...format=json...)` fails: "Census plain-fetch CORS probe (from a file:// page): fetch FAILED: Failed to fetch" (interaction.txt line 12). So JSONP→fetch conversion is **not** possible and the JSONP code is kept, working, in `tools/geo.html` (proven live, line 13). **But dist files carry a hash-based `script-src` CSP, which will block the injected `<script src=…>` — the Census source option will fail in `dist/geo.html` with "Search failed (script load failed)".** I have not weakened anything; the orchestrator decides (options: add `https://geocoding.geo.census.gov` to that one file's `script-src`, accept the broken-in-dist state with a UI note, or drop the Census option). Note `endpoints` in the manifest feeds `connect-src`/`img-src` only — listing the host there does not by itself permit JSONP.
2. **JSONP is inherently full script execution** from geocoding.geo.census.gov — same trust model as v1, unchanged, but worth stating: a compromised Census endpoint could run arbitrary JS in the page. This is precisely what the CSP dislikes about it.
3. **Nominatim forward-search not live-fired** (etiquette: one Nominatim request per run; the reverse lookup covers the shared helper, throttle, and renderer). The forward mapping code is a verbatim v1 port.
4. **Bearing "expected ~324°" in the task sheet is not what the math gives** — the forward azimuth for 34.0522,-118.2437 → 37.7749,-122.4194 is 318.96°; v1 and v2 both render 319.0° (identical formula). Distance 559.12 km matches the sheet's ~559.
5. **Per-query cache growth** — each distinct query writes one `suite.cache.geo.*` key (~0.7–3.5 KB observed). No eviction beyond TTL-overwrite; typical personal use is dozens of keys. settings.html's per-tool cache purge (Phase 4) covers cleanup. Flagging, not fixing — no v1 behavior existed here to preserve.
6. **`suite.location` values diverge at end of interaction** (v2 saved Denver via the save button; v1 kept the seeded LA) — key *sets* are the parity criterion and they match; the divergence is the exercised feature itself.

## orchestrator addendum — dist CSP verification (2026-07-15)

scriptEndpoints wired through build.py (the first build omitted the host — caller fix). Direct
test on dist/geo.html from file://: injected the Census JSONP script under the built CSP —
callback fired with "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500", zero CSP violations.

## Phase 4 audit fix: bounded query cache (2026-07-16)

Concern 5 above (per-query cache growth, no eviction) is now fixed. Key naming is unchanged;
after every lookup that writes a cache envelope (`pruneGeoCache()` called after the Open-Meteo
fetch, inside the `nominatim()` helper, and after the Census JSONP `Suite.store.set`), the tool
keeps only the newest `GEO_CACHE_MAX = 20` `suite.cache.geo.*` envelopes, evicting oldest-first
by the `{t,v}` envelope's `t` stamp. The prune enumerates only keys prefixed `suite.cache.geo.`
— it can never touch another tool's keys — and is wrapped in try/catch so it can never break a
lookup.

Proof: `tests/interactions/geo.mjs` gained a probe (route-fulfilled, zero live requests):
seed 25 synthetic geo envelopes with distinct ages plus one non-geo cache key
(`suite.cache.other.keepme`), run one more forward geocode fulfilled from a route, assert.
interaction.txt:

    prune probe query (route-fulfilled) after seeding 25 geo cache keys: name="Prunetown"
    cache prune: 20 suite.cache.geo.* keys after the query (bound 20); newest seed kept=true, oldest seed evicted=true, new query kept=true, non-geo cache key untouched=true

Harness re-run: `node verify-tool.mjs geo` exit 0. Real geo cache keys stashed/restored around
the probe, so the parity snapshot keeps the original key set.

## Phase 4 a11y audit

Re-verified 2026-07-16 against QUALITY.md §2 (Phase 4 audit addendum). Full runtime log in
`a11y-phase4.txt` (harness: `tests/a11y-phase4-batch.mjs`; Open-Meteo/Nominatim/Census-JSONP all
route-fulfilled — zero live geocoder requests in the audit run).

| # | Checklist item | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | icon-only controls named | n-a | no icon-only buttons or links render (all buttons worded) |
| 2 | aria-live on async containers | pass | runtime `aria-live=polite` on #locBar, #fwdRes, #revRes, #convOut, #dbOut |
| 3 | keyboard path | pass | forward geocode (Enter in #fwdQ), "use in tools"/"save as suite location" (Tab+Enter), DMS conversion (Enter in fields), distance/bearing (Enter in #ptB), reverse geocode (Enter in #revQ) — all keyboard-only; no positive tabindex; no overlays |
| 4 | input labels | pass | all 9 inputs + the source `<select>` have `<label for>` (each enumerated at runtime) |
| 5 | contrast, both palettes | fixed | see below — 1 tool-local failure fixed, 2 suite flags |
| 6 | focus visibility | pass | 8/8 tabbed elements show the core 2px accent outline |

Contrast measurements:
- FIXED: `.btn.primary` (+ :hover) was `#fff` on `var(--accent)` — **2.36:1 dark**. Now
  `color: var(--bg)` (5.26:1 light / 7.60:1 dark).
- SUITE FLAG (not fixed locally): `--muted` on `--bg` = **4.36:1 light** (footer);
  `--muted` on `--chip` = **4.10:1 light** (`.src-tag` result badges, `code`). Dark passes both.
- Passing spot-checks: tool accents `--warn`/`--bad` already 3-layer from migration; `.co`
  accent mono 5.26/7.60; `.hint` on card 4.76.

Fixes made: the `.btn.primary` color swap above (tools/geo.html only).
Harness after fix: `node verify-tool.mjs geo` → exit 0 (live Open-Meteo/Census/Nominatim,
stale paths, bounded-cache prune probe).
