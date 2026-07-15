# MIGRATION.md — porting the 71 v1 tools

The per-tool execution protocol, the batch plan, and the burn-down table. Architecture details in
[ARCHITECTURE.md](ARCHITECTURE.md); network specifics in [API-AND-RELAY.md](API-AND-RELAY.md);
the Definition of Done is [QUALITY.md](QUALITY.md) §4.

**Execution model:** migrations are performed by Claude. Within a batch, tools are independent —
fan them out to parallel subagents, one tool per subagent, one reviewed commit per tool. The
orchestrating session reviews each diff against the `v1-import` tag before committing; a subagent's
"done" claim is not evidence — the recipe's verification steps produce the evidence.

## 1. The per-tool recipe

1. **Copy** `../Local Suite/<tool>.html` → `tools/<tool>.html`.
2. **Strip the duplicated boilerplate** (byte-identical in ~55 files, near-identical in the rest):
   - the theme CSS block (`:root` vars + `prefers-color-scheme` + `data-theme` overrides —
     v1 lines ~8–40 of each file),
   - the reset + body font declaration,
   - the ~9-line theme-toggle script,
   - the per-file fetch helper (`getJSON` / `fetchWithTimeout` variants).
3. **Insert the core references** (kept runnable from `file://` during dev):
   ```html
   <link rel="stylesheet" href="../core/suite.css" data-suite-inline>
   ...
   <script src="../core/suite.js" data-suite-inline></script>
   ```
4. **Convert fetches** to `Suite.fetchJSON(url, {cacheKey, ttl})`, keeping the tool's existing
   cache keys (`suite.cache.<tool>.<key>`) so v1 caches keep working.
5. **Remove inline event handlers** (`onerror=`, `onclick=` …) → `addEventListener`. The build
   rejects them (ARCHITECTURE.md §4.4-4).
6. **Wire shared chrome**: `.back` link + `.theme-btn` per the core pattern (markup stays in the
   tool; behavior comes from `Suite.theme`).
7. **Add the manifest entry** (`manifest/tools.json`) — copy metadata from the v1 hub's `TOOLS`
   array entry; set `network`, `key`, `endpoints`, `cacheTtlMin`, `flags`.
8. **Apply the per-tool a11y checklist** (QUALITY.md §2) — icon-button labels, `Suite.liveRegion`
   on async regions, keyboard paths, input labels. Done at migration time; Phase 4 re-verifies, it
   does not backfill.
9. **`python build.py --check`** — must pass.
10. **Verify with evidence** — the Definition of Done (QUALITY.md §4) in full:
    - open `dist/<tool>.html` from `file://`; capture screenshots in **both themes** and compare
      side-by-side against the v1 original (Playwright or the browser tools — archived under
      `tests/evidence/<tool>/`);
    - exercise the tool's core feature end-to-end (real fetch for network tools — record the
      response summary; full interaction for offline tools);
    - network tools: verify the stale-cache offline path by blocking the network;
    - confirm localStorage keys written are identical to v1's (devtools snapshot).
11. **Tick the table** below in the same commit as the migration; the commit message links the
    evidence directory.

## 2. Fix at migration time vs Phase 4

Phase 4 is an **audit**, not a second chance — everything a tool needs is done when the tool is
touched. The only items that wait are ones with a genuine dependency:

| At migration time | Phase 4 (and why it waits) |
|---|---|
| broken `.example` URLs → embedded BLS data / link-out cards (Batch C) | CSP suite-wide emission — blocked on the Phase 1 browser-compatibility verdict |
| hardcoded BART key → `suite.key.bart` (Batch C) | escaping re-audit of the 5 flagged files — a dedicated adversarial pass, done once against final code |
| focus.html missing export (pilot, Phase 1 — data-loss risk) | games integration — depends on the meteor-patrol finish-or-park decision |
| inline handlers (build rejects them) | suite-wide smoke run + a11y re-verification — audits of migration-time work |
| divergent fetch helpers → `Suite.fetchJSON` | |
| per-tool a11y checklist (recipe step 8) | |

## 3. Batch plan

Batches group by **risk class** so a class-wide defect surfaces in the first batch that can
exhibit it; within a batch, tools migrate in parallel.

| Batch | What | Count | Rationale |
|---|---|---|---|
| Pilots (Phase 1) | focus, weather, index | 2 tools + hub | span the risk spectrum — storage-heavy offline / canonical fetcher / generated hub — so the machinery is proven on every class of problem before fan-out |
| A | remaining zero-network tools | 21 | simplest class; validates the recipe at scale with no network variables |
| B | CORS-open fetchers | 33 | one risk class: live fetch + stale-cache path per tool |
| C | keyed + CORS-blocked + rate-limited | 12 | the designed no-key states, embedded-data and link-out cards, and backoff behavior are features to verify, not edge cases |
| D | large-embedded-data specials | 3 | password / word / passes: **inline data stays, only chrome is templated** — data segments hashed pre/post build to prove byte-exact survival |

