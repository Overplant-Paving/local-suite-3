# fedregister.html migration report

Harness: `node verify-tool.mjs fedregister` — exit 0 (run 2026-07-15; a first run was repeated
once only because an assertion in the interaction module compared the badge's CSS-uppercased
`innerText` against mixed case — a test bug, no tool change between runs).

## v1 feature walk-through

Every v1 feature, verified against the migrated tool (evidence: `interaction.txt` line numbers,
screenshots in this directory):

- [x] **Boot loads today's issue; date input value + max = today** — line 1:
  `date input on boot: 2026-07-15 (max=2026-07-15)`; `todayISO()` verbatim from v1.
- [x] **Live fetch of documents.json for the publication date** (per_page=1000, order=newest,
  same 7-field list, same URL-encoded `conditions[publication_date][is]` construction as v1) —
  line 2: 91 documents landed in `suite.cache.fedregister.2026-07-15`; line 3 sample:
  [Presidential Document] "Adjusting Imports of Commercial Aircraft, Jet Engines, and Aircraft
  and Engine Parts Into the United States" — Executive Office of the President.
- [x] **Stats row (documents / rules / proposed / notices / presidential)** — lines 4–8:
  91 / 8 / 6 / 76 / 1, matching the 91 rendered cards (line 10). `renderStats` verbatim.
- [x] **Data stamp ("data from <time>")** — line 9: `data from Jul 15, 3:25 PM`; `fmtTime`
  verbatim.
- [x] **Document cards: type badge, linked title (target=_blank rel=noopener), agencies line,
  abstract** — lines 11–12 log the first card's badge, title, live federalregister.gov href, and
  agency line; DOM-built with `textContent` exactly as v1 (abstract renders when present — v1
  conditional kept).
- [x] **Type pills (All types / Rules / Proposed / Notices / Presidential) with .on state** —
  line 13; clicking "Rules" filtered 91 -> 8 and every visible badge was RULE (lines 14–15);
  "All types" restored 91 (line 16). `typeInfo` mapping (incl. the OTHER fallback) verbatim.
- [x] **Agency filter (collapsible details, chips sorted by count desc then name, "Name · n"
  labels, header count)** — line 17: 37 chips, header "(37)"; clicking "Interior Department · 27"
  filtered to exactly 27 docs (lines 18–19); toggling off restored 91 (line 20). Multi-select
  `Set` semantics and count/sort logic verbatim.
- [x] **Combined type + agency filtering** — line 21: Notices ∩ Interior Department = 25 docs.
- [x] **"No documents match the current filters" empty state** — code path verbatim; the live
  data never produced an empty intersection during the run (line 21 confirms the card was not
  needed), verified by code inspection.
- [x] **"Nothing published" (weekend/holiday) state** — message verbatim from v1; not driven
  live (today is a business day and hitting a second date live would be a wasted request);
  code inspection.
- [x] **Cache-first for already-fetched dates** — `suite.cache.fedregister.<date>` `{t, v}`
  envelope byte-compatible with v1 (see localStorage section); a cached past date is served
  with no network hit exactly as v1 (`date < todayISO()` branch); exercised offline at
  lines 22 and 25.
- [x] **Network-failure fallback to cache** — offline reload rendered all 91 cached docs, not a
  blank page (line 22), stamped `offline — data from Jul 14, 3:25 PM` (line 23; the Jul 14 time
  is the harness-aged envelope, see concerns). Screenshot: `offline-stale.png`.
- [x] **Network-failure with no cache -> error card with Retry (force reload)** — offline date
  change to uncached 2026-07-14 produced "Couldn't reach the Federal Register" with the Retry
  button (line 24); `load(date, {force:true})` wiring kept.
- [x] **Date change resets the type filter to ALL and loads that date** — exercised at
  lines 24–25 (offline, so no extra live fetch); handler logic verbatim.
- [x] **Loading… card while an uncached date fetches** — `msgCard("Loading…", ...)` verbatim;
  visible in the interaction flow before first render.
