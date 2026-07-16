# launches.html migration report

Batch C (`cors-open` + `rl`), fresh migration — no prior draft existed. Harness run:
`node verify-tool.mjs launches`, exit 0; all evidence in this directory is from that run.

## v1 feature walk-through

Every v1 feature, verified (evidence: `interaction.txt` line numbers, screenshots here):

- [x] **Live LL2 fetch of the next 10 launches** (`ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=10&mode=normal`,
  URL byte-identical to v1) — one real request per harness page load; 10 launches landed in
  `suite.cache.launches.upcoming` (line 1), first item "Falcon 9 Block 5 | SDA Tranche 1
  Transport Layer E", NET 2026-07-16T20:32:27Z, status Go, precision Second (line 2).
- [x] **Next-launch hero card** (eyebrow / mission name / provider · location / status badge) —
  rendered from live data (line 3: SpaceX · Vandenberg SFB, CA, USA, badge "Go for Launch").
  All via `createElement`/`textContent`, verbatim v1.
- [x] **Live countdown (Days/Hours/Min/Sec) for precise NETs** — ticks verified under
  `page.clock`: `["0","16","33","12"]` -> +3 s -> `["0","16","33","09"]` -> +60 s ->
  `["0","16","32","12"]` (line 8). Zero-padding rule (`<10` pads except Days) observed in the
  values. The `interact()` module contains a fixture fallback for the case where the live next
  launch has a coarse NET; it did NOT trigger this run — the countdown above is live data.
- [x] **"Targeting <date> — date not yet firm" approx line for imprecise NETs** — code path
  verbatim from v1 (`preciseTime()` gate); not hit live this run (next launch was
  precision=Second). Imprecise handling IS visible in the list: Electron | LOXSAT 1 renders
  date-only "Jul 30" + "~14d 20h" relative (v2-light.png, last row).
- [x] **T-0-passed state** (`cd.past` greying + "T-0 has passed — awaiting confirmation."
  prefix, flagged once) — `tick()` verbatim v1; no live launch crossed T-0 during the run.
- [x] **Status badges with go/tbd/fail/info classes** — `badgeClass()` verbatim; "Go for
  Launch" (go) and "To Be Confirmed"/"To Be Determined" (tbd) both visible in the screenshots.
- [x] **Upcoming list: name+badge, rocket / pad, location / orbit row, 260-char truncated
  mission blurb, local-format T0 + relative T-** — 10 rows rendered (line 5), first row logged
  in full (line 6), blurbs are `textContent` (line 7), "…" truncation visible in the
  screenshots.
- [x] **Cache-first paint** — reload with a fresh cache painted instantly from
  `suite.cache.launches.upcoming` with stamp "Cached · updated just now." and spent no request
  (line 4; also 429-segment first paint, line 10, hits=0).
- [x] **Hourly refresh discipline** (`REFRESH_MS` 1 h; fresh cache short-circuits the fetch) —
  verbatim v1 constant; proven by lines 4 and 10 (no request while fresh).
- [x] **Refresh button (force fetch)** — converted `onclick` -> `addEventListener`; exercised
  offline (line 17): forces a fetch despite cache/backoff and reports the failure honestly.
- [x] **429 handling** — deterministic route-fulfilled 429 (aged cache): stamp "Rate limit
  reached — showing cached schedule from 2 hr ago.", cached rows still rendered (line 11),
  `rate-limited-429.png`. No-cache 429 keeps v1's message "Rate limited — the feed allows
  ~15/hour." in the error card (code path, see changes below).
- [x] **Rate-limit throttle note** — static paragraph kept verbatim, visible (line 13).
- [x] **Offline / fetch-failure with cache** — stamp "Live fetch failed — showing cached
  schedule from 24 hr ago.", hero + 10 rows still render from the stale cache (lines 15-16,
  `offline-stale.png`).
