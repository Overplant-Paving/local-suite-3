# transit.html — migration report (Batch C, formerly-broken, two remediations)

Completer agent note: this migration finishes a prior agent's unverified drafts
(`handoff/batchC-drafts/transit.html` + `transit.mjs`, moved here after diffing against v1
and fixing). Draft completeness assessment at the bottom of "concerns".

## v1 feature walk-through

- [x] **Source tabs (BART / custom / links)** — exercised in interaction: switched to
  "My agency" (step 3), "Other agencies" (step 3b, `boardCard` display="none" logged),
  back to custom and BART. Toggle logic is byte-equivalent to v1 plus `aria-pressed`.
- [x] **BART station list, fetched + cached (`suite.cache.transit.bartstations`)** — live:
  "50 stations in the select" (interaction.txt:1). Cache envelope `{t, v:[{abbr,name}]}`
  identical to v1 (localstorage.json — same key, same 2027-char value shape as the v1 run).
- [x] **Station list sorted by name, saved station restored** — first option is
  "12th St. Oakland City Center" (sorted); after selecting Embarcadero,
  `suite.transit.bartStation=EMBR` (interaction.txt:16) and the offline reload restored it.
- [x] **Live ETD board: destination, line-color dot, platform, car length, delay, 3 times,
  sorted by soonest** — real departures logged with all fields, e.g.
  "Richmond -> [6 min, 23m, 34m] (Platform 2 · 6-car · delayed 7 min)"; first column is
  soonest-first in every logged board. Line-dot colors visible in the screenshots
  (red/yellow/blue BART line colors).
- [x] **"Leaving" → "Now" (red) rendering** — code path identical to v1 (`firstMin` +
  `.now` class); a live "Now" appeared in the first pre-fix run (interaction evidence of
  run 1: "Richmond -> [Now, 18m, 19m]"), rendering verified there.
