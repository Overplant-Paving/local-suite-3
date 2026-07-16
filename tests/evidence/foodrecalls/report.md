# foodrecalls.html migration report (Batch B)

## v1 feature walk-through

- [x] **State picker populated from the 52-entry STATES table** — options built with
  createElement exactly as v1; live run shows the select rendered and driven (interaction.txt
  lines 2, 18; screenshots).
- [x] **State seeded from `suite.state`, else derived from `suite.location` label, else CA** —
  live-verified: `suite.state` removed, `suite.location` seeded with
  `{label:"Los Angeles, CA"}` -> select derived `CA` and `suite.state` written back as bare `"CA"`
  (interaction.txt lines 1-3). The regex (`/,\s*([A-Z]{2})\b/`) and NAME_BY_ABBR guard are
  byte-identical.
- [x] **Live openFDA enforcement fetch (state OR nationwide, newest first, limit 50)** — URL
  construction byte-identical to v1 (same `encodeURIComponent(name)`, same
  `+OR+distribution_pattern:%22nationwide%22`, same sort/limit). Live: 50 recalls for California,
  sample card = Class I, "Initiated Jun 15, 2026", product "FIRST STREET Dark Chocolate
  Raisins...", reason "Undeclared peanuts." (interaction.txt lines 4-9).
- [x] **Class color coding + badges (c1/c2/c3)** — Class I badge and left-border color visible in
  all screenshots; `clsNum` byte-identical.
- [x] **Class filter buttons (All / I / II / III)** — live: Class I filter -> "7 of 50 recent
  recalls affecting California (Class I)", 7 cards; back to All -> 50 cards (interaction.txt
  lines 15-17). Summary "(Class I/II/III)" suffix logic unchanged.
- [x] **Summary line** — "50 of 50 recent recalls affecting California" (line 4); singular/plural
  and filtered variants unchanged.
- [x] **Recall cards: badge, initiated date, product description (300-char cap), Reason
  (400-char cap), firm / status / nationwide kv line** — all rendered live (lines 6-9,
  screenshots); the createElement/textContent construction is byte-identical to v1.
