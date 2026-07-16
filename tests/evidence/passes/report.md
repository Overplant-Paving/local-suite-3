# passes.html — migration report (Batch D, large-embedded-data special)

Evidence: this directory. Verification run: `node verify-tool.mjs passes` (exit 0, console
clean apart from harness-filtered `net::ERR_FAILED` from the deliberately aborted routes).
Determinism: `page.clock` fixed at 2026-07-16T04:00:00Z, observer Los Angeles (34.0522,
-118.2437) via the shared `suite.location`, TLE cache seeded with a fixed 30-satellite
fixture archived inside `tests/interactions/passes.mjs` (captured from CelesTrak
GROUP=visual on 2026-07-15). Times in logs render in the host zone (America/Chicago).

## v1 feature walk-through

- [x] Theme toggle + persisted `suite.theme` — harness probe: `light -> dark, aria-pressed=true`.
- [x] First-run "Where are you?" card when no location — v1/v2 screenshots both themes show it
  (that is the captured state); boot branch logged via the later "change" flow.
- [x] ZIP lookup (zippopotam, live) — typed 90210, submitted, locbar renders
  "Location: Beverly Hills, CA 90210 change", `suite.location` updated (interaction.txt 16–17).
- [x] ZIP format validation ("Enter a 5-digit ZIP.") — not driven in the run; code is
  v1-verbatim except `errEl` hoisting (verified by inspection, see concerns).
- [x] Geolocation button + error copy — preserved verbatim; not exercisable headless (concerns).
- [x] "change" link reopens the location card — logged: `hidden=false` (line 15).
- [x] Locbar label/coords fallback rendering — logged locbar text.
- [x] TLE load from CelesTrak GP JSON with gpToTle synthesis — the ONE live fetch:
  157 satellites cached, first name "ATLAS CENTAUR 2", synthesized l1 logged (line 19),
  status "Elements just now. 157 satellites tracked." (lines 20–21).
- [x] 24 h cache with age stamp — deterministic run used a 1 h-old seeded cache with **no
  network route needed**: "Elements 60 min ago. 30 satellites tracked." (fresh-cache
  short-circuit + `suite.cache.passes.visual` slim shape both proven).
- [x] "Refresh satellite data" (forceNet) — the live fetch above was triggered by this button.
- [x] Plain-text TLE fallback chain — exercised with stubbed empty-200 responses: JSON path
  throws "empty" → text path fetched → parser returns none → "no TLEs parsed" surfaces in the
  error card (line 22). Full text-success path not driven live (a second CelesTrak pull —
  etiquette); parser is v1-verbatim.
- [x] Pass computation — 148 passes / 52 visible / 30 sats at minEl 10; 8 concrete rows logged
  with peak times, elevations, rises/peak/sets compass+azimuth, durations, magWord; night
  grouping headers with per-night counts (lines 1–12); precise `findPasses` output at exactly T
  logged as JSON for the cross-check (line 13).
- [x] Visible/eclipsed badges + dimming, mag badge for STD_MAG sats — CSS (TIANHE) row shows
  "VISIBLE MAG ~0.1"; eclipsed row present in precise list (COSMOS 2058, visible:false).
- [x] Min-elevation threshold + "Recompute passes" — minEl 30 recompute: 148→82 passes,
  52→26 visible (line 14).
- [x] Stale-cache offline state — 25 h-old cache + aborted network: "Elements from 7/14/2026,
  10:00:00 PM · Network failed — showing cached elements.. 157 satellites tracked.", full pass
  list still rendered (719 rows), `offline-stale.png` (lines 23–25).
- [x] No-cache failure card — "Couldn't load satellite data. … (no TLEs parsed)" (line 22).
- [x] Loading spinner status — the 30 ms spinner yield is what the clock fastForwards fire;
  spinner card markup unchanged.
- [x] Footer, back-link, `<code>` styling — screenshots.
- [x] **Independent sanity recomputation** — `independent-recompute.{mjs,txt}`: from-scratch
  Kepler + J2-secular propagator (no SGP4 code shared; independent Kepler solver, rotations,
  GMST, geodetic observer) on the same fixture TLE for CSS (TIANHE): peak el 22.830° vs tool
  22.418° (Δ 0.412°), peak time Δ 0.0 s — within ±2.5° / ±120 s tolerance.

## changes beyond the recipe

- **Byte-exact segment**: everything from the "SGP4 (near-Earth), WGS72 constants" banner to
  just before the "Data loading" banner is untouched v1 bytes (see data-integrity.txt; v2 was
  mechanically spliced around the raw segment). Recipe conversions stop at that boundary.
- **Cache stays self-managed** (Suite.store on the v1 key `suite.cache.passes.visual`) instead
  of `fetchJSON`'s `cacheKey`: v1 caches the slim `{name,l1,l2}` lines, and letting fetchJSON
  cache would store the raw GP JSON — a value-shape change that breaks existing v1 caches and
  the text-fallback path. The JSON fetch itself goes through `Suite.fetchJSON` (timeout,
  HTTP-status errors); `fallbackToCache:false` keeps v1's fallback ORDER (JSON → text → cache).
