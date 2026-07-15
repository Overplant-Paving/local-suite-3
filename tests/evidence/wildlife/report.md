# wildlife.html migration report

Batch B (CORS-open fetcher). Harness: `node verify-tool.mjs wildlife` — exit 0. All line
numbers cite `interaction.txt` in this directory.

## v1 feature walk-through

- [x] **First-run location card (ZIP or geolocation)** — rendered when `suite.location` is
  absent (line 1: "first-run setup card visible: true"; also the four v1/v2 theme screenshots,
  which show it identically).
- [x] **ZIP lookup via api.zippopotam.us** — same parse (`places[0]` / `place name` /
  `state abbreviation`) now through `Suite.fetchJSON`; the identical code shape was live-proven
  on weather and quakes, so no extra live request was spent here (the location was seeded per
  the Batch B addendum). ZIP validation ("Enter a 5-digit ZIP.") and the not-found message
  ("ZIP not found.") kept verbatim.
- [x] **Geolocation button** — logic verbatim (Locating… label, error message
  "Couldn't get location (may need http://)."); not exercised (headless has no geolocation
  grant), same as every other migration.
- [x] **Location chip ("📍 <label> · change") reopens the first-run card** — chip rendered
  from the seeded location (line 2: "📍 Los Angeles, CA · change"); click handler converted
  to `addEventListener`, target function unchanged.
- [x] **Live iNaturalist fetch (25-mile radius, 36 per page, photos, verifiable,
  most-recent-first)** — `URLSearchParams` block byte-identical. Live run: 36 observations
  rendered (lines 3, 5), first card "🐦 Red-whiskered Bulbul" / *Pycnonotus jocosus* /
  "research grade" / "2 h ago 9 mi view →" (line 6); response landed in the v1 cache key
  `suite.cache.wildlife.34.05,-118.24.rg` (line 7).
- [x] **Photos load** — 12/36 `<img>` loaded at the time of sampling (`loading="lazy"` — only
  near-viewport images fetch; v1 identical), from hosts
  `inaturalist-open-data.s3.amazonaws.com` and `static.inaturalist.org` (line 8);
  `live-photos.png` shows the rendered grid with real photos. `square`→`medium` URL upgrade,
  `alt` text, and the emoji `noimg` fallback on image error all kept (fallback exercised in
  the offline segment, line 17).
- [x] **Research-grade toggle** — unchecking refetches without `quality_grade=research` under
  the `.all` cache key: count re-rendered, "needs ID" badges appear, key written
  (lines 9–10). Toggle is not persisted across loads (v1 behavior, kept).
- [x] **Quality-grade badge (research = green)** — badge text/classes verbatim (line 6 shows
  "research grade"; line 9 proves the "needs ID" variant).
- [x] **Distance + time-ago + "view →" metadata** — haversine, `timeAgo`, and the
  `target="_blank" rel="noopener"` observation link all verbatim (line 6 shows all three).
- [x] **Count line ("N recent sightings", singular handled)** — verbatim (lines 3, 9).
- [x] **"Updated <time>" stamp** — line 4. Stale variant below.
- [x] **Empty state ("No recent sightings here…")** — code verbatim; not reachable live from
  LA (36 results both grades).
- [x] **Skeleton loading cards** — markup/CSS verbatim (shown only when no cache exists;
  superseded by the render before screenshots).
- [x] **Error card ("Couldn't reach iNaturalist")** — code path verbatim, reachable only when
  the fetch fails with no cache (with cache the stale render takes over — see below).
- [x] **eBird designed no-key state** — section visible once a location exists (line 11);
  keycard text and `ebird.org/api/keygen` signup link verbatim (lines 12–13).
- [x] **eBird paste-a-key mechanics (v1 mechanics kept per instructions)** — token saved to
  `suite.key.ebird` and the panel re-renders into the fetch path (line 14, exercised with
  `api.ebird.org` route-aborted so no real request left the machine — eBird was NOT
  live-verified, per the tool instructions); failure renders the v1 "eBird request failed /
  The token may be invalid." card (line 14); "Forget token" removes the key and restores the
  keycard (line 15).
- [x] **eBird list rendering** (comName/sciName, distance, time-ago, locName) — code verbatim;
  not observable without a real key (see concerns).
- [x] **Stale-cache offline path** — cache aged 24 h + all routes aborted: the cached grid
  still renders (36 cards) with the stamp "Offline — cached from 3:30 PM Jul 14"
  (lines 16–17, `offline-stale.png`).
