BATCH C ADDENDUM — keyed, CORS-blocked, and rate-limited tools. Read C:\Users\henry\AppData\Local\Temp\claude\subagent-common.md FIRST (recipe, deliverables, hard rules), then C:\Users\henry\AppData\Local\Temp\claude\batchB-common.md (network rules: endpoints/CSP, TTLs, live-fetch + stale-path verification). This file adds the Batch C specifics. Also read API-AND-RELAY.md in full.

KEYS (Suite.key — implemented in core, read core/suite.js):
- const k = Suite.key("<name>") -> {value, isDemo}. Names: nasa, congress, eia, nps, finnhub, ebird, usda, bart. NASA/USDA fall back to DEMO_KEY (isDemo:true); BART falls back to its officially published public key.
- When isDemo, render a one-line nudge: "using the shared demo key — get your free key" linking the manifest key.signup URL. This is a designed state, not an error.
- Tools KEEP their v1 paste-a-key prompt mechanics (write to suite.key.<name> via Suite.store); settings.html centralizes key entry in Phase 4.
- NO-KEY UX (no key and no demo tier): must be a DESIGNED state — explanation + signup link + paste field; never a console error or a blank. Verify it explicitly with screenshots.
- Live verification budget: demo tiers get AT MOST 2 real requests (NASA DEMO_KEY is a shared 30/hr pool); keyed APIs with no demo tier get their no-key designed state verified instead. Never invent a key.

RATE-LIMITED tools (flags: ["rl"]): on HTTP 429 (or 403-as-throttle), double the effective TTL and surface "source is rate-limiting — showing cached data". Verify DETERMINISTICALLY: after one good live load, page.route the API to fulfill status 429, reload, assert the note + cached render + backoff. Do not hammer the real API.

CORS-BLOCKED tools (airport; transit custom feed): the fix is a LINK-OUT CARD (API-AND-RELAY.md §4-5) — a clean, styled, first-class card explaining that the source blocks browser scripts, linking directly to the source's own page for the user's saved airport/stop. Remove every *.example placeholder (a fatal build gate now greps dist for them). If v1 had relay plumbing, preserve it behind Suite.relay(url): when suite.relay.url is set the tool MAY fetch live through it. Verify the relay path by setting suite.relay.url to a fake base and page.route-fulfilling the rewritten URL (contract: <base>?url=<encoded> — see relay/worker.js).

EMBEDDED BLS DATA (jobs, inflation): api.bls.gov blocks browsers, so the data ships EMBEDDED, refreshed at build time (ADR D5).
- In the tool source, exactly: const BLS = /* @suite:bls */{"asOf":"YYYY-MM","series":{...}}/* /@suite:bls */;
- Fetch the REAL current numbers yourself from the terminal with curl (CORS only restricts browsers; BLS API v1, keyless, be gentle — 1-2 requests total) and embed them so the tool ships current. Document the exact curl in report.md.
- The UI labels the data with its reference month prominently ("Data: June 2026 · refreshed monthly at build time") — a first-class designed state, not an apology.
- Keep every v1 rendering feature driven from the embedded object. The orchestrator implements build.py --refresh-data against your marker — keep the marker EXACTLY as specified.
- If v1 had relay plumbing for live BLS, preserve it behind Suite.relay as above.

MANIFEST: network "keyed" for key-using tools, "blocked" for airport/jobs/inflation (transit: read the source, choose, justify); key: {"name","signup","demo":bool} or null; flags ["rl"] where rate-limited. endpoints = hosts the tool can ACTUALLY contact from a browser (link-out <a href> targets are navigation, NOT endpoints; embedded-data tools may be []).

BART (transit): v1 transit.html:163 hardcodes the public BART key — externalize to Suite.key("bart") (core ships the public value as the documented default; isDemo true renders the nudge). BART's API is CORS-open and works out of the box: live-verify it.
