# snow.html migration report (Batch B — CORS-open fetcher)

Evidence: this directory. Harness run: `node verify-tool.mjs snow` — exit 0, console clean
(the only console.error is the deliberate `net::ERR_FAILED` from the blocked-network stale-path
test, which the harness whitelists).

## v1 feature walk-through

- [x] **First-run card ("Where are you?")** when `suite.location` is absent — verified: harness
  loads with empty storage and the card renders (interaction.txt line 1, v1/v2 screenshots both
  themes show this state pixel-alike).
- [x] **ZIP lookup via zippopotam.us** (5-digit validation, saves `suite.location` with
  "City, ST" label, boots the board) — verified LIVE: ZIP 81657 → location chip
  "📍 Vail, CO · change", `suite.location` = `{"lat":39.6512,"lon":-106.3234,"label":"Vail, CO"}`
  (interaction.txt line 10, localstorage.json). The invalid-input message ("Enter a 5-digit
  ZIP.") and failure message ("ZIP not found.") texts are byte-identical to v1.
- [x] **"Use my location" geolocation path** — code preserved verbatim (button, "Locating…"
  progress text, error message "Couldn't get location (may need http://)."); not driven live
  (headless browser has no geolocation grant), same as other Batch B tools with this v1 card.
- [x] **Location chip ("📍 label · change") reopening the first-run card** — verified: clicked
  `.locchip`, first-run card reappeared, new ZIP accepted (interaction.txt line 10).
- [x] **Station list fetch with the AWDB filter-bug workaround** — the exact v1 URL
  `/stations?stationTriplets=*:*:SNTL&activeOnly=true` is preserved (CATALOG.md §2.6: `/stations`
  ignores network/state filter params) and stations are ranked nearest client-side with the same
  haversine. Verified LIVE: 913 trimmed stations cached; sample
  `{"t":"301:CA:SNTL","n":"Adin Mtn","st":"CA",...}` (interaction.txt line 7).
- [x] **Trimmed 7-day station cache at `suite.cache.snow.stations`** — same key, same
  `{t, v: trimmed}` envelope, same 7-day TTL, same trim fields (t/n/st/lat/lon/el). Verified:
  v1 and v2 snapshots of the key are the same shape and length (83233 chars both,
  localstorage.json).
- [x] **Nearest-8 grid + one combined SNWD/WTEQ `/data` request** (`duration=DAILY`, 9-day
  lookback, `centralTendencyType=MEDIAN`) — URL construction byte-identical. Verified LIVE
  twice: Los Angeles seed (nearest are ~212 mi away in NV — Rainbow Canyon, Lee Canyon Upper,
  Bristlecone Trail, Lee Canyon, all 0 in depth / 0 in SWE "As of 2026-07-14": the honest July
  designed state) and mountain location Vail, CO (Vail Mountain 4 mi, Summit Ranch 10 mi,
  Beaver Ck Village 11 mi, Mccoy Park 12 mi with SWE 0.1 in — real mid-July readings).
  Raw response evidence logged from the cache envelope (interaction.txt lines 8–9).
- [x] **Station card contents** — name, distance · state · elevation line, Snow depth / Snow-water
  eq. readings ("—" when null, value rounded to 0.1 + unit), "% of median SWE" bar (0–200% span,
  color bands ≥90 high / ≥60 snow / else low) or "Median SWE for today" fallback when SWE is
  null/median 0, "As of <date>" / "No recent data" footer — rendering code preserved verbatim;
  the July data exercised the median-fallback branch ("Median SWE for today 0.0\"" on cards).
- [x] **Favorites (star → "Following" section, `suite.pref.snow.fav`)** — verified: starred
  "Vail Mountain", sections became [Following | Nearest stations], key wrote
  `["842:CO:SNTL"]`, star shows `.on` + `aria-pressed=true` (interaction.txt line 16;
  v2-after-interaction.png shows the Following section).
- [x] **Skeleton loading grid** — static innerHTML preserved verbatim.
- [x] **Station-list failure card** ("Couldn't load the station list / The SNOTEL service didn't
  answer.") — preserved for the no-cache failure; with a cache present the tool now serves stale
  instead (see policy change below).
- [x] **Silent `/data` failure → "No recent data" cards** — the try/catch around getData is
  preserved; it is now only reached when there is no cache at all.
- [x] **"Updated <time>" stamp** — preserved for fresh loads; a stale load renders
  "Offline — showing cached data from <date, time>" instead (policy: never pretend stale is
  fresh).
- [x] **Refresh on `visibilitychange`** — listener preserved verbatim.
- [x] **Theme toggle** — via core; harness probe: light → dark, aria-pressed=true.
- [x] **Footer data credit** — byte-identical markup.

## changes beyond the recipe

1. **`/data` request is now cached (policy-mandated, Batch B addendum / API-AND-RELAY.md §2).**
   v1 fetched it uncached on every render. v2 routes it through `Suite.fetchJSON` with
   `cacheKey: "snow.data"`, TTL 60 min. Single cache slot with a `key` field holding the sorted
   triplet set (the air.html precedent): when location or favorites change the set, the slot is
   dropped so stale data for the wrong stations can never render. Side benefit observed in the
   run: starring a station re-renders from the fresh cache with no extra network call (v1
   refetched on every star click).
2. **Stale-serve for both sources.** Station list: v1 showed the failure card when the fetch
   failed even if an expired cache existed; v2 falls back to the expired list (it still ranks
   stations) and flags it. Data: `Suite.fetchJSON`'s built-in stale fallback. Either being stale
   replaces the "Updated <time>" stamp with "Offline — showing cached data from <date, time>"
   (offline-stale.png). Fresh-path rendering is unchanged.
3. **Station list kept on v1's manual trimmed cache** (deliberate deviation from "cacheKey on
   every fetch", zip.html precedent): `Suite.fetchJSON` performs the request without a cacheKey
   and the tool stores the v1-trimmed array in the v1 envelope at the v1 key. Reason: letting
   fetchJSON cache would write the ~900-station RAW response (several hundred KB) to
   localStorage, change the envelope contents v1 users already have, and make the code handle
   two shapes. The 7-day TTL and emptiness guards are v1's own.
4. **cacheTtlMin: 60 (justification).** AWDB `duration=DAILY` values change at most a few times
   a day upstream (stations report hourly; the daily aggregate revises through the morning), so
   60 min keeps the board feeling current while staying a good citizen — well inside the
   suggested 60–1440 window. The station list is reference-class data and keeps its own v1
   7-day (10080 min) tool-local TTL, documented here since the manifest holds one number.
5. **Suite.location normalizes a missing label to ""** (core behavior) — v1 could render
   "📍 undefined · change" if a hand-written location lacked a label; v2 renders an empty label.
   Not a feature removal.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.location` | yes | yes (same shape) |
| `suite.pref.snow.fav` | yes | yes (same JSON array) |
| `suite.cache.snow.stations` | yes `{t, v: trimmed}` | yes, byte-compatible (same trim, same envelope) |
| `suite.cache.snow.data` | — | **new** `{t, key, v}` — the policy-mandated data cache |

Parity snapshot: `keysOnlyInV1: []`, `keysOnlyInV2: ["suite.cache.snow.data"]` — the one
addition is the mandated caching change above. A v1 user's stations cache and favorites are
read unchanged.

## escape allowlist requests

None. The only `innerHTML` writes are `""` clears and the static skeleton string
`'<div class="grid">' + '<div class="skelcard"></div>'.repeat(6) + '</div>'` (no interpolation).
All API data renders through `createElement`/`textContent`, as in v1.

## a11y applied

- ZIP input: `aria-label="US ZIP code"` (v1 had placeholder only).
- Enter in the ZIP input submits the lookup (v1 required clicking "Look up ZIP").
- Star buttons (icon-only ★): `aria-label` "Follow/Unfollow <station name>" + `aria-pressed`
  state (v1 had only `title`).
- `#main` (async results) and the first-run error line are `Suite.liveRegion()` polite regions.
- Theme button label/pressed state from core; keyboard path exists for every mouse path (all
  controls are real buttons); no overlays, so no Esc handling needed.

## endpoints

- `https://wcc.sc.egov.usda.gov` — AWDB `/stations` + `/data`. In CATALOG.md (§2.6 + registry
  table). The registry row's "Local: verify" cell can now be flipped: this run proves both
  routes work from `file://` (live fetch from a file:// page, no CORS error).
- `https://api.zippopotam.us` — first-run ZIP → coordinates. In CATALOG.md. Left uncached,
  matching weather.html/air.html (one-off user-triggered geocode).

Both hosts are in the manifest entry so CSP `connect-src` covers them; no image hosts.

## concerns for the reviewer

- **July snowpack is near zero everywhere**, so the "% of median SWE" progress bar (median > 0
  && swe !== null branch) could not be shown with real data — every live station returned
  median 0.0 and the card correctly took the "Median SWE for today" fallback branch, which v1
  code shows for the same data. The bar's code path is preserved verbatim from v1 (colors,
  0–200% width math); it was reviewed line-by-line but not visually exercised. Worth a
  re-glance in winter or with a mocked response if you want pixel proof.
- **Live-fetch volume:** the run made 2 `/data` calls on v2 (LA seed + Vail ZIP change) plus
  1 on v1 (its star-click refetch), 1 `/stations` per version, 1 zippopotam call — slightly
  above the one-per-source minimum because the tool-specific notes asked for both a seeded-LA
  and a mountain-location exercise; noted for etiquette transparency.
- The `--built` computed-style diffs (12 per theme) are the core stylesheet defining a suite
  variable v1 never had; the tool never references it, so it is inert. All other computed
  styles are identical (v1 snow.html already had `-webkit-font-smoothing: antialiased` and
  space-formatted `--shadow`, so even the usually-tolerated diffs are absent).
- The stale-stamp wording ("Offline — showing cached data from Jul 14, 3:24 PM") is new text —
  v1 had no stale state for readings at all. I matched the suite's offline phrasing convention
  and included the date, since a time alone is misleading for day-old data.