- [x] **No-cache failure error card** ("Couldn't load launches" + message) — markup and copy
  verbatim v1 (static `innerHTML` heading + `textContent` message); not driven live (verifying
  it would add nothing: same code path as the message rendering already exercised, and the
  no-cache state cannot coexist with the cached fixtures without extra requests).
- [x] **`slim()` payload mapping** — byte-identical field mapping (id/name/net/precision/
  status/provider/rocket/pad/location/mission).
- [x] **Skeleton loading state** — verbatim ("Loading launch schedule…", `.msg.skeleton`).
- [x] **Theme toggle** — light -> dark, `aria-pressed=true` (line 18), via `Suite.theme.init()`.

## changes beyond the recipe

- **429 backoff (Batch C `rl` requirement — new behavior, policy-mandated).** On HTTP 429 (or
  403-as-throttle) the tool writes `suite.launches.backoffUntil = now + 1 h`, doubling the
  effective TTL to 2 h: until it passes, the automatic refetch is skipped and the stamp reads
  "Source is rate-limiting — showing cached data from <ago>." A successful fetch clears the key;
  the explicit refresh button still forces a request (user intent wins). Verified
  deterministically: 429 wrote the key ~60 min ahead (interaction.txt line 12) and a reload
  inside the window made zero requests (line 14, route-hit counter still 1).
- **Cache payload shape.** v1 cached the *slimmed* array in its self-rolled envelope;
  `Suite.fetchJSON` caches the *raw* LL2 payload in the same `{t,v}` envelope at the same key.
  `itemsOf()` accepts both shapes, so a v1 user's existing cache keeps rendering unchanged
  (`localstorage.json` shows v1 slim ~6.8 KB vs v2 raw ~90 KB at the same key; the v2 page
  rendered from the envelope without error across all of the run's reloads).
- **TTL justification (manifest `cacheTtlMin: 60`).** The registry limit is 15 req/hr
  (API-AND-RELAY.md §2 rate-limit registry: "long TTL (>=30 min) + backoff"); v1 itself used a
  1-hour `REFRESH_MS` and advertises it in the UI throttle note. 60 min keeps v1's exact
  cadence — stricter than the >=30 floor — and the 429 path doubles it to 120 min.
- **Error-message source.** v1's bespoke `fetchJSON` surfaced the LL2 body's `detail` string on
  non-OK responses; `Suite.fetchJSON` does not parse error bodies, so the no-cache error card
  now shows v1's own throttle phrasing for 429/403 and `HTTP <status>` otherwise (v1 also fell
  back to `HTTP <status>` when `detail` was absent). Cosmetic-only, and only in the no-cache
  failure card.
- **Dead code dropped:** v1's `esc()` was an identity function (`String(s==null?"":s)`) defined
  and never called — removed rather than carried over as a fake escaper. All rendering was and
  remains DOM/`textContent`. (The unused `upcoming` filter variable in `paint()` is kept
  verbatim to stay line-for-line with v1.)
- Theme/storage via core (`Suite.theme.init()`, `Suite.store`); `onclick` -> `addEventListener`;
  boilerplate CSS deduplicated into `core/suite.css` with tool-local overrides where v1 differs
  (muted `.back` in the sticky topbar, `.theme-btn { float:none }`, footer 2.4rem/.84rem,
  `body { min-height:100vh }`).

## localStorage keys

From `localstorage.json` (keysOnlyInV1 = []):

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.cache.launches.upcoming` | yes (`{t,v}`, v = slim array) | yes (same key + envelope, v = raw LL2 payload; both shapes readable) |
| `suite.launches.backoffUntil` | — | **v2-only** (keysOnlyInV2) — the policy-mandated `rl` backoff marker, declared in the manifest `storage` list; written only after a throttle response, cleared on the next successful fetch |

## escape allowlist requests

none — the tool has no template-literal interpolation into `innerHTML` at all. Every remote
string (mission names, blurbs, providers, pads, statuses) goes through
`createElement`/`textContent` (v1's own discipline, preserved). The only `innerHTML` writes are
clears (`= ""`) and one fully-static error-card heading literal.

## a11y applied

- `Suite.liveRegion()` on `#stamp` — data-freshness / stale / rate-limit announcements reach
  screen readers. Deliberately NOT applied to `#next` or `#list`: `#next` contains the 1-second
  countdown, and a live region there would announce every tick.
