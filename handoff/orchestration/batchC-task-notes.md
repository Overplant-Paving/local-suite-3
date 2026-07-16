# Batch C per-tool task notes (verbatim from the interrupted session's prompts)

Each completer/migration subagent gets: the three addenda (subagent-common.md → batchB-common.md
→ batchC-common.md, replacing {TOOL}) plus its block below. For tools with a draft in
handoff/batchC-drafts/, prepend the completer framing from HANDOFF.md §Batch C.

## apod
name "Astronomy Picture of the Day", cat "space", cx "S", desc "NASA's APOD with its explanation — a serene new-tab page." network "keyed", key {"name":"nasa","signup":"https://api.nasa.gov","demo":true}, flags ["rl"]. Endpoints: api.nasa.gov + apod.nasa.gov (image host; also possibly YouTube embeds for video days — check v1, list every host). cacheTtlMin 1440.
DEMO_KEY budget: max 2 live requests. Verify the demo-key nudge state, image + explanation render, 429 backoff via route-fulfill, stale path. If today's APOD is a video, handle honestly and note it.

## nutrition
name "Nutrition Lookup", cat "health", cx "M", desc "Search a food, get calories and nutrients; compare two foods." network "keyed", key {"name":"usda","signup":"https://fdc.nal.usda.gov/api-key-signup.html","demo":true}, flags ["rl"]. Endpoints: api.nal.usda.gov. cacheTtlMin: 10080 (reference data).
DEMO_KEY budget: max 2 live requests (one search, maybe one compare). Verify demo nudge, search render, the compare feature (route-fulfil the second food if needed), 429 backoff via route-fulfill, stale path.

## congress
name "Congress Tracker", cat "civic", cx "M", desc "Recent bills, what passed this week, your delegation's activity." network "keyed", key {"name":"congress","signup":"https://api.congress.gov/sign-up/","demo":false}, flags []. Endpoints: api.congress.gov. cacheTtlMin 360.
NO demo tier — verify the NO-KEY DESIGNED STATE (explanation + signup link + paste field, styled), paste/save/forget mechanics (write suite.key.congress; prove a fetch is attempted with it via route-interception, fulfilled with a realistic payload to prove the render pipeline). Remote bill titles MUST be esc'd. Stale path with the fulfilled cache.

## gas
name "Gas Price Tracker", cat "money", cx "S", desc "National and regional gas/diesel averages with trend lines." network "keyed", key {"name":"eia","signup":"https://www.eia.gov/opendata/register.php","demo":false}, flags []. Endpoints: api.eia.gov. cacheTtlMin 1440 (weekly data).
NO demo tier — no-key designed state + paste-key mechanics + route-fulfilled render pipeline (realistic EIA v2 payload shape). Trend chart render + theme redraw if v1 has it. Stale path via fulfilled cache.

## parks
name "National Parks Companion", cat "civic", cx "S", desc "Alerts, closures, and events for the parks you're visiting." network "keyed", key {"name":"nps","signup":"https://www.nps.gov/subjects/developer/get-started.htm","demo":false}, flags []. Endpoints: developer.nps.gov (verify; NPS uses X-Api-Key header OR api_key param — Suite.fetchJSON supports headers). cacheTtlMin 360.
NO demo tier — no-key designed state + paste-key mechanics + route-fulfilled render pipeline (realistic NPS alerts payload). Park-code selection persistence per v1. Stale path via fulfilled cache.

## markets
name "Market Snapshot", cat "money", cx "M", desc "Index levels once a day. Honest caveat: free keyless stock data doesn't exist." network "keyed", key {"name":"finnhub","signup":"https://finnhub.io/register","demo":false}, flags ["rl"]. Endpoints: api.coingecko.com (keyless crypto) + finnhub.io (keyed stocks — verify hosts). cacheTtlMin 1440.
TWO paths: (1) CoinGecko crypto keyless CORS-open — live-verify (1 request; log BTC price); (2) Finnhub stocks keyed — no-key designed state + paste mechanics + route-fulfilled quote render. 429 backoff via route-fulfill on the CoinGecko path. Stale path per addendum.

## launches  (NO DRAFT — fresh migration)
name "Rocket Launch Schedule", cat "space", cx "S", desc "Upcoming launches worldwide with countdowns and mission blurbs." network "cors-open", key null, flags ["rl"]. Endpoints: ll.thespacedevs.com. cacheTtlMin >=30 (15 req/hr registry limit; justify).
ONE live request maximum. Verify: live upcoming launches (log next mission + countdown), countdown ticks under page.clock, 429 backoff + rate-limiting note via route-fulfill, stale path. Remote mission names/blurbs MUST be esc'd.