- [x] **"More detail" expandable (quantity, distribution, codes, firm location,
  voluntary/mandated, recall #)** — first card expanded live via its summary: "Quantity: 29 cases
  ... Distribution: ... Codes: Lot: 260562 BB: 022527 - Firm location: Ontario" (line 11).
- [x] **`fmtFDADate` / `titleCase` / `ago` formatting** — byte-identical; observed live
  ("Initiated Jun 15, 2026", "data just now", "Firm location: Ontario").
- [x] **State change refetches and persists** — select -> NY: `suite.state="NY"`, fresh live
  fetch, 50 NY cards (lines 18-20).
- [x] **Cache per state (`suite.cache.foodrecalls.<ST>`)** — envelope written after live load
  (line 13); CA and NY keys present in both v1 and v2 snapshots (localstorage.json).
- [x] **Cached-first render + offline fallback** — cache aged 24 h + network blocked -> full
  50-card NY board still renders with stamp "Showing up to 50 most recent · offline — data
  24 hr ago (cached)" (lines 21-24, offline-stale.png). Not a blank page; stale data labeled
  with its age.
- [x] **404-means-no-recalls (`{__empty:true}`)** — preserved: `fallbackToCache:false` +
  explicit `HTTP 404` catch renders the v1 "No recent food recalls found... That's good news"
  state and caches the empty list, exactly as v1 did. Not reachable live (every state matches
  nationwide recalls — CA and NY both returned 50); verified by inspection, and
  `Suite.fetchJSON`'s 404-breaks-retry behavior guarantees the error string. Same approach used
  on zip.html.
- [x] **Error card ("Couldn't load recalls.") when no cache** — code path preserved verbatim
  (static innerHTML + createTextNode for the message); reachable only with no cache — the offline
  run had cache, so verified by inspection.
- [x] **Empty-class message ("No recalls in this class...")** — logic unchanged; CA had recalls
  in every class this run, so verified by inspection (same `rows.length` branch as v1).
- [x] **Legend + footer text** — byte-identical markup (screenshots).
- [x] **Theme toggle** — light -> dark, `aria-pressed=true` (interaction.txt line 26;
  core-provided).

## changes beyond the recipe

- **TTL added (policy-mandated, API-AND-RELAY.md §2)**: v1 fetched on every load and used the
  cache only as a render-first/fallback. v2 declares `ttl = 720 min`, so reloads within 12 h
  serve the cache without a request; the stamp then honestly shows "data X ago (cached)" (v1's
  own cached-render language). Rendering is otherwise identical.
- **`fallbackToCache: false` with manual fallback handling**: `Suite.fetchJSON`'s automatic
  stale-fallback would make an openFDA 404 ("no matches") indistinguishable from a network
  failure and could serve old recalls when the truthful answer is "none". The catch block
  distinguishes: `HTTP 404` -> fresh empty answer (cached, like v1's `{__empty:true}`); other
  failures with cache -> the already-rendered cached board relabeled "offline — data X ago
  (cached)"; no cache -> v1's error card.
- **Cache payload shape**: `Suite.fetchJSON` stores the full openFDA response object where v1
  stored the bare `results` array. `readCache` accepts both shapes, so a v1 user's existing
  cache still renders; key names are byte-identical (`suite.cache.foodrecalls.<ST>`).
- **Loading message built with `el()`** instead of v1's string-concat `innerHTML` — same
  rendered output, avoids an interpolated-innerHTML site.
- **Stale stamp wording**: v1 had no explicit offline state (it silently kept the cached render
  with "(cached)"); v2 renders "offline — data X ago (cached)" per the Batch B stale-labeling
  requirement, extending v1's own stamp language minimally.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare `"light"/"dark"` | identical (core) |
| `suite.state` | bare `"CA"` | identical bare string (`Suite.store` writes strings bare) |
| `suite.location` | read-only (label -> state derivation) | identical read, same tolerance |
| `suite.cache.foodrecalls.<ST>` | `{t, v: results[]}` | `{t, v: response-object}` — same key name, reader accepts both shapes |

Parity run: `keysOnlyInV1: []`, `keysOnlyInV2: []` (localstorage.json); both versions hold
`suite.state="NY"`, `suite.location`, and the CA + NY cache keys.

## escape allowlist requests

none — every remote value is rendered via `createElement`/`textContent` (v1 was already
disciplined here and that construction is kept). The only `innerHTML` write is the static
literal `"<b>Couldn't load recalls.</b> "` (no interpolation; the error message itself is
appended as a text node). Live proof: sample product description renders with zero child
elements (interaction.txt line 10).

## a11y applied

- `#filters` group -> `role="group"` + `aria-label="Filter by recall class"`; filter buttons are
  toggles -> `aria-pressed` added to markup and kept in sync on click (verified live:
  `["all=false","1=true","2=false","3=false"]`, interaction.txt line 16).
- `#summary` and `#list` -> `Suite.liveRegion()` (fetch results announced).
- State select already inside a wrapping `<label>State: ...</label>` (v1) — kept.
- Recall detail expansion is native `<details>/<summary>` (keyboard path free); no overlays, so
  no Esc handling needed; no text-entry+button pair exists (select-only input).
- Theme button labeling/`aria-pressed` from core `Suite.theme.init()`.

## endpoints

- `https://api.fda.gov` — `/food/enforcement.json` (live-verified twice this run: CA and NY, one
  request each). Present in CATALOG.md ("openFDA | api.fda.gov | none (1k/day)" in the CORS
  table, plus §6.3 Food Recall Alerts) — no CATALOG update needed.
- `cacheTtlMin: 720` — justification: openFDA's enforcement dataset is refreshed roughly weekly
  (it is not a minute-fresh feed), so even the daily-stats class TTL (1440) would never miss a
  same-day publication in practice. 720 (12 h) was chosen from the given 720-1440 range because
  this is safety-relevant data: it halves the worst-case latency for a newly published Class I
  recall at a cost of at most 2 requests/day per state viewed — negligible against the 1k/day
  courtesy limit.

## concerns for the reviewer

- **The 404/no-matches branch was not observed live** — CA and NY both returned full result sets
  (as will any state, since nationwide recalls always match). The branch is small, explicit, and
  mirrors the zip.html pattern, but it rests on `Suite.fetchJSON` surfacing exactly `"HTTP 404"`,
  which is core-owned; if core ever rewords that error, this tool would degrade to treating 404
  as offline (stale render) rather than empty. A shared error-code convention might be worth
  considering when a second 404-semantics tool appears.
- **Error card and empty-class message verified by inspection only** (unreachable live this
  run); both are byte-identical v1 code paths.
- **Cache value shape changed** (full response object vs. bare array) — same alerts.html
  situation: v1->v2 users lose nothing; a v2->v1 rollback would render zero cached recalls until
  v1's next fetch (immediate, since v1 always fetches). Judged acceptable.
- The single `console.error: Failed to load resource: net::ERR_FAILED` in interaction.txt is the
  deliberately blocked fetch from the stale-path test (harness-exempt pattern); the console is
  otherwise clean.
- Screenshots were taken with live data on both versions minutes apart, so v1/v2 show the same
  50 CA recalls; page heights are pixel-identical (10637 px) in both themes.

## Phase 4 a11y audit (2026-07-16)

Re-verification of the QUALITY.md §2 checklist, executed against the running tool from
`file://` with `tests/phase4-a11y-net.mjs` — all network route-fulfilled from shape-matched
payloads behind a catch-all abort (zero live requests during the audit). Machine log:
`phase4-a11y.json` in this directory. Verdict: **fixed**.

| checklist item | verdict | evidence |
|---|---|---|
| 1. icon-only controls have accessible names | pass | none present |
| 2. async result regions carry aria-live | pass | `#summary` -> `aria-live=polite`; `#list` -> `aria-live=polite` |
| 3. keyboard path for every mouse path | pass | primary flow driven keyboard-only (log below); no positive tabindex; no traps |
| 4. inputs labelled | pass | `select#stateSel[select-one]` (wrapped label) |
| 5. contrast AA, both palettes | fixed | measured table below; remaining failures are suite-palette pairs (flagged, not fixable locally) |
| 6. visible focus indicator | pass | Tab-focus on `button.on`: `solid 2px rgb(47, 111, 106)` vs blurred `none 3px rgb(255, 255, 255)` |

### Keyboard-only drive of the primary feature (page.keyboard only)

- KEYBOARD: Class I filter via Enter -> 1 rows; aria-pressed=true
- KEYBOARD: More detail summary Enter -> open=true
- KEYBOARD: state ArrowDown -> CO -> reloaded

### Contrast measurements (computed from getComputedStyle, ancestor-composited backgrounds)

Light palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| #summary | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| .badge.c1 | `#ad3a20` | `#f6e2dc` | 4.95 | 4.5 | pass |
| .badge.c2 | `#955d12` | `#f4ead6` | 4.57 | 4.5 | pass |
| .badge.c3 | `#565e66` | `#eceae4` | 5.47 | 4.5 | pass |
| .r .date | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .r .desc | `#23282e` | `#fffdf9` | 14.61 | 4.5 | pass |
| .r .reason b | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .r .kv | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .r details summary | `#2f6f6a` | `#fffdf9` | 5.74 | 4.5 | pass |
| .filters button:not(.on) | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .filters button.on | `#ffffff` | `#2f6f6a` | 5.83 | 4.5 | pass |
| .legend | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |

Dark palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| #summary | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| .badge.c1 | `#e0765a` | `#3a231c` | 4.81 | 4.5 | pass |
| .badge.c2 | `#d3a25a` | `#33291a` | 6.17 | 4.5 | pass |
| .badge.c3 | `#9aa0a8` | `#262a31` | 5.47 | 4.5 | pass |
| .r .date | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .r .desc | `#e7e5e0` | `#1d2026` | 12.96 | 4.5 | pass |
| .r .reason b | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .r .kv | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .r details summary | `#6fb5ae` | `#1d2026` | 6.91 | 4.5 | pass |
| .filters button:not(.on) | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .filters button.on | `#15171b` | `#6fb5ae` | 7.60 | 4.5 | pass |
| .legend | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |

### Fixes made (tool-local CSS/vars; no behavior changes beyond the one noted)

- Light class colors darkened — `--c1` `#c0492d` -> `#ad3a20`, `--c2` `#b0752a` -> `#955d12`, `--c3` `#6b7280` -> `#565e66`: badge text on the class-soft washes measured 3.98 / 3.24 / 4.02 :1; now 4.9 / 4.6 / 5.5 :1 (card border-left accents darken with them; still >= 3:1 non-text). Dark untouched (4.8-6.2:1, passed).
- `--on-accent` var: the active filter pill label dark ink in the dark palette (white was 2.36:1; now 7.6:1).

### Suite-wide contrast failures — flagged, NOT fixed locally (core palette)

- Light `--muted` `#6b7280` on `--bg` `#f5f3ee` = **4.36:1** (needs 4.5) — affects: `#summary`, `.legend`, `header .tag`.
- Same pair passes in dark (6.8:1). A ~one-step darker light `--muted` (e.g. `#61686f`, 4.9:1 on `--bg`) would clear every instance suite-wide; decision belongs to the orchestrator, not this tool.

### Verification

- `node verify-tool.mjs foodrecalls` -> exit 0 (live openFDA enforcement, class filters, offline paths green).