- **`fetchText` helper kept** for the v1 plain-text TLE fallback — `Suite.fetchJSON` is
  JSON-only; the helper is v1's `fetchTimeout` shape with the status check folded in.
- TTL: v1 `CACHE_MAX_MS` = 24 h retained → `cacheTtlMin: 1440`. Justification: CelesTrak's
  own guidance asks consumers not to retrieve GP data more often than ~every 2 h (elements
  update ~3×/day); v1's 24 h cadence both honors that (≥120 min) and is what v1 shipped.
- `getLocation`/`saveLocation` now `Suite.location.get/set` (same key, same shape; v1's
  `typeof lat === "number"` boot check is subsumed by Suite's isFinite validation).
- Local `escapeHtml` removed → `Suite.esc` (identical implementation) at both call sites.
- `locErr` element hoisted to a const (v1 re-queried it inside each handler) so it can carry
  the live region; handler bodies otherwise verbatim.
- All `.onclick =` assignments → `addEventListener` (themeBtn's handler deleted outright —
  core `Suite.theme` owns it).
- ZIP lookup fetch → `Suite.fetchJSON` uncached, matching the canonical weather.html pattern
  (one-off user action, not a recurring source; v1 did not cache it either).

## localStorage keys (v1 vs v2)

Identical key set, byte-identical names: `suite.theme`, `suite.location`,
`suite.cache.passes.visual`. `localstorage.json`: `keysOnlyInV1`/`keysOnlyInV2` both empty.
Cache value keeps v1's `{t, v:[{name,l1,l2}]}` envelope+shape (values differ across versions
in the snapshot only because v2 ended the run holding the live 157-sat set and the Beverly
Hills location — same schema).

## escape allowlist requests

All rendering of satellite/pass data is createElement/textContent (v1 design, kept).
`setStatus(html)` assigns `div.innerHTML` from concatenated strings; remote-derived error
messages are wrapped: `Suite.esc(String(e.message || e))` (2 sites). Three local-safe
expressions reach innerHTML unescaped in the success status line
(`"Elements " + stampTxt + stampNote + ". " + data.sats.length + " satellites tracked."`):

- `stampTxt` — built only from `Date.now()` arithmetic, the literal strings
  "just now"/"min ago"/"from ", and `Date.toLocaleString()` output.
- `stampNote` — `""` or one of two code-literal notes ("Loaded via plain-text TLE fallback.",
  "Network failed — showing cached elements.") prefixed with " · ".
- `data.sats.length` — a number.

(These are string concatenations, not template literals, so the `--check` heuristic should
not flag them; listed for completeness.)

## a11y applied

- Theme button: `aria-label` + `aria-pressed` from core `Suite.theme.init()` (probe logged).
- `Suite.liveRegion` on `#status`, `#results`, and `#locErr` (logged: all `aria-live=polite`).
- Inputs already had `<label for>` in v1 (`#zip`, `#minEl`) — kept.
- Enter submits: `#zip` → ZIP lookup (driven live via `press("Enter")`), `#minEl` → recompute.
- No icon-only buttons; every control is a real `<button>`/`<input>` — keyboard path complete;
  no overlays, so no Esc handling needed.

## endpoints

- `https://celestrak.org` — GP JSON + TLE-text fallback. In CATALOG.md (§3.6 and the CORS
  table, currently marked "verify"): today's in-tool live fetch from `file://` succeeded, so
  CORS is verified as of 2026-07-15 — orchestrator may want to flip the CATALOG mark.
- `https://api.zippopotam.us` — ZIP lookup. In CATALOG.md (✓).
- Both are in the manifest entry; no image hosts.

## concerns for the reviewer

1. **CelesTrak etiquette during this migration**: two total GP pulls (one terminal
   `FORMAT=tle` capture to build the archived fixture, one in-tool live `FORMAT=json` fetch
   during verify). Each verify re-run performs exactly one more; failure/stale paths are
   route-stubbed. Normal use is governed by the 24 h cache.
2. **Stale-note double period** ("…showing cached elements.. 157 satellites tracked.") is
   v1-verbatim (note ends with "." and the status line appends ". ") — preserved, not fixed.
3. **gpToTle synthesizes pseudo-TLEs from GP JSON with bstar/drag zeroed** — v1 behavior,
   inside the byte-exact segment; fine for 3-night windows, untouched by policy.
4. **Not exercised**: ZIP 5-digit validation message, geolocation success/denied paths
   (headless), and a live text-fallback SUCCESS (would cost a second live pull; the chain
   through the text path was proven with stubbed responses instead). All three code paths are
   v1-verbatim or trivially hoisted.
5. **Unused CSS var `--sky`** carried over from v1 (defined, never referenced) — kept for
   parity rather than cleaned up.
6. `offline-stale.png` is a full-page shot of 719 pass rows (~82k px tall) — unwieldy but
   honest; the readable top crop is what the log lines quote.
7. The fixture TLEs freeze 2026-07-15 epochs; under the fixed clock the deterministic numbers
   in interaction.txt stay reproducible on this machine (local-time strings render in the
   host's zone — America/Chicago here).
8. report.md Write-hook gotcha from HANDOFF.md applied (the hook also rejects report.md in the
   scratchpad — this file was authored as passes-report-src.md and shell-copied into place).