- [x] **No-trains message path** — code identical to v1 (message.warning /
  #cdata-section fallback), not live-exercisable at test time (trains running); verified
  by diff.
- [x] **Refresh button** — clicked in step 7 (recovery), fresh "Updated 11:00:14 PM".
- [x] **Auto-refresh every 30 s while visible** — `setInterval` block byte-equivalent to
  v1 (verified by diff); live refresh behavior proven via the Refresh path instead of a
  30 s wait.
- [x] **Custom JSON feed: GTFS-realtime-as-JSON heuristic** — route-fulfilled payload,
  3 rows rendered ("Red Line -> [4 min] (stop STN-04)" …) — interaction.txt:27-30.
- [x] **Custom JSON feed: plain-array heuristic** — second payload shape via the relay
  pass: "Airport -> [7 min] (Platform 2)", "Downtown -> [9 min]".
- [x] **Custom feed: raw-JSON honest fallback** — unrecognized shape rendered the hint +
  `<pre>` with the raw response (interaction.txt:37).
- [x] **Custom URL persisted (`suite.transit.customUrl`)** — present and equal in both
  v1 and v2 snapshots.
- [x] **Custom feed error card (CORS/HTTP failure)** — code identical to v1 plus the
  relay hint; not separately exercised (the fallback + stale paths cover the error UX).
- [x] **Link-out directory (8 agencies, target=_blank rel=noopener)** — all 8 cards
  logged with hosts (interaction.txt:18-26).
- [x] **Theme toggle** — harness probe: light -> dark, aria-pressed=true.
- [x] **Footer** — kept; wording updated "public demo key" → "public key" (the key is
  BART's officially published public key, not a demo tier).

## changes beyond the recipe

1. **Remediation 1 — BART key externalized** (v1 transit.html:163 hardcoded
   `MW9S-E7SL-26DU-VV8V`): now `Suite.key("bart")` — core ships the public value as the
   documented default; a user key pasted into `suite.key.bart` takes precedence. Evidence:
   `Suite.key("bart"): stored=null -> value=MW9S-E7SL-26DU-VV8V isDemo=true`, and a
   source grep in the interaction confirms the literal key is not in the tool's
   markup/script. `isDemo` renders the designed nudge: "Using BART's shared public key —
   get your free key" linking https://api.bart.gov/api/register.aspx (visible in
   v2-light/dark screenshots).
2. **Remediation 2 — `.example` custom feed removed** (v1 placeholder
   `https://your-agency.example/departures.json` — fatal gate): the "Custom JSON feed"
   tab became **"My agency"**, led by a designed link-out card (API-AND-RELAY.md §4-5):
   the user saves their agency's own live-board URL once and gets a first-class styled
   card ("Open your departure board ↗" + hostname, accent-tinted). Evidence:
   agency-linkout.png + interaction.txt:17. The v1 custom-feed fetch mechanics are
   **preserved** under "Advanced: direct JSON feed" on the same pane — same heuristics,
   same `suite.transit.customUrl` key, new placeholder has no `.example`.
3. **Relay path** — the custom feed fetch goes through `Suite.relay(url)` when
   `suite.relay.url` is set. Verified against the worker contract with a fake base:
   observed request `https://relay.test/w?url=https%3A%2F%2Ffeed.test%2Fdepartures.json`,
   `relay contract ok: true`; the upd stamp appends "· via relay".
4. **Policy-mandated ETD caching** (Batch B addendum: v1 did not cache ETD): departures
   now go through `Suite.fetchJSON` with `cacheKey: transit.etd.<ABBR>`, `ttl: 0` —
   always fetched live (v1 refreshed every 30 s; ttl 0 preserves that), the envelope
   exists purely for the offline/stale fallback. Stale render: "Offline — cached from
   <time>" in the warn color (offline-stale.png), never pretending freshness.
5. **Station-list TTL**: v1 cached stations forever; v2 refreshes after 7 days
   (reference-data class, API-AND-RELAY.md §2) but still serves an expired cached list
   when the network is down (it changes rarely). Cache key and value shape unchanged.
6. **Custom feed deliberately NOT cached**: arbitrary user-supplied URLs would mean
   unbounded per-URL cache keys (the geo gotcha); the task notes scope the stale path to
   the BART path. Noted as a conscious deviation from the "add caching" default.
7. Hint/footer wording updated to match the key remediation ("(demo key)" removed; the
   nudge line carries that information). `.card` display:block / `.back` muted-color
   tool-local overrides added on top of core (suite-wide pattern; v1 parity).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (core) |
| `suite.cache.transit.bartstations` | yes | yes — same `{t,v}` envelope and value shape |
| `suite.transit.bartStation` | yes | yes |
| `suite.transit.customUrl` | yes | yes |
| `suite.transit.agencyLink` | — | **new** (remediation 2 link-out card) |
| `suite.cache.transit.etd.<ABBR>` | — | **new** (policy-mandated stale fallback; bounded — 50 BART stations) |
| `suite.key.bart` | — | read-only (user key overrides the public default) |
| `suite.relay.url` | — | read-only (optional relay base) |

`keysOnlyInV1: []`. `keysOnlyInV2` = the two documented additions above (agencyLink +
two etd station caches from the run). No renames; no migration entry needed.

## escape allowlist requests

1. `viaRelay ? " (or your relay must allow this host)" : ""` (loadCustom error card) —
   both ternary branches are string literals; no data interpolated.
2. `${diff} <small>min</small>` (renderCustom, via the `label` variable assigned to
   `t.innerHTML`) — `diff` is `Math.round((r.at - Date.now()) / 60000)`, provably a
   number; the sibling remote-data branch uses `${esc(r.mins)}`.

Everything else interpolated into `innerHTML` is wrapped in `esc(` (= `Suite.esc`):
`e.message` (x3), the BART no-trains message, `x.minutes`, `r.mins`. Note v1's local
`esc()` was an identity function — v2 escaping is real.

## a11y applied

- `srcSeg` gets `role="group" aria-label="Departure source"`; each tab button carries
  `aria-pressed` kept in sync on switch.
- `<label for=>` on the station select, agency-URL input, and feed-URL input.
- `Suite.liveRegion()` on `#board`, `#boardUpd`, and `#agencyCard` (async result areas).
- Enter submits on both text inputs (`#agencyUrl` → save, `#customUrl` → load).
- Theme button aria handled by core (`aria-label` + `aria-pressed`, probe logged).
- All buttons are real text buttons; no icon-only controls; no overlays (no Esc path
  needed); keyboard path exists for every mouse path (native controls throughout).

## endpoints

- `https://api.bart.gov` — the only host the tool contacts on its own. CORS-open,
  verified live this run (stations + ETD, real departures logged with station names and
  times; see interaction.txt). **CATALOG.md gap:** `api.bart.gov` is not yet mentioned in
  CATALOG.md (the transit row talks about GTFS generically) — orchestrator should add it
  with today's verification date.
- Link-out targets (8 agency sites + the saved agency link + the BART signup page) are
  navigation, not endpoints — excluded per the Batch C addendum.
- The advanced custom feed / relay can contact user-configured hosts — see concerns.

**Network classification: `keyed`** — justification: the primary source (api.bart.gov)
is CORS-open but key-mediated; the tool uses the full `Suite.key` mechanics
(`suite.key.bart` override, shipped public default, isDemo nudge + signup link), which is
the "keyed" contract. The CORS-blocked custom-agency case is handled by the link-out card
(the "blocked" pattern) as a secondary path, per the task notes' "read the source,
choose, justify".

**cacheTtlMin: 1** — departures are minute-granularity data fetched live on every
refresh (fetchJSON ttl 0, matching v1's 30 s auto-refresh); 1 is the nearest declared
freshness class and the cache envelope exists only for the stale fallback. The station
list sub-resource uses the 7-day reference-data TTL internally.

## concerns for the reviewer

1. **Dist CSP will block the advanced custom feed and the relay.** `connect-src` derives
   from the manifest endpoints (api.bart.gov only), so in `dist/` a user-pasted feed URL
   or relay base on another host will be blocked by CSP and surface the tool's error
   card. From source (`tools/`, no CSP) both work — which is how they were verified.
   This needs an orchestrator decision: accept as a documented limitation (the link-out
   card is the designed primary path), or extend the CSP policy for user-configured
   hosts. Same question will hit airport's relay path.
2. **Etiquette / request count**: the harness run makes ~14 real api.bart.gov requests
   total (interaction pass: 1 stations + 4 ETD; plus 4 screenshot page-loads and the v1
   parity pass each doing stations+ETD, exactly like a user opening the page). BART's
   ETD API is built for 30-second polling; no loops or retries anywhere. Three harness
   runs were needed (initial, .card fix, feature-walk additions).
3. **Stale minutes are stale**: the offline board renders cached "N min" values that are
   no longer accurate; the "Offline — cached from <time>" stamp (warn color) is the
   honest label. v1 had no offline path at all here, so this is strictly additive.
4. **The nudge is permanent for keyless users**: `Suite.key("bart")` returns
   `isDemo:true` unless a personal key is pasted, so the one-line nudge always shows by
   default. This is the designed Batch C state; it explains the +28 px body/card height
   in the computed-style diff.
5. **No paste-a-key field in the tool**: v1 had none (key was hardcoded), so there were
   no "v1 key-prompt mechanics" to keep; `suite.key.bart` is settable via console or
   settings.html (Phase 4). Flagging in case the reviewer wants a paste field anyway.
6. **Tab label change**: "Custom JSON feed" → "My agency" restructures that pane around
   the link-out card (remediation 2). No mechanics removed — the JSON feed moved to an
   "Advanced" subsection of the same pane.
7. **Computed-style diff residuals** (28/theme, all justified): `-webkit-font-smoothing`
   pre-approved; `.theme-btn` float none→right is the suite-wide inert diff (flex topbar
   ignores float); body/.card height +28 px = the visible key nudge line; `.seg` width
   386→333 px = the shorter "My agency" label.
8. **report.md written via shell** — the PostToolUse hook blocking Write on report.md
   fired as expected (known session gotcha).

### Draft completeness assessment (for the handoff record)

The prior agent's drafts were ~95% complete and of good quality: both remediations,
relay plumbing, stale path, a11y, and the interaction module were already in place and
survived verification almost unchanged. Found and fixed:

- **`.card` parity break** (real bug): the draft relied on core's `.card`, which is a
  flex column with gap — v1 cards are plain blocks. Fixed with the suite-standard
  `display:block; flex-direction:row; gap:normal` override (first harness run showed
  41 style diffs/theme incl. layout; now 28, all justified).
- **`.back` color parity** (real bug): draft stripped v1's muted back-link color instead
  of overriding core's accent (suite-wide convention keeps the override). Fixed.
- **Interaction module**: `page.unroute` was passed a new arrow-function instance (would
  silently not unroute the relay route); fixed by reusing the predicate reference. The
  etiquette comment undercounted real requests (ignored the harness's screenshot loads);
  corrected. Added coverage for two unexercised v1 features (links pane, raw-JSON
  fallback).
- Everything else diffed clean against v1.

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
contrast pairs (10 unique fg/bg combos):
  FAIL 4.1 (need 4.5) fg=#6b7280 bg=#efece4 13.1px/400 — code "api.bart.gov"
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.1px/400 — footer#foot ", public key). Other feeds are t"
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 13.1px/400 — div.meta "Platform 3 · 9-car · delayed 2 m"
  pass 5.26 (need 4.5) fg=#f5f3ee bg=#2f6f6a 14.1px/400 — button.on "BART (live)"
  pass 5.74 (need 4.5) fg=#2f6f6a bg=#fffdf9 13.1px/400 — a "get your free key"
  pass 5.74 (need 3) fg=#2f6f6a bg=#fffdf9 32px/700 — span.t.first "7"
  pass 12.58 (need 4.5) fg=#23282e bg=#efece4 14.4px/400 — button#bartRefresh.btn "Refresh"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 27.2px/700 — h1 "Transit Departure Board"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.61 (need 3) fg=#23282e bg=#fffdf9 24px/700 — div#boardStn.stn "12th St. Oakland City Center"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.on [outline] -> button [outline] -> button [outline] -> select#bartStn [outline] -> button#bartRefresh.btn [outline] -> a [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.on [outline] -> button [outline] -> button [outline] -> select#bartStn [outline] -> button#bartRefresh.btn [outline] -> a [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.on [outline] -> button [outline] -> button [outline] -> select#bartStn [outline] -> button#bartRefresh.btn [outline]
```

### Contrast — dark
```
contrast pairs (10 unique fg/bg combos):
  pass 5.47 (need 4.5) fg=#9aa0a8 bg=#262a31 13.1px/400 — code "api.bart.gov"
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 14.1px/400 — button "My agency"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.1px/400 — footer#foot ", public key). Other feeds are t"
  pass 6.91 (need 4.5) fg=#6fb5ae bg=#1d2026 13.1px/400 — a "get your free key"
  pass 6.91 (need 3) fg=#6fb5ae bg=#1d2026 32px/700 — span.t.first "3"
  pass 7.6 (need 4.5) fg=#15171b bg=#6fb5ae 14.1px/400 — button.on "BART (live)"
  pass 11.44 (need 4.5) fg=#e7e5e0 bg=#262a31 14.4px/400 — button#bartRefresh.btn "Refresh"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 12.96 (need 3) fg=#e7e5e0 bg=#1d2026 24px/700 — div#boardStn.stn "12th St. Oakland City Center"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 27.2px/700 — h1 "Transit Departure Board"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.on [outline] -> button [outline] -> button [outline] -> select#bartStn [outline] -> button#bartRefresh.btn [outline] -> a [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.on [outline] -> button [outline] -> button [outline] -> select#bartStn [outline] -> button#bartRefresh.btn [outline] -> a [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button.on [outline] -> button [outline] -> button [outline] -> select#bartStn [outline] -> button#bartRefresh.btn [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached seg: Other agencies button (BUTTON after 5 tab(s))
  Enter on seg button -> links pane shown: 8 agency cards
  Tab -> reached seg: BART button (BUTTON after 12 tab(s))
  Tab -> reached BART station select (SELECT#bartStn after 3 tab(s))
  ArrowDown on station select -> board station "16th St. Mission" (keyboard station change, one live ETD)

### aria-live runtime check
  #board: aria-live=polite
  #boardUpd: aria-live=polite
  #agencyCard: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
- `.seg button.on` text `#fff` -> `var(--bg)`: white on the dark-theme accent was 2.36:1; now 5.26:1 light / 7.60:1 dark.

### Notes
- Live BART used sparingly: one boot load per theme + one keyboard station change (ETD is a 30-second-polling API; this is below normal user traffic).

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
- `node verify-tool.mjs transit` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
