# art.html — migration report (Batch B, cors-open, EA)

Evidence in this directory: `v1-*.png` / `v2-*.png` (both themes), `v2-after-interaction.png`,
`offline-stale.png`, `computed-style-diff.txt`, `interaction.txt`, `localstorage.json`.
Harness run: `node verify-tool.mjs art` — exit 0.

## v1 feature walk-through

- [x] **Boot on the embedded Met set, today's deterministic pick renders** — interaction.txt line 1:
  "Cremorne Gardens, No. 2 / James McNeill Whistler"; the same title re-renders after "Today's pick"
  (deterministic day-hash check logged `true`).
- [x] **Met image loads live from images.metmuseum.org** — logged `{"loaded":true,"naturalWidth":600}`;
  visible in `v1/v2-light.png` and `v2-dark.png`.
- [x] **"Another" (random from current pool)** — rendered "The Abduction of Rebecca / Eugène Delacroix"
  with the "From the Met set" label.
- [x] **"Today's pick" returns to the daily work** — logged, title equality asserted against boot.
- [x] **Favorite toggle** — button flips to "★ Favorited", `suite.art.favorites` written
  (`["met:13223"]`), grid shows 1 item, count shows "· 1" (interaction.txt lines 9–10 and
  `v2-after-interaction.png`).
- [x] **Favorites grid: open on click, remove via ✕, broken-thumbnail hiding** — click/keyboard
  open path wired (see a11y); the converted `onerror` listener is proven working in
  `offline-stale.png`: with the network blocked the fav thumbnail is hidden
  (`visibility:hidden`) while its caption remains — exactly v1's fallback behavior.
- [x] **AIC tab: live weekly pool fetch (api.artic.edu)** — one real fetch; pool cache
  `suite.cache.art.pool:2026-w28` written with 100 records; rendered "Tile with Musician and
  Dancer / Iran" (interaction.txt lines 11–13).
- [x] **AIC iiif image loads (www.artic.edu)** — logged `{"loaded":true,"naturalWidth":843}` (see
  concerns re: intermittent headless-only 403).
- [x] **Search (debounced input)** — live search fetch for "sunflowers" rendered
  "Sunflowers, Marché St Germain, Paris / James McNeill Whistler" under the 'Search: "sunflowers"'
  label; the debounce + empty-term restore code path is unchanged from v1.
- [x] **No-image / broken-image states** — v1 message strings preserved verbatim; the AIC variant
  ("the museum's image server declined the request…") observed live in `offline-stale.png`.
- [x] **Error states (AIC unreachable, no search hits)** — v1 message strings preserved verbatim;
  the unreachable path is superseded by the stale-cache card only when a cache exists (below).
- [x] **Stale-cache offline path (Batch B)** — caches back-dated 24 h, all http(s) aborted, reload:
  the Met set renders with zero network; clicking the AIC tab renders the stale pool with the
  label "Offline — cached from Jul 14, 3:35 PM" (interaction.txt lines 18–22, `offline-stale.png`).
- [x] **Theme toggle** — light -> dark, `aria-pressed=true` (harness probe).
- [x] **Embedded Met set survives verbatim** — the `const MET = [...]` line was spliced from the
  v1 file mechanically and verified byte-identical (13 586 chars), preserving the original
  `\uXXXX` escape sequences.

## changes beyond the recipe

- **Policy-mandated caching added to the search request** (API-AND-RELAY.md §2 — v1 did not cache
  searches): `cacheKey: "art.search:" + term.toLowerCase()`, TTL 1440 min. Rendering behavior
  unchanged; on a failed refetch the stale search result renders with an
  "· offline, cached from <time>" suffix on the v1 search label.
- **Stale-state labels** (Batch B requirement; v1 had no stale concept — its cache never expired
  within a week): when `Suite.fetchJSON` serves a stale pool, the postcard label reads
  "Offline — cached from <time>" (daily pick) / "From the Art Institute · offline, cached from
  <time>" (Another). Fresh data renders exactly the v1 labels.