- [x] **Refresh on `visibilitychange`** — handler verbatim.
- [x] **Theme toggle** — light → dark, `aria-pressed=true` (line 18), now via
  `Suite.theme.init()`.

## changes beyond the recipe

- **Policy-mandated TTL caching (manifest `cacheTtlMin: 30`).** v1 cached iNaturalist results
  but refetched on *every* load; v2 routes through `Suite.fetchJSON(url, {cacheKey, ttl: 30min})`
  so a reload within 30 minutes serves the envelope without a request. TTL rationale: the tool
  is a "recent sightings" browse feed, not a monitor — observations accrue over hours/days
  (first live card was 2 h old), there is no v1 auto-refresh interval to honor, and
  iNaturalist's API guidelines ask clients to cache; 30 min sits between the weather-ish 10 and
  daily 1440 classes and matches how often re-opening the tool could plausibly show new content.
- **Cache envelope value shape.** v1 stored the bare `results` array in the `{t,v}` envelope;
  `Suite.fetchJSON` stores the full response object. A `listOf()` shim reads **both** shapes, so
  a v1 user's existing cache paints correctly on first open (key names unchanged —
  parity rule satisfied; only the value written going forward differs, inside the same
  envelope).
- **Stale rendering (new, addendum-required).** v1's failure path silently kept whatever was
  already painted. v2 renders the aged cache with an explicit "Offline — cached from <time>"
  stamp (the stamp gains a date when the cache is from another day, mirroring weather.html's
  `fmtStamp`; same-day output is identical to v1's time-only stamp).
- **eBird fetch kept tool-local (documented deviation).** `Suite.fetchJSON` cannot send the
  required `x-ebirdapitoken` header, so the eBird request keeps a small local `fetch` — now
  wrapped in the same `{t,v}` envelope + TTL + stale-fallback semantics
  (`suite.cache.wildlife.ebird.<lat>,<lon>`, a new key under the tool's cache wildcard;
  policy-mandated caching, v1 refetched every load). A stale eBird render appends the same
  "Offline — cached from <time>" stamp.
- **`suite.key.ebird` via `Suite.store`** — read/write through the store (values stay bare
  strings, byte-compatible with v1); removal uses raw `localStorage.removeItem` with a comment,
  since `Suite.store` has no remove.
- Inline `.onclick`/`.onerror` property handlers converted to `addEventListener`
  (chip, ZIP/geo/save/forget buttons, image error fallback); theme boilerplate, palette CSS,
  reset, and the per-file `fetchJSON`/cache helpers removed in favor of core. v1's muted
  `.back` link and non-floated `.theme-btn` kept as tool-local overrides of core chrome.
- No feature removed; all rendering functions are line-for-line v1 apart from the points above.

## localStorage keys

From `localstorage.json` (keysOnlyInV1 = [], keysOnlyInV2 = []):

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.location` | yes | yes (identical `{lat,lon,label}` JSON) |
| `suite.cache.wildlife.<lat>,<lon>.rg` | yes (`{t,v:[…results]}`) | yes (same key, `{t,v:{…full response}}` — both shapes read, see above) |
| `suite.cache.wildlife.<lat>,<lon>.all` | yes | yes (same note) |
| `suite.key.ebird` | on paste (bare string) | on paste (bare string; written+removed during the run, absent from both final snapshots — lines 14–15) |
| `suite.cache.wildlife.ebird.<lat>,<lon>` | — | new in v2 (policy-mandated eBird caching); under the manifest wildcard `suite.cache.wildlife.*`; only written when a key is present, so it never appeared in the run |

## escape allowlist requests

None. Every remote value (taxon names, photo URLs, observation URIs, eBird fields) reaches the
DOM via `createElement`/`textContent`/property assignment — v1's discipline, preserved. The only
`innerHTML` writes are constant strings (skeleton grid, eBird keycard prose with its hardcoded
signup link, "Loading recent birds…", "No recent bird reports nearby.") and `= ""` clears; no
template-literal interpolation into `innerHTML` exists in the file.

## a11y applied

- ZIP input: `aria-label="US ZIP code"` (was placeholder-only); Enter in the field submits the
  lookup (new — v1 had button-only).
- eBird token input: `aria-label="eBird API token"` (was placeholder-only); Enter saves (new).
- `Suite.liveRegion()` on `#count` (announces "N recent sightings" when results arrive) and on
  both dynamically-created error containers (first-run ZIP errors, eBird token errors).
- Theme button `aria-label` + `aria-pressed` via core (verified, line 18).
- All interactive elements are real `<button>`/`<a>`/`<input>` — keyboard path exists for every
  mouse path; the research-grade checkbox is labeled by its wrapping `<label>` text (v1, kept).
- Observation photos keep their `alt` text (taxon name); no overlays exist, so no Esc handling
  is needed.

## endpoints

Hosts the tool can contact, cross-checked against `manifest-entry.json` and CATALOG.md:

- `https://api.inaturalist.org` — observations query (live-verified, lines 3–8). In CATALOG
  (wildlife section ~line 137; CORS table line 551, keyless, CORS OK).
- `https://inaturalist-open-data.s3.amazonaws.com` and `https://static.inaturalist.org` —
  photo `<img>` hosts, both observed live (line 8; `live-photos.png`). **Both are required in
  the manifest for dist `img-src` or photos break in dist.** **Not in CATALOG.md** — flagged
  for the orchestrator (the wildlife entry mentions neither image host).
- `https://api.ebird.org` — optional keyed path; designed no-key state verified instead of a
  live call (lines 11–15). **Host not in CATALOG.md** (the wildlife section says "eBird needs a
  free key" but the host string `api.ebird.org` appears nowhere; it is also absent from the
  CORS table) — flagged for the orchestrator.
- `https://api.zippopotam.us` — first-run ZIP lookup. In CATALOG (line 325; CORS table
  line 542).

`cacheTtlMin: 30` matches the tool's `TTL = 30*60*1000` (justification under "changes beyond
the recipe"). `storage` matches the keys table (`suite.cache.wildlife.*` covers the per-location
iNat keys and the new eBird key).