## nearby
name "Nearby Finder", cat "local", cx "L", desc "Nearest pharmacy, EV charger, playground, library — from OpenStreetMap." network "cors-open", key null, flags ["rl"]. Endpoints: overpass-api.de + the kumi.systems mirror (row 64 mandates TTL + mirror fallback — if v1 lacks the fallback, ADD it per the row note and document) + any OSM tile hosts if a map renders (img-src!). cacheTtlMin 60+.
Complexity L. ONE live Overpass query (seed LA, one category, log count + nearest name/distance). Verify the mirror fallback deterministically (route-abort primary → mirror tried), the 429/504 backoff note, stale path. Remote place names MUST be esc'd.

## airport  (formerly-broken tool; remediation IS the migration)
name "Airport & Flight-Weather Board", cat "space", cx "M", desc "METARs/TAFs decoded to plain English, plus FAA delay status." network "blocked", key null, flags []. cacheTtlMin null. Endpoints: [] (relay URLs are user-configured; note the CSP connect-src tension for relay users in the report — do NOT weaken the CSP).
v1 ships your-worker.example placeholders that fail silently — REMOVE them (fatal gate). Product: designed link-out card — saved airport code (v1 persistence keys), direct links to aviationweather.gov's METAR/TAF page for that airport + the FAA NAS status page, honest one-line explanation. KEEP v1's METAR plain-English decoder as a paste-a-METAR box (offline value). Preserve relay plumbing behind Suite.relay with route-fulfilled verification. Screenshot the card in both themes.

## jobs  (formerly-broken; embedded-BLS remediation — batchC addendum EMBEDDED BLS section)
name "Jobs & Unemployment Snapshot", cat "money", cx "S", desc "Unemployment rate and the latest jobs-report numbers." network "blocked", key null, flags ["embedded-data"]. Endpoints []. cacheTtlMin null.
v1 fetches LNS14000000 through my-relay.example — REMOVE. Embed real current data via terminal curl (BLS API v1 keyless, the series v1 rendered; 1-2 requests). @suite:bls marker EXACTLY as specified. Reference-month labeling first-class. Relay plumbing behind Suite.relay (route-fulfilled). All v1 features drive from the embedded object, offline, file://.

## inflation  (formerly-broken; embedded-BLS remediation)
name "Cost-of-Living Tracker (CPI)", cat "money", cx "M", desc "Headline and core inflation, plus the categories that hit home." network "blocked", key null, flags ["embedded-data"]. Endpoints []. cacheTtlMin null.
v1 fetches CUUR0000SA0 + core + category series through my-relay.example — REMOVE. Embed real numbers via ONE batched terminal curl (BLS v1 accepts multiple series). @suite:bls marker mandatory; reference-month labeling first-class. Every v1 chart/category feature drives from the embedded object, verified offline from file://. Relay plumbing behind Suite.relay.
(The interrupted agent's last note: it planned one batched POST for five series — headline, core, food, energy, shelter, 2021-2026.)

## transit  (formerly-broken; two remediations)
name "Transit Departure Board", cat "local", cx "L", desc "Next departures for your stop, big-type. Scope per city — GTFS varies wildly." network: read source, choose keyed vs blocked, justify. key {"name":"bart","signup":"https://api.bart.gov/api/register.aspx","demo":true}. Endpoints: api.bart.gov (verify). cacheTtlMin 1 or null per v1's refresh behavior.
(1) v1 transit.html:163 hardcodes the BART key — externalize to Suite.key("bart") (core ships the public value; isDemo renders the nudge). LIVE-verify BART (real departures, log station + times). (2) Custom-feed path uses your-agency.example — REMOVE (fatal gate); replace with a designed link-out card + preserve custom-feed fetch behind Suite.relay/direct URL (v1 config mechanics stay; verify with route-fulfilled payload). Stale path on the BART path.

## asteroids re-source (NOT a fresh migration — tools/asteroids.html is committed and migrated)
Read first: tests/evidence/asteroids/report.md (CORS-regression finding), neows-live-d7.json + neows-live-headers.txt (live probe already archived), CATALOG's asteroids note, core/suite.js.
Ruling: replace cad.api fetches with NeoWs (api.nasa.gov/neo/rest/v1/feed) via Suite.fetchJSON + Suite.key("nasa") (DEMO_KEY nudge). Map fields to the existing render model (miss_distance.lunar is direct LD); recompute one LD value independently. NeoWs caps at 7 days/request — if v1 had a 30-day view, page or reduce honestly, document. DEMO_KEY budget: ONE live 7-day verification, route-fulfil the rest. Keep cache keys if shapes allow (else compat reader). Update tests/interactions/asteroids.mjs, re-run harness (exit 0), APPEND "## NeoWs re-source (orchestrator-ruled)" to report.md, update manifest-entry.json (endpoints [https://api.nasa.gov], network "keyed", key nasa demo:true, flags ["rl"]). Then the orchestrator re-integrates (driver.sh asteroids ... — integrate.py replaces the existing entry) and updates the MIGRATION row-39 note + CATALOG.