- Theme button `aria-label` + `aria-pressed` via core (verified, interaction.txt line 18).
- No form inputs exist; the two buttons (`.theme-btn`, `#refreshBtn`) carry visible text and
  are native `<button>`s — full keyboard path. No overlays, so no Esc handling needed.
- Back link is a real text `<a>` (core pattern).

## endpoints

- `https://ll.thespacedevs.com` — the only contactable host (one GET,
  `/2.3.0/launches/upcoming/?limit=10&mode=normal`). In the manifest `endpoints`; present in
  CATALOG.md (line 166 narrative — which specifically warns to use the 2.3.0 plural `launches`
  route, as this URL does — and CORS table line 519, keyless, 15/hr). CATALOG line 519 status
  reads "verify": this run is a fresh live-CORS verification from `file://` (2026-07-16,
  10 launches fetched) — the orchestrator may touch the verification date.
- `mode=normal` (not the CATALOG example's `mode=list`) is v1's own parameter, kept — it is
  what supplies the mission descriptions/blurbs.

## concerns for the reviewer

- **Live-request spend:** the full harness run makes ~6 real LL2 requests (4 theme-capture
  page loads + interact boot + v1Interact boot) against a 15/hr limit. One run is safe; do not
  re-run the harness repeatedly within an hour, and expect real 429s if it is (no other suite
  tool uses this host, so there is no cross-tool contention).
- **`page.clock.install()` is not literally first in `interact()`:** the module first polls for
  the boot fetch to land, then installs and reloads. Installing first (the iss.mjs pattern)
  would have reloaded mid-fetch and spent a second live request against the 15/hr budget. All
  time-sensitive assertions run after install. Same reasoning: `v1Interact` skips the clock
  entirely (it only waits for v1's cache write; nothing time-based is asserted there).
- **The 429 segment runs on a sibling page** (`context.newPage()`, shared file:// storage):
  Chrome logs every HTTP-4xx resource load as `console.error`, and verify-tool.mjs fails on any
  non-`net::ERR` console error — the fulfilled 429 is the deliberate fixture, not a defect.
  State assertions (stamp, backoff key, hit counter) are unaffected; the backoff key it wrote
  was visible to the main page, which expired it via the fake clock before the offline segment.
- **Cache weight:** the raw-payload cache is ~90 KB vs v1's ~6.8 KB slim array
  (localstorage.json). Well inside localStorage quota, but if the orchestrator prefers the slim
  cache, the tool would need to bypass `fetchJSON`'s cacheKey and write the envelope itself — I
  kept the Batch B policy ("every fetch goes through Suite.fetchJSON with cacheKey") over the
  smaller footprint.
- **`suite.launches.backoffUntil` persists after the run** in the v2 snapshot (keysOnlyInV2)
  because the 429 fixture wrote it and no successful fetch followed (the offline segment came
  next by design). Expected; explained above; declared in the manifest.
- The two `net::ERR_FAILED` console errors in interaction.txt are the deliberately
  route-aborted offline-segment fetches (reload + refresh click); the harness filters these and
  exited 0.
- Computed-style diff is exclusively the pre-approved `-webkit-font-smoothing` (12 values per
  theme, every selector). Zero geometry/color/layout deltas.
- v1's `paint()` computes an `upcoming` filter it never uses; kept verbatim (dead but
  harmless) to stay line-for-line — flagging so the Phase 4 audit doesn't rediscover it.

## Phase 4 a11y audit (2026-07-16)

Independent re-verification of the QUALITY.md §2 checklist, executed in the running tool
(Playwright/Chrome from file://, light + dark, keyboard-only drive of the primary feature,
contrast computed from getComputedStyle with ancestor alpha-compositing).

| # | Checklist item | Verdict | Evidence |
|---|---|---|---|
| 1 | icon-only controls have accessible names | pass | unnamed: (none) |
| 2 | async/result regions carry aria-live | pass (by design) | runtime check below |
| 3 | keyboard path for every mouse path | pass | keyboard-only drive log below; no positive tabindex ((none)); no traps |
| 4 | inputs labelled | pass | unlabelled: (none) (labelled: 0) |
| 5 | contrast, both palettes | fixed (see below); remaining FAILs are the suite-wide --muted flags | full pair tables below |
| 6 | visible focus indicator | pass | light: all stops show an indicator; dark: all stops show an indicator |

### Contrast — light
```
contrast pairs (9 unique fg/bg combos):
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.4px/400 — footer "Data: The Space Devs · Launch Li"
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 12.8px/400 — div.rel "2d 0h ago"
  pass 4.81 (need 4.5) fg=#83561a bg=#e9dfd1 11.8px/600 — span.badge.tbd "To Be Determined"
  pass 4.91 (need 4.5) fg=#ab2e1f bg=#f0d8d2 11.8px/600 — span.badge.fail "Launch Failure"
  pass 5.6 (need 4.5) fg=#2c5f35 bg=#d9e1d6 11.8px/600 — span.badge.go "Go for Launch"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 24px/700 — h1 "Rocket Launch Schedule"
  pass 13.39 (need 4.5) fg=#23282e bg=#f5f3ee 16.8px/700 — h2#listHead "Upcoming"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.61 (need 3) fg=#23282e bg=#fffdf9 38.4px/400 — div.v "2"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline]
```

### Contrast — dark
```
contrast pairs (9 unique fg/bg combos):
  pass 4.63 (need 4.5) fg=#e88574 bg=#423234 11.8px/600 — span.badge.fail "Launch Failure"
  pass 4.85 (need 4.5) fg=#d69a4c bg=#3e362d 11.8px/600 — span.badge.tbd "To Be Determined"
  pass 5.46 (need 4.5) fg=#7dc487 bg=#2e3e37 11.8px/600 — span.badge.go "Go for Launch"
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 12.2px/400 — div.eyebrow "Next launch"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.4px/400 — footer "Data: The Space Devs · Launch Li"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 12.96 (need 3) fg=#e7e5e0 bg=#1d2026 38.4px/400 — div.v "2"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 24px/700 — h1 "Rocket Launch Schedule"
  pass 14.25 (need 4.5) fg=#e7e5e0 bg=#15171b 16.8px/700 — h2#listHead "Upcoming"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#refreshBtn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached refresh button (BUTTON#refreshBtn after 3 tab(s))
  Enter on refresh (network blocked) -> stamp updated to "Live fetch failed — showing cached schedule from 5 min ago."

### aria-live runtime check
  #stamp: aria-live=polite
  #next: aria-live=(missing)
  #list: aria-live=(missing)
```

### Fixes made (tool-local CSS, all four theme contexts)
- Status-badge palette (tool `:root` vars, all four contexts): light `--go` #3a7d44 -> #2c5f35 (badge text on its 18% tint 3.90 -> 5.46), light `--tbd` #b0752a -> #83561a (3.12 -> 4.81; also lifts the `.approx` line on the card to 5.0), light `--fail` #c0392b -> #ab2e1f (4.10 -> 4.92); dark `--fail` #e0705f -> #e88574 (4.03 -> 4.63).

### Notes
- aria-live design note: `#stamp` (Suite.liveRegion) is the announcer and updates on every load outcome (cached / updated / rate-limited / failed) — verified at runtime via the keyboard refresh. `#next`/`#list` are deliberately NOT live: `#next` contains the per-second countdown, which as a live region would announce every tick.
- Network etiquette: the audit spent ZERO live LL2 requests (cache seeded with a slim-shape fixture; all http aborted). The verify-tool re-run below used the module's budgeted live fetch.

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
- `node verify-tool.mjs launches` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