## 4. Parity rules

- **localStorage keys unchanged.** A v1 user opening the v2 file finds their data. Never rename a
  key without a `Suite.store.migrate()` entry.
- **"Same design language," not pixel-identical.** The extracted core may shift spacing by a few
  pixels. Palette, typography, and component shapes must match — proven by the side-by-side
  screenshots in the evidence directory, not by recollection.
- **No behavior removed.** Every v1 feature (history lists, export buttons, keyboard shortcuts)
  survives. Improvements are allowed; regressions are not. The reviewer walks the v1 file's
  features as a checklist.
- **v1 is the reference implementation.** The `v1-import` tag is the authority; every migration
  diff is reviewed against it.

## 5. Burn-down table

Legend — **Net**: off = zero-network · cors = keyless CORS-open · key = user/demo key · blocked =
source blocks browser scripts (embedded data or link-out). **Flags**: EA = escape re-audit
(Phase 4) · RL = rate-limited · XP = has export/import · LD = large embedded data.

| # | File | Category | Net | Key | Batch | Flags | Done |
|---|---|---|---|---|---|---|---|
| 1 | focus.html | time | off | — | Pilot | XP added here (was missing — data-loss fix) | ✅ `tests/evidence/focus/` |
| 2 | weather.html | sky | cors | — | Pilot | | ✅ `tests/evidence/weather/` |
| — | index.html (hub) | — | off | — | Pilot | generated from manifest | ✅ `tests/evidence/index/` |
| 3 | almanac.html | sky | off | — | A | | ✅ `tests/evidence/almanac/` |
| 4 | holidays.html | civic | off | — | A | | ✅ `tests/evidence/holidays/` |
| 5 | voting.html | civic | off | — | A | curated static links, refresh each cycle | ✅ `tests/evidence/voting/` |
| 6 | emergency.html | health | off | — | A | | ✅ `tests/evidence/emergency/` |
| 7 | convert.html | ref | off | — | A | | ✅ `tests/evidence/convert/` |
| 8 | worldclock.html | time | off | — | A | | ✅ `tests/evidence/worldclock/` |
| 9 | dates.html | time | off | — | A | | ✅ `tests/evidence/dates/` |
| 10 | daylight.html | time | off | — | A | | ✅ `tests/evidence/daylight/` |
| 11 | printables.html | time | off | — | A | print CSS | ✅ `tests/evidence/printables/` |
| 12 | tripcost.html | local | off | (eia opt.) | A | optional gas-price fetch | ✅ `tests/evidence/tripcost/` |
| 13 | qr.html | util | off | — | A | | ✅ `tests/evidence/qr/` |
| 14 | text.html | util | off | — | A | | ✅ `tests/evidence/text/` |
| 15 | color.html | util | off | — | A | | ✅ `tests/evidence/color/` |
| 16 | random.html | util | off | — | A | | ✅ `tests/evidence/random/` |
| 17 | notes.html | util | off | — | A | XP (keep) | ✅ `tests/evidence/notes/` |
| 18 | dataviewer.html | util | off | — | A | | ✅ `tests/evidence/dataviewer/` |
| 19 | sound.html | util | off | — | A | | ✅ `tests/evidence/sound/` |
| 20 | paper.html | util | off | — | A | print CSS | ✅ `tests/evidence/paper/` |
| 21 | timers.html | util | off | — | A | | ✅ `tests/evidence/timers/` |
| 22 | loan.html | util | off | — | A | | ✅ `tests/evidence/loan/` |
| 23 | flashcards.html | util | off | — | A | XP (keep) | ✅ `tests/evidence/flashcards/` |
| 24 | alerts.html | sky | cors | — | B | | ✅ `tests/evidence/alerts/` |
| 25 | radar.html | sky | cors | — | B | image loops (no CORS issue) | ✅ `tests/evidence/radar/` |
| 26 | air.html | sky | cors | — | B | | ✅ `tests/evidence/air/` |
| 27 | spaceweather.html | sky | cors | — | B | grid flag was a planning artifact — v1 uses a local Kp/lat table; SWPC fetches cached 10 min | ✅ `tests/evidence/spaceweather/` |
| 28 | tides.html | sky | cors | — | B | add `application=` param | ✅ `tests/evidence/tides/` |
| 29 | marine.html | sky | cors | — | B | NDBC path stays descoped (no CORS) | ✅ `tests/evidence/marine/` |
| 30 | normals.html | sky | cors | — | B | NCEI gotchas in CATALOG | ✅ `tests/evidence/normals/` |
| 31 | quakes.html | earth | cors | — | B | | ✅ `tests/evidence/quakes/` |
| 32 | rivers.html | earth | cors | — | B | legacy NWIS API sunsets ~Q1 2027 — confirm new API | ✅ `tests/evidence/rivers/` |
| 33 | wildfire.html | earth | cors | — | B | | ✅ `tests/evidence/wildfire/` |
| 34 | drought.html | earth | cors | — | B | via Living Atlas (USDM direct is no-CORS) | ✅ `tests/evidence/drought/` |
| 35 | volcano.html | earth | cors | — | B | | ✅ `tests/evidence/volcano/` |
| 36 | snow.html | earth | cors | — | B | | ✅ `tests/evidence/snow/` |
| 37 | wildlife.html | earth | cors | ebird opt. | B | eBird key onto `Suite.key()` | ⬜ |
| 38 | iss.html | space | cors | — | B | | ✅ `tests/evidence/iss/` |
| 39 | asteroids.html | space | cors | — | B | | ⬜ |
| 40 | fedregister.html | civic | cors | — | B | | ⬜ |
| 41 | recalls.html | civic | cors | — | B | 3 sources | ⬜ |
| 42 | treasury.html | civic | cors | — | B | | ⬜ |
| 43 | yields.html | money | cors | — | B | | ⬜ |
| 44 | currency.html | money | cors | — | B | | ✅ `tests/evidence/currency/` |
| 45 | illness.html | health | cors | — | B | | ✅ `tests/evidence/illness/` |
| 46 | medicine.html | health | cors | — | B | | ⬜ |
| 47 | foodrecalls.html | health | cors | — | B | | ⬜ |
| 48 | dictionary.html | ref | cors | — | B | EA | ⬜ |
| 49 | wiki.html | ref | cors | — | B | EA | ⬜ |
| 50 | zip.html | ref | cors | — | B | | ✅ `tests/evidence/zip/` |
| 51 | factbook.html | ref | cors | — | B | EA | ⬜ |
| 52 | books.html | ref | cors | — | B | inline `onerror=` → listener | ⬜ |
| 53 | art.html | ref | cors | — | B | EA · inline `onerror=` → listener | ⬜ |
| 54 | geo.html | local | cors | — | B | Census JSONP path; Nominatim 1 req/s | ⬜ |
| 55 | elevation.html | local | cors | — | B | | ⬜ |
| 56 | network.html | local | cors | — | B | ipapi.co 1k/day | ✅ `tests/evidence/network/` |
| 57 | apod.html | space | key | nasa (demo) | C | RL (DEMO_KEY 30/hr) | ⬜ |
| 58 | nutrition.html | health | key | usda (demo) | C | RL | ⬜ |
| 59 | congress.html | civic | key | congress | C | | ⬜ |
| 60 | gas.html | money | key | eia | C | | ⬜ |
| 61 | parks.html | civic | key | nps | C | | ⬜ |
| 62 | markets.html | money | key | finnhub | C | RL (CoinGecko keyless path) | ⬜ |
| 63 | launches.html | space | cors | — | C | RL (15 req/hr — TTL + backoff) | ⬜ |
| 64 | nearby.html | local | cors | — | C | RL (Overpass — TTL + mirror fallback) | ⬜ |
| 65 | airport.html | space | blocked | — | C | remove `.example` → link-out card to aviationweather.gov | ⬜ |
| 66 | jobs.html | money | blocked | — | C | remove `.example` → embedded monthly BLS data | ⬜ |
| 67 | inflation.html | money | blocked | — | C | remove `.example` → embedded monthly BLS data | ⬜ |
| 68 | transit.html | local | blocked/key | bart (new) | C | externalize BART key (v1 `transit.html:163`); custom feed → link-out card | ⬜ |
| 69 | password.html | util | off | — | D | LD (62 KB EFF wordlist — must survive build byte-exact) | ⬜ |
| 70 | word.html | util/ref | cors | — | D | LD (embedded dictionary) · EA | ⬜ |
| 71 | passes.html | space | cors | — | D | LD (SGP4 math + TLE handling) | ⬜ |

New in v2 (not migrations): **settings.html** (Phase 4 — backup/restore, keys, relay config) and
the **games** hub category (Phase 4 — meteor-patrol de-nested).

## 6. Progress tracking

`python build.py --check` prints the counts (migrated / per batch / flags outstanding) computed
from the manifest, so this table and reality can't silently diverge — if they do, the check output
wins and the table gets corrected. Evidence for every ticked row lives under
`tests/evidence/<tool>/` (screenshots both themes, interaction/fetch record, localStorage
snapshot) — a row without evidence is not done.