- [x] **Theme toggle** — line 26: light -> dark, `aria-pressed=true`, now via
  `Suite.theme.init()`.

Visual parity: `v1-light.png` vs `v2-light.png` and `v1-dark.png` vs `v2-dark.png` are
**byte-identical PNGs** (SHA256 4AB655EE… light pair, 98B8DBC1… dark pair) — pixel-perfect in
both themes against the same live dataset.

## changes beyond the recipe

- **Policy-mandated TTL for today's date (manifest `cacheTtlMin: 60`).** v1 cached every date
  forever ("serve cache and skip network if present") — including *today*, so a morning visit
  froze the day's list for the rest of the day (and an early-morning visit before the ~6 am ET
  publication could freeze an empty list). v2 keeps the infinite cache for **past** dates (a
  published issue is immutable — that v1 semantic is correct and preserved) but refreshes
  **today's** date once the envelope is older than 60 minutes. 60 min is the good-citizen
  choice for a source that publishes once each business day but whose current-day table of
  contents can still gain documents during the morning: fresher than the 1440-min daily-stats
  class default, far below any rate-limit concern (at most ~1 request/hour/user).
- **Fetch via `Suite.fetchJSON`, cache envelope kept tool-managed.** The network request goes
  through `Suite.fetchJSON(url, {accept})`; the `{t, v: docsArray}` envelope is written via
  `Suite.store` under the v1 key `suite.cache.fedregister.<date>`. `fetchJSON`'s built-in
  `cacheKey` would store the *entire API response object* (count/description/results), which
  would break shape compatibility with v1-written caches (v1 stores only the results array) —
  same manual-envelope precedent as zip.html's 404-semantics cache. v1's per-file
  `fetchJSON`/AbortController helper is deleted; timeout behavior now comes from core.
- **Stale data is labeled (Batch B addendum).** When the fetch fails and the cache serves, the
  stamp reads `offline — data from <time>` instead of v1's unlabeled `data from <time>` —
  v1's own stamp language extended with the "offline —" prefix (weather.html's pattern) so
  stale data is never presented as fresh. Fresh and cache-served-fresh renders keep the exact
  v1 stamp text.
- **Agency chips are now real `<button type="button">` elements** (v1: `<span onclick>` —
  no keyboard path at all). CSS adds `font: inherit` so the buttons render identically to the
  v1 spans (verified by the byte-identical screenshots and the clean style diff).
- Everything else (state machine, `typeInfo`, `render`, `renderStats`, `buildAgencyChips`
  sort, `msgCard`, URL construction, all user-facing strings) is line-for-line v1.

## localStorage keys

From `localstorage.json` (`keysOnlyInV1: []`, `keysOnlyInV2: []`):

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via core) |
| `suite.cache.fedregister.<date>` | yes (`{t, v: docsArray}` self-rolled) | yes (same key, same `{t, v: docsArray}` shape via `Suite.store`) |

The cached values are identical in content (both truncate at the same 106424-char length with
the same leading bytes). No other keys are read or written; no legacy keys exist for this tool.

## escape allowlist requests

**None.** v1 built every remote-data node with `createElement`/`textContent` and v2 preserves
that exactly — there is no template-literal interpolation into `innerHTML` anywhere in the
tool (clearing is done with `textContent = ""`). Remote titles/agencies/abstracts/hrefs all
flow through `textContent`/property assignment, which is inherently escaped.

## a11y applied

- `Suite.liveRegion()` on `#list`, `#stats`, and `#stamp` — document results, counts, and
  data-freshness/offline status are announced after fetches and filter changes.
- Agency chips converted from click-only `<span>`s to real `<button type="button">`s —
  keyboard-operable (Tab + Enter/Space native) with `aria-pressed` reflecting the toggle state
  (verified true/false at interaction.txt lines 18, 20).
- Type pills (already `<button>`s in v1) given `aria-pressed` for the selected state
  (line 13: `aria-pressed(on)=true`).
