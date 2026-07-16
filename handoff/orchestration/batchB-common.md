BATCH B ADDENDUM — CORS-open fetchers. Read C:\Users\henry\AppData\Local\Temp\claude\subagent-common.md FIRST and follow it fully; then apply these network-specific rules on top. Also read API-AND-RELAY.md §1–2 and tools/weather.html (the canonical fetcher migration).

MANIFEST for this batch:
- "network": "cors-open" (unless your tool-specific notes say otherwise)
- "endpoints": EVERY external host the tool can contact — API hosts AND image hosts (radar loops, satellite imagery, book covers, artwork). The build derives BOTH CSP connect-src and img-src from this list; a missing host breaks the tool in dist.
- "cacheTtlMin": pick per API-AND-RELAY.md §2 source class (weather-ish 10, quakes 5, daily stats 1440, reference data 10080) and justify the choice in report.md.

FETCH CONVERSION:
- Every fetch goes through Suite.fetchJSON(url, {cacheKey, ttl, accept, tries}) — ttl in ms (cacheTtlMin * 60000). Keep v1 cache keys (suite.cache.<tool>.<key>). If v1 did NOT cache a request, ADD caching with the declared TTL — the good-citizen rule is now enforceable policy (API-AND-RELAY.md §2); note it in report.md as a policy-mandated change, and keep the tool's rendering behavior identical otherwise.
- fetchJSON returns {v, t, stale, fromCache}. On stale, render the v1-style "Offline — cached from <time>" state (match the tool's existing offline/error UX language; weather.html shows the pattern). Never pretend stale data is fresh.
- Plain image loads (<img src>) stay plain image loads — only JSON/XML fetches convert.

VERIFICATION additions (both are Definition-of-Done requirements for network tools):
1. LIVE FETCH: in interact(), drive the tool to perform one real fetch per data source; log concrete rendered values AND capture response evidence (the harness page console/log). Seed the shared location when needed with:
     await page.evaluate(() => { localStorage.setItem("suite.location", JSON.stringify({lat:34.0522, lon:-118.2437, label:"Los Angeles, CA"})); });
     await page.reload(); await page.waitForTimeout(...wait for render...);
   Do the same in v1Interact so localStorage cache-key parity compares equal key sets.
2. STALE-CACHE OFFLINE PATH: still inside interact(), after the live load:
     await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("suite.cache.")) { const e = JSON.parse(localStorage.getItem(k)); e.t = Date.now() - 24*60*60*1000; localStorage.setItem(k, JSON.stringify(e)); } });
     await page.context().route(/^https?:/, r => r.abort());
     await page.reload(); // must render the stale/offline state, not a blank page
     ...log what renders (the stale card text)...
     await page.context().unroute(/^https?:/);
   Take a screenshot of the stale state into evidenceDir (name it offline-stale.png).

ETIQUETTE: one exercise per source — no fetch loops, no retries hammering. If a source is rate-limited or down during your run, record the failure honestly, verify the error/stale UX instead, and flag it in concerns; do not fake success.

CATALOG: check every endpoint host appears in CATALOG.md (repo root). If one is missing, note it under "## endpoints" — the orchestrator updates CATALOG.

The escaping rules matter doubly here: API responses are REMOTE data — every interpolation of them into innerHTML must be Suite.esc()'d (or DOM/textContent). "It's a government API" is not provably safe.