- **Pool cache value shape**: v1 stored the *filtered* pool array under
  `suite.cache.art.pool:<week>`; `Suite.fetchJSON` stores the raw API response under the same key.
  The loader accepts both shapes (`Array.isArray` branch), so an existing v1 cache keeps working
  and the filter is idempotent on pre-filtered arrays. Consequence: v1 reading a v2-written entry
  refetches (its `.v.length` check fails on the object) — harmless, forward-only concern.
- **TTL semantics**: v1 treated any pool cache for the current week as valid forever (~7-day
  effective TTL via the week-keyed name); v2 refreshes after 24 h (`cacheTtlMin: 1440`).
  Justification: the tool's headline feature changes **daily** (day-hash pick), so a daily refetch
  cadence matches the content cadence; the week-keyed name still bounds variety rotation, and at
  most ~7 pool fetches/user/week is comfortably within good-citizen etiquette.
- The v1 `weekKey()`-page rotation, day-hash pick, and all message strings are otherwise unchanged.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via `Suite.store`) |
| `suite.art.favorites` | yes | yes — identical JSON bytes (localstorage.json: same 220-char value both sides) |
| `suite.cache.art.pool:<year>-w<week>` | yes | yes — same key, raw-response value (see above) |
| `suite.cache.art.search:<term>` | — | **v2-only**, the policy-mandated search cache |

Parity verdict: `keysOnlyInV1: []`; `keysOnlyInV2: ["suite.cache.art.search:sunflowers"]` —
explained above.

## escape allowlist requests

All remote strings (titles, artists, dates, mediums, image URLs, search terms) are `Suite.esc()`d
at every interpolation, including attribute contexts (`alt`, `src`). The tool builds HTML with
string concatenation (not template literals), so the `--check` heuristic should produce no flags;
listed here anyway for the EA re-audit:

- `(note || "Artwork of the day")` in `renderWork` — `note` is only ever a local literal or a
  string built at the call site with `esc()` already applied to its remote parts (search term);
  `fmtWhen(t)` output is a locale-formatted timestamp of a local number. Must NOT be re-escaped
  (would double-escape the search label).
- `(isFav ? ' on' : '')`, `(isFav ? '★ Favorited' : '☆ Favorite')` in `renderWork` — local
  boolean ternaries over literals.
- `(w.source === "aic" ? ' (the museum's image server declined…' : '.')` in the image `error`
  listener — ternary over two string literals.
- `[esc(w.date), esc(w.medium)].filter(Boolean).join(" · ")` — every element escaped before join.
- `(w.img ? '<img alt="" loading="lazy" src="' + esc(w.img) + '">' : '<div …>')` in `renderFavs` —
  the remote URL is escaped for the attribute context; the URL itself is either from the embedded
  Met set or constructed locally as `https://www.artic.edu/iiif/2/<image_id>/…` (scheme fixed, no
  `javascript:` risk).

## a11y applied

- `aria-label="Search the Art Institute"` on the `#q` search input (had only a placeholder).
- **Enter in the search box fires the search immediately** (cancels the 500 ms debounce) — the
  text-entry Enter-submits rule; exercised in the harness.