- Theme button `aria-label` + `aria-pressed` via core (line 26).
- Date input is wrapped in its visible `<label class="field">` (implicit association, kept
  from v1); `<details>/<summary>` agency bar is natively keyboard-accessible.
- No icon-only buttons, no overlays (nothing for Esc to close), no text-entry+button pair
  (the date input fires on `change`).

## endpoints

- `https://www.federalregister.gov` — the only fetched host (one URL:
  `/api/v1/documents.json` with publication-date condition + field list). Listed in
  `manifest-entry.json` `endpoints`; appears in CATALOG.md §4.1 line 187 (full URL with the
  `www.` host) and in the CORS table line 521 (keyless, CORS ✓). No image hosts — document
  links are plain `<a href>` link-outs, so `endpoints` drives `connect-src` only.
- Manifest sanity: `cacheTtlMin: 60` matches the tool's `TTL = 60*60*1000`; `storage` matches
  the key table above (`suite.cache.fedregister.*` wildcard covers the per-date keys).

## concerns for the reviewer

- **Behavioral delta on today's date (intentional, policy-mandated):** v1 never refetched a
  date once cached, including today; v2 refetches today after 60 min. A v1 user's within-the-
  hour experience is unchanged; across hours they now see the day's late-added documents. Past
  dates behave exactly as v1 (cache is final). Flagging because "no behavior removed" reviewers
  should see it called out — rendering is otherwise identical.
- **Stale stamp wording is new** (`offline — data from <time>` on the failure path). v1 showed
  the same stamp for fresh and stale. Addendum-mandated; the non-stale wording is untouched.
- The `t` in v2's `localstorage.json` cache envelope is ~24 h older than v1's — the harness
  backdates the envelope to drive the offline test *before* the snapshot is taken; the fresh
  stamp at interaction.txt line 9 shows the true fetch time. Same artifact as the quakes run.
- The three `net::ERR_FAILED` console errors in interaction.txt are the deliberately
  route-aborted fetches of the offline segment; the harness filters these (exit 0).
- **Full-page screenshots exceed Chromium's 16384-px capture limit** (page is ~19300 px with
  91 cards), so the bottom ~2900 px of every PNG shows wrapped/repeated content — a known
  Playwright/Chromium capture artifact, symmetric across v1 and v2 (the pairs are
  byte-identical, so parity is unaffected; the artifact is in the camera, not the page).
- Computed-style diff: the only differing value across all 12 selectors × 2 themes is the
  pre-approved `-webkit-font-smoothing` (core `antialiased` vs v1 `auto`). Zero geometry,
  color, or layout deltas.
- Dynamic elements (`.pill`, `.achip`, `.doc`, `.card-msg`) were deliberately left out of the
  style-diff selector list because their presence at the harness's fixed 700-ms capture point
  depends on live network timing; their parity is instead proven by the byte-identical
  full-page screenshots (which include all of them, rendered).
- Live-run counts (91 docs, 37 agencies, 8/6/76/1 split) are of course date-specific; the
  numbers cross-check internally (stats sum, chip count = filtered count, pill filter = badge
  count).

## Phase 4 a11y audit (2026-07-16)

Re-verification of the QUALITY.md §2 checklist, executed against the running tool from
`file://` with `tests/phase4-a11y-net.mjs` — all network route-fulfilled from shape-matched
payloads behind a catch-all abort (zero live requests during the audit). Machine log:
`phase4-a11y.json` in this directory. Verdict: **fixed**.

| checklist item | verdict | evidence |
|---|---|---|
| 1. icon-only controls have accessible names | pass | none present |
| 2. async result regions carry aria-live | pass | `#list` -> `aria-live=polite`; `#stats` -> `aria-live=polite`; `#stamp` -> `aria-live=polite` |
| 3. keyboard path for every mouse path | pass | primary flow driven keyboard-only (log below); no positive tabindex; no traps |
| 4. inputs labelled | pass | `input#dateInput[date]` (wrapped label) |
| 5. contrast AA, both palettes | fixed | measured table below; remaining failures are suite-palette pairs (flagged, not fixable locally) |
| 6. visible focus indicator | pass | Tab-focus on `button.achip`: `solid 2px rgb(47, 111, 106)` vs blurred `none 3px rgb(107, 114, 128)` |