## concerns for the reviewer

- **eBird's fetch path is verified by inspection + aborted-route mechanics only.** No key was
  available and the instructions forbade live-verifying eBird, so the success rendering
  (bird rows) and the eBird stale path have never executed. The failure card, token
  save/forget, and no-key state are exercised (lines 11–15). Suggest a one-time live check in
  the Phase 4 audit if a real key ever exists. Note also that with the new eBird cache, an
  invalid-token failure *after* a prior success would show stale cached birds rather than the
  "token may be invalid" card until the cache is gone — the suite-wide stale-on-failure policy
  trade-off, flagged for awareness.
- **eBird CORS is unproven.** CATALOG has no verification for `api.ebird.org` (it is missing
  entirely, see endpoints). v1 shipped the same browser fetch, so v2 is no worse, but if eBird
  turns out to be CORS-blocked the keyed path fails identically in both versions.
- **Cache value shape changed** (bare array → full response object) under the unchanged v1 keys;
  `listOf()` accepts both, and the localstorage.json v1/v2 rows show the two shapes
  side-by-side. Flagging because "keys byte-identical" is true but "values byte-identical" is
  deliberately not.
- **v1 quirk preserved: image-error fallback wipes the quality badge.** The v1 error handler
  does `thumb.innerHTML = ""` before appending the emoji, which also removes the badge span —
  visible in `offline-stale.png` (fallback-icon cards have no badge; v1 code is identical).
  Kept verbatim; a one-line fix exists if the reviewer wants it.
- In `offline-stale.png`, ~18 top-of-page thumbs are blank rather than emoji fallbacks: those
  `loading="lazy"` images never *attempted* to load (no attempt → no error event → no
  fallback), while attempted ones fell back (line 17 counts 18 `noimg` icons). Same behavior
  in v1; only observable with the network cut.
- `o.uri` (iNaturalist) is assigned to `a.href` without scheme validation — v1 identical; in
  practice it is always an `inaturalist.org` observation URL. Same class of note as the quakes
  report's `q.url`.
- The `net::ERR_FAILED` console errors in `interaction.txt` are the deliberately route-aborted
  requests of the eBird-mechanics and offline segments; the harness filters these and exited 0.
- Computed-style diff is solely the unused core variable `--built` (defined suite-wide by
  `core/suite.css`, referenced nowhere in this tool — zero rendered effect). Even
  `-webkit-font-smoothing` matches, since v1 wildlife set `antialiased` itself.
- Etiquette accounting for the final run: 2 live iNaturalist requests from v2 (rg + all) and
  2 from v1 (localStorage parity), 0 to eBird, 0 to zippopotam.us, plus lazy-loaded photo
  images. No retries, no loops. (The harness was run twice — a first full run, then a re-run
  after adding the `live-photos.png` capture — so double that for the session total.)