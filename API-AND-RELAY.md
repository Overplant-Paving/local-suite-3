# API-AND-RELAY.md — data source strategy

Everything network. `CATALOG.md` remains the human-readable per-tool endpoint narrative with CORS
verification dates; this doc is **policy**. The manifest
(`manifest/tools.json`) is machine truth for endpoints per tool.

## 1. Source policy — keyless-first ranking

When choosing or replacing a data source, prefer in this order:

1. **Keyless + CORS-open** (works from `file://`) — the healthy majority: NWS, USGS, NOAA
   (CO-OPS/SWPC/NCEI), Treasury FiscalData, openFDA, CDC Socrata, Federal Register, Open-Meteo,
   Frankfurter, Wikipedia/Wiktionary, Open Library, restcountries, Zippopotam, OSM/Overpass,
   wheretheiss.at, JPL SSD, CelesTrak, NIFC ArcGIS, USDA AWDB, iNaturalist.
2. **Keyless but CORS-blocked** → bundled at build time via the embedded-data pipeline (§4):
   aviationweather.gov, BLS. (NDBC stays descoped — Open-Meteo covers marine.)
3. **Free key** (instant signup, stored in `suite.key.*`): Congress.gov, EIA, NPS, Finnhub, eBird,
   NASA (above demo tier).
4. **Demo tier** (works keyless with low limits): NASA `DEMO_KEY` (30/hr, 50/day), USDA FDC.

Never: paid APIs, APIs requiring OAuth, sources that demand tracking.

## 2. Good-citizen rules (carried from v1 CATALOG, now enforceable)

- **Cache everything** in `localStorage` with the `{t, v}` envelope via `Suite.fetchJSON`'s
  `cacheKey`/`ttl` options. Default TTLs by source class, declared per tool in the manifest
  (`cacheTtlMin`): weather 10 min · quakes 5 min · daily stats (CPI, treasury, APOD) 24 h ·
  reference data (factbook, zip) 7 d.
- **Identify yourself** where asked: `application=local-suite` (NOAA CO-OPS), `email=` params.
  Never set a custom `User-Agent` header from JS (CORS preflight forbids it).
- **Serve stale on failure**: `Suite.fetchJSON` falls back to cache with a visible
  "Offline — cached from <time>" card. Stale data must say *when* it's from, never pretend.
- **Back off on 429/403**: rate-limited tools double their TTL on throttle responses and surface
  a "source is rate-limiting, showing cached data" note.

### Rate-limit registry

| Source | Limit | Used by | Handling |
|---|---|---|---|
| Launch Library 2 (thespacedevs) | 15 req/hr | launches | long TTL (≥30 min) + backoff |
| CoinGecko free | ~30/min soft | markets | daily-snapshot TTL |
| NASA `DEMO_KEY` | 30/hr, 50/day | apod, (nutrition via USDA demo) | 24 h TTL + "add your free key" nudge |
| Overpass public | fair-use | nearby | long TTL + kumi.systems mirror fallback |
| Nominatim | 1 req/s | geo | client-side throttle |
| ipapi.co | 1k/day | network | cache IP info per session |

## 3. Key management

- One convention: `localStorage["suite.key.<name>"]` — names: `nasa`, `congress`, `eia`, `nps`,
  `finnhub`, `ebird`, `usda`, `bart`.
- `Suite.key(name)` returns `{value, isDemo}`; tools render a one-line "using the shared demo key —
  [get your free key]" note when on a demo tier, with the signup URL from the manifest.
- **settings.html is the single entry UI** for keys (Phase 4). Until then, tools keep their v1
  paste-a-key prompts.
- **Keys are never committed.** The `--check` gate greps source for key-shaped strings; the only
  allowed embedded key is BART's officially published public demo key, and v2 externalizes even
  that (v1 `transit.html:163` → `suite.key.bart` with the public value as the documented default).

## 4. CORS-blocked sources — the embedded-data pipeline (no relay, no extra infrastructure)

Some excellent sources send no CORS headers, so a browser page cannot fetch them:
**aviationweather.gov** (METARs/TAFs), **api.bls.gov** (CPI, unemployment), **NDBC** buoy text
feeds, and many agency GTFS feeds. v1 shipped the affected tools with
`https://your-worker.example.workers.dev/` placeholders — they failed silently out of the box.

v2 policy — keep it simple:

- **Monthly data gets embedded at build time.** `build.py --refresh-data` fetches BLS from the
  terminal (CORS only restricts browsers) and injects the latest CPI and jobs numbers into those
  two tools, labeled with their reference month. Same philosophy as password.html's embedded EFF
  wordlist. Rebuild monthly — or let a one-line scheduled GitHub Action do it.
- **Minute-by-minute data gets a link-out.** airport.html shows a clean card explaining that
  aviationweather.gov blocks browser scripts, with a direct link to its METAR/TAF page for your
  airport — the *website* works fine, only the API is blocked. A custom transit feed likewise
  links to the agency's own departure board.
- That's it. No proxy, no snapshots, no data infrastructure.

## 5. Remediation list — the 4 broken v1 tools

| Tool | v1 state | v2 change (Batch C) |
|---|---|---|
| airport.html | fetches aviationweather.gov through a `.example` placeholder → silent failure | link-out card to aviationweather.gov's own METAR/TAF page — honest, useful, zero setup |
| jobs.html | BLS through `https://my-relay.example/?url=` placeholder | embedded monthly numbers via `--refresh-data` — works with zero network |
| inflation.html | same BLS placeholder | same mechanism (CPI headline + core); shares plumbing with jobs.html |
| transit.html | hardcoded BART demo key + `https://your-agency.example/departures.json` custom feed | BART key → `suite.key.bart` (BART's API is CORS-open — works out of the box); custom feed → link-out to the agency's departure board |

## 6. Optional personal relay (power users only — nothing depends on it)

`relay/worker.js` stays in the repo as a ~40-line Cloudflare Worker template (strict host
allowlist) for anyone who wants live in-page METARs or a custom transit feed. `Suite.relay(url)`
reads `localStorage["suite.relay.url"]`; unset — the default for everyone — the tools use their
link-out/embedded paths. No tool requires it.

## 7. Manifest ↔ CATALOG contract

- **Manifest** (machine truth): endpoint hosts, network class, key requirements, TTLs. Generates
  hub, CSP `connect-src`, SW rules.
- **CATALOG.md** (prose truth): full endpoint URLs with parameters, CORS verification dates, API
  gotchas (NCEI `units=standard`, AWDB station-filter bug, USGS legacy water API sunset ~Q1 2027…),
  alternatives considered.
- `build.py --check` warns when a manifest endpoint host doesn't appear anywhere in CATALOG.md —
  the nudge to keep the prose current. Touch the CATALOG verification date whenever an endpoint
  changes (release checklist, QUALITY.md §5).