### Keyboard-only drive of the primary feature (page.keyboard only)

- KEYBOARD: Enter on Rules pill -> filtered to 2 docs; aria-pressed=true
- KEYBOARD: date typed into date input -> change -> reloaded for 2026-07-14
- KEYBOARD: agency chip toggled ON; aria-pressed=true; visible docs=2

### Contrast measurements (computed from getComputedStyle, ancestor-composited backgrounds)

Light palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| .stat b | `#2f6f6a` | `#f5f3ee` | 5.26 | 3 | pass |
| .stat span | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| .pill:not(.on) | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .pill.on | `#ffffff` | `#2f6f6a` | 5.83 | 4.5 | pass |
| .badge.t-rule | `#ffffff` | `#9a6522` | 4.93 | 4.5 | pass |
| .badge.t-prorule | `#ffffff` | `#2f6f6a` | 5.83 | 4.5 | pass |
| .badge.t-notice (probe) | `#ffffff` | `#6b7280` | 4.83 | 4.5 | pass |
| .badge.t-presdoc (probe) | `#ffffff` | `#8a4b8a` | 6.08 | 4.5 | pass |
| .doc .agencies | `#2f6f6a` | `#fffdf9` | 5.74 | 4.5 | pass |
| .doc .abstract | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .achip:not(.on) | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .achip.on | `#2f6f6a` | `#e3efed` | 4.95 | 4.5 | pass |
| #stamp | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |

Dark palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| .stat b | `#6fb5ae` | `#15171b` | 7.60 | 3 | pass |
| .stat span | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| .pill:not(.on) | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .pill.on | `#15171b` | `#6fb5ae` | 7.60 | 4.5 | pass |
| .badge.t-rule | `#15171b` | `#d09a53` | 7.20 | 4.5 | pass |
| .badge.t-prorule | `#15171b` | `#6fb5ae` | 7.60 | 4.5 | pass |
| .badge.t-notice (probe) | `#15171b` | `#9aa0a8` | 6.81 | 4.5 | pass |
| .badge.t-presdoc (probe) | `#15171b` | `#c092c0` | 6.93 | 4.5 | pass |
| .doc .agencies | `#6fb5ae` | `#1d2026` | 6.91 | 4.5 | pass |
| .doc .abstract | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .achip:not(.on) | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .achip.on | `#6fb5ae` | `#1b2425` | 6.69 | 4.5 | pass |
| #stamp | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |

### Fixes made (tool-local CSS/vars; no behavior changes beyond the one noted)

- Light `--rule` darkened `#b0752a` -> `#9a6522` (white RULE badge text was 3.87:1; now 4.9:1).
- `--on-accent` var: document-type badges, the active type pill, and the Retry button use dark ink `#15171b` in the dark palette — white on the dark pastel badge fills measured 2.36-2.64:1; now 4.8-7.2:1.
- (harness) interactions/fedregister.mjs: pre-publication-window fallback — the FR publishes ~6 AM ET, so a run before that finds today's issue legitimately empty (API answers count:0, verified live); the module now steps back to the latest populated issue, identically for v1, keeping cache-key parity.

### Suite-wide contrast failures — flagged, NOT fixed locally (core palette)

- Light `--muted` `#6b7280` on `--bg` `#f5f3ee` = **4.36:1** (needs 4.5) — affects: `#stamp`, `.stat span`, `header .tag`.
- Same pair passes in dark (6.8:1). A ~one-step darker light `--muted` (e.g. `#61686f`, 4.9:1 on `--bg`) would clear every instance suite-wide; decision belongs to the orchestrator, not this tool.

### Verification

- `node verify-tool.mjs fedregister` -> exit 0 (live FR fetch for the latest populated issue — 91 docs for 2026-07-15 — pills, agency chips, offline-stale + offline-uncached-date paths green).
