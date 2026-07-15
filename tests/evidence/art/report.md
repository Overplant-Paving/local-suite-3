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