- `Suite.liveRegion` on `#postcard` (async artwork renders) and `#favCount`.
- Icon-only `✕` remove button: `aria-label="Remove from favorites"` (kept v1's `title`).
- **Keyboard path for favorites**: v1 fav cards were click-only `<div>`s — now `role="button"`,
  `tabindex="0"`, Enter/Space opens (verified: `role=button tabindex=0` logged).
- Tabs get `aria-pressed` kept in sync with the `.on` class (initial markup matches v1's initial
  classes); theme button aria comes from core.

## endpoints

- `api.artic.edu` — JSON (pool + search), CORS-open, verified live this run. In CATALOG.md ✓.
- `www.artic.edu` — AIC iiif image host (plain `<img>`, no fetch). **Missing from CATALOG.md** —
  orchestrator, please add (CSP img-src needs it).
- `images.metmuseum.org` — Met image host for the embedded set (plain `<img>`). **Missing from
  CATALOG.md by exact host name** (§7.8 only says "its images load fine") — please add.
- `collectionapi.metmuseum.org` is NOT contacted (v1 never did either — that CORS-blocked API is
  exactly why the embedded ID list exists). Not in endpoints.

## concerns for the reviewer

1. **www.artic.edu intermittently 403s headless Chrome** (bot detection). First harness run: the
   iiif image got `403 text/html` and the tool rendered its v1 "image server declined" fallback;
   the identical URL returned `200 image/jpeg` via curl (any UA) and loaded with
   `naturalWidth=843` in **headed** Chrome; the second (archived) harness run also loaded it fine
   headless. Real-browser users are unaffected, and v1 behaves identically (its error copy even
   anticipates this server). The interaction module (`imageSettled`) tolerates either outcome and
   logs which occurred, so reruns won't fake success. Worth a note if Phase 4 smoke ever flakes here.
2. **v1 tab-state quirk preserved**: v1 marks the "Art Institute (live)" tab `.on` in initial
   markup while booting on the Met set (`source = "met"`), so the highlighted tab doesn't match
   the displayed collection until the first tab click. Preserved for parity (screenshots must
   match); the initial `aria-pressed` values match the visual classes, not `source`. Flagging as
   a candidate v1 bug for the orchestrator to rule on.
3. **Console during harness run**: 4x `net::ERR_FAILED` resource errors — all from the deliberate
   offline phase (aborted image/API requests); the harness classifies these as non-hard. No other
   console output.
4. **Search cache growth**: each distinct settled search term now writes one
   `suite.cache.art.search:<term>` entry (policy-mandated caching). Unbounded across terms in
   principle; entries are ~8 KB. If this bothers Phase 4, a cap/LRU would be a core-level concern,
   not tool-local.
5. The dark-theme computed-style diff in an earlier run showed body/postcard height differences —
   that was a transient Met-image load failure during the screenshot pass (dynamic content), not
   a style regression; the archived run shows only the pre-approved `-webkit-font-smoothing`
   diff in both themes.

## Phase 4 escaping audit (line-by-line)

Audit of `tools/art.html` against the post-fix file (line numbers below are current).
`Suite.esc` escapes `&<>"'`, so it is safe in text nodes and double-quoted attribute values.

### Dynamic-markup site inventory (complete)

| # | Line | Sink | Interpolated data | Provenance | Verdict |
|---|---|---|---|---|---|
| 1 | 137 | `postcard.innerHTML` (no-artwork card) | none | constant | safe |
| 2 | 141–156 | `postcard.innerHTML` (renderWork) | `esc(w.title)` in `alt="…"` and `<h2>` | remote (AIC/Met) or localStorage favorite | esc'd, attr context double-quoted — safe |
| 3 | 141–156 | same | `imgSrc` presence check (markup branch only; value never interpolated) | remote/stored URL | safe — see fix F1 |
| 4 | 146 | same | `(note \|\| "Artwork of the day")` — NOT re-escaped | local literals at 3 call sites; 4th (search) is `'Search: “' + esc(term) + '”'` + `fmtWhen()` (locale-formatted local number, no markup chars) | safe by call-site contract — every `note` caller enumerated: showToday (literal + fmtWhen), another (literal + fmtWhen), aicSearch (esc'd term + fmtWhen), renderFavs openFav (literal). Deliberately unescaped to avoid double-escaping the search label. |
| 5 | 148 | same | `esc(w.artist \|\| "Unknown artist")` | remote/stored | esc'd — safe |
| 6 | 149 | same | `[esc(w.date), esc(w.medium)].filter(Boolean).join(" · ")` | remote/stored | each element esc'd before join — safe |
| 7 | 150 | same | `esc(srcName)` | local ternary over two literals | safe |
| 8 | 154 | same | `(isFav ? ' on' : '')`, `(isFav ? '★ Favorited' : '☆ Favorite')` | local boolean | safe |
| 9 | 161 | `frame.innerHTML` (image error) | ternary over two string literals (`w.source === "aic"` used only as a comparison) | constant | safe |
| 10 | 163 | `img.src = imgSrc` (property) | remote/stored URL (Met constant, AIC `https://www.artic.edu/iiif/2/<image_id>/…`, or favorites read back from localStorage) | **was UNSAFE-adjacent** (no scheme guard; `w.img` round-trips through `suite.art.favorites`) | FIXED — F1 |
| 11 | 221 | `postcard.innerHTML` (searching card) | none | constant | safe |
| 12 | 228 | `postcard.innerHTML` (no-hits card) | `esc(term)` | user input | esc'd — safe |
| 13 | 231 (renderWork note arg) | via site 4 | `esc(term)` + `fmtWhen(r.t)` | user input / local number | esc'd — safe |
| 14 | 234, 258, 261 | `postcard.innerHTML` (error/loading cards) | none | constants | safe |
| 15 | 247–248 | `setAttribute("aria-pressed", …)` | `String(boolean)` | local | safe sink (no HTML parsing) |
| 16 | 293, 300 | `textContent =` (fav button, count) | local | safe sink |
| 17 | 301, 303 | `grid.innerHTML = ""` | none | constant | safe |
| 18 | 308–310 | `el.innerHTML` (renderFavs card) | `esc(favImg)` in `src="…"`; `esc(w.title)`, `esc(w.artist \|\| "")` | localStorage favorites (originally remote AIC/Met data — attacker-influenceable via tampered/legacy storage) | esc'd for the double-quoted attr + text contexts; URL **was scheme-unguarded** | FIXED — F1 |
| 19 | 319 | `setAttribute("aria-label", "Show favorite: " + (w.title \|\| "artwork"))` | stored title | safe sink (attribute set via API, not parsed as HTML) |

No `outerHTML`, `insertAdjacentHTML`, `document.write`, `href`, `style`, or data-built `title`
attributes exist in the file. The tool uses string concatenation exclusively (no template
literals), matching the migration report.

### Fixes

- **F1 — http(s) scheme guard on image URLs (the only fix needed).** New `imgURL(u)` helper
  (line 102): a URL reaches an `<img src>` only if it is a string matching `/^https?:\/\//i`;
  anything else renders the existing no-image state. Applied at both sinks: `renderWork`
  (lines 140/142/159/163 — markup branch + property assignment) and `renderFavs` (lines
  307–309 — attribute interpolation, still `esc()`d). Rationale: `w.img` is remote-derived
  AND round-trips through `suite.art.favorites` in localStorage, so a tampered or legacy
  entry could carry a `javascript:` (or other non-http) URL to the src sinks. All legitimate
  URLs (embedded Met set, constructed AIC iiif) are https, so behavior is unchanged for real
  data — verified by the harness (live Met + AIC images still load, `naturalWidth` 599/843).
- No other site required changes: every remote/user string was already `Suite.esc()`d at
  every interpolation, including both attribute contexts, exactly as the migration report
  claimed.

### Adversarial probe (tests/interactions/art.mjs, appended to `interact()`)

Isolated browser context; `api.artic.edu` pool + search route-fulfilled with a hostile record
arming `window.__pwned` via every interpolated field (`title` `<img onerror>`, `artist_display`
`"><script>`, `date_display` attr-breakout, `medium_display` `<svg onload>`, `image_id`
`"><img onerror>`); localStorage pre-seeded with a tampered favorite whose `img` is a
`javascript:` URL; a hostile user-typed search term exercises both `esc(term)` sites; image
hosts fulfilled with a 1x1 png. The probe **throws** (failing the harness) on any `__pwned`
bit, any injected node/attribute, or if the payloads fail to render as literal text.

Evidence (interaction.txt lines 23–33, `escaping-probe.png`):

- `javascript:` favorite: `img rendered=false (scheme guard) placeholder=true` — the tampered
  URL never reaches a src; caption still renders.
- Hostile pool record: `pwned=undefined scripts=0 svgs=0 injected-imgs=0 on*-attrs=0`; title,
  artist, and meta render the payloads as literal text; the hostile `image_id` stays inside
  the https iiif path (`https://www.artic.edu/iiif/2/"><img …/full/843,/0/default.jpg` — inert
  as a URL, esc'd where written to markup).
- Hostile favorite in grid: `scripts=0 injected-imgs=0 on*-attrs=0 img schemes=["https"]`,
  captions literal.
- Hostile search term: literal in the `Search: "…"` label, `injected-imgs=0`; hostile term in
  the no-hits message renders literally, `scripts=0`.
- Verdict line: `escaping probe verdict: INERT — __pwned=undefined, injected nodes/attrs=0,
  probe-context console errors=(none)`.

### Harness

`node verify-tool.mjs art` — exit 0 (this run, post-fix, probe included). Console: the 4
expected `net::ERR_FAILED` from the deliberate offline phase only (non-hard). The www.artic.edu
headless-403 concern did not recur this run (iiif image loaded, `naturalWidth=843`).

### Allowlist status

`tests/escape-allowlist.json` contains **no entries for art.html** (the concatenation style
never tripped the `--check` heuristic), and the audit adds none. The five expressions
pre-declared in "escape allowlist requests" above were each re-verified line-by-line: all
remain safe as reasoned, with one hardening — the `renderFavs` image-URL claim ("scheme fixed,
no `javascript:` risk") was true for freshly constructed URLs but not for URLs read back from
tampered/legacy localStorage; F1 closes that gap. No previously-allowlisted expression is
unsafe. No allowlist revisions needed.

## Phase 4 a11y audit

Re-verified 2026-07-16 against QUALITY.md §2 (Phase 4 audit addendum). Full runtime log in
`a11y-phase4.txt` (harness: `tests/a11y-phase4-batch.mjs` — api.artic.edu and both image hosts
route-fulfilled; www.artic.edu 403s headless automation intermittently, the documented
environment failure, so the audit made zero live artic requests).

| # | Checklist item | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | icon-only controls named | pass | the favorites ✕ has `aria-label="Remove from favorites"`; fav tiles have `aria-label="Show favorite: <title>"` |
| 2 | aria-live on async containers | pass | runtime `aria-live=polite` on #postcard and #favCount |
| 3 | keyboard path | pass | favorite, fav-tile open (`role=button` `tabindex=0` + Enter/Space), AIC tab, and search all driven keyboard-only (Enter fires search); no positive tabindex; no overlays |
| 4 | input labels | pass | #q has `aria-label="Search the Art Institute"` |
| 5 | contrast, both palettes | fixed | see below — 3 tool-local failures fixed, 1 suite flag |
| 6 | focus visibility | pass | 8/8 tabbed elements show the core 2px accent outline |

Contrast measurements:
- FIXED: `.tab.on` and `button.act.primary` were `#fff` on `var(--accent)` — **2.36:1 dark**.
  Now `color: var(--bg)` (5.26:1 light / 7.60:1 dark).
- FIXED: `button.act.fav.on` was hardcoded `#c0552d` in both palettes (4.51:1 light, **3.55:1
  dark**) — now a 3-layer `--fav-on` accent (#c0552d light / #e0766a dark 5.41:1).
- SUITE FLAG (not fixed locally): `--muted` on `--bg` = **4.36:1 light** (footer). Dark passes.
- Measured ok: the fav-tile ✕ (white on rgba(0,0,0,.55) scrim over an image) is 4.82:1 over the
  scan's rendered tile and ≥4.75:1 even over a worst-case pure-white image.

Observation (v1-parity, not changed): on boot the tool renders the Met daily pick while the
markup's initial "Art Institute (live)" tab still carries `.on`/`aria-pressed="true"` (paintTabs
only runs on click) — the mismatch affects sighted and SR users identically and is inherited
from the v1 markup; flagged for a possible cosmetic follow-up, not an audit failure.

Fixes made: the CSS changes above (tools/art.html only; embedded MET dataset untouched).
Harness after fix: `node verify-tool.mjs art` → exit 0 (live Met image, AIC pool/search,
escaping probes inert; artic iiif 403-under-headless tolerated as documented).
