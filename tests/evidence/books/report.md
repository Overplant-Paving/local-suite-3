# books.html — migration report (Batch B)

## v1 feature walk-through

- [x] **Title/author search (Open Library, 20 results)** — live fetch of
  `https://openlibrary.org/search.json?q=The+Left+Hand+of+Darkness&limit=20&fields=…` verified;
  interaction.txt logs status "36 found", 20 cards, first result
  title="The Left Hand of Darkness" author="Ursula K. Le Guin" sub="1969 · 91 editions ·
  ISBN 9788419206671". Card layout (cover · title · author · year/editions/ISBN · add
  button) matches v1 in the screenshots.
- [x] **Cover images from covers.openlibrary.org** — first cover logged loading live:
  `covers.openlibrary.org/b/id/10618463-M.jpg`, 180x283 natural px. All 20 results
  rendered `<img class="cover">` (0 no-cover placeholders in this result set).
- [x] **Cover fallback when an image fails (REQUIRED, MIGRATION row 52)** — v1
  `books.html:200` inline `onerror=` converted to `addEventListener("error", …)` on a
  DOM-built `<img>`; the null-coverUrl branch keeps the direct `.cover-ph` div as v1.
  Proven: in the network-blocked pass every aborted cover fired the listener —
  "20 placeholder(s) swapped in, 0 <img> remaining" — and offline-stale.png shows all
  cards with the 📖 placeholder.
- [x] **Google Books automatic fallback (search + ISBN)** — code path preserved (same
  normalizer, same status texts "… found (via Google Books)" / "Found by ISBN (via
  Google Books)"); the fallback fetch is exercised (aborted) in the offline test. Not
  live-rendered end-to-end: Open Library was up, and forcing it down would mean an extra
  synthetic hit — see concerns.
- [x] **ISBN direct lookup (10/13-digit sanitize, author sub-fetches, year regex)** —
  live: ISBN 9780441172719 → status "Found by ISBN", title="Dune" author="Frank Herbert"
  (from the `/authors/OL79034A.json` sub-fetch) sub="1987 · ISBN 9780441172719".
- [x] **Debounced input, ~1 req/s etiquette + Enter for immediate search** — `onInput`
  debounce (min 450 ms, 1000 ms spacing via `lastReq`) and the Enter keydown handler kept
  verbatim; the harness drives via Enter.
- [x] **Mode toggle (Title/author ⇄ ISBN) with placeholder swap + refocus** — clicked
  live: placeholder flips to "Enter an ISBN — e.g. 9780441172719"; re-runs the current
  term as v1. New `aria-pressed` reflects the active mode (logged true).
- [x] **Read-next list: add / duplicate-guard / remove / re-add** — all exercised:
  add → button flips to "✓ On your list" + count "· 1"; remove via ✕ → empty-state
  visible, stored length 0; re-add via the same card button (v1 semantics) → length 1.
- [x] **Read-next persistence (v1 key, byte-identical)** — `suite.books.readnext`
  written with the identical JSON shape (localstorage.json: v1 and v2 values match);
  survives reload — "after reload: saved count=· 1, item=The Left Hand of Darkness…".
- [x] **Export TSV** — empty-list guard message verified ("Your read-next list is empty —
  nothing to export yet."), then a real download fired with suggested filename
  "read-next.tsv".
- [x] **24 h search-result cache with "Results (cached …)" fast path** — same mechanism,
  TTL now 7 d (see changes); verified by the restored pass: "Results (cached just now)"
  rendered with no JSON refetch.
- [x] **Offline fallback to stale search cache** — v1's own path, now behind the 7 d TTL:
  cache back-dated 8 days + all http(s) aborted → "Offline — showing cached results from
  8 days ago", 20 cards rendered (offline-stale.png).
- [x] **Total-failure message** — "Couldn't reach either book service…" kept verbatim
  (reached when offline with no cache; code path unchanged).

## changes beyond the recipe

- **Search TTL 24 h → 7 d** (`cacheTtlMin: 10080`, reference-data class per
  API-AND-RELAY.md §2 — book metadata/editions/covers change on the scale of months, like
  factbook/zip). Cache mechanism, key format and envelope unchanged.
- **Search cache stays tool-local (not `Suite.fetchJSON`'s cacheKey).** v1 caches the
  NORMALIZED book array under `suite.cache.books.s:<term>` and the one key spans both
  sources (OL or the Google fallback). fetchJSON's per-URL raw-response cache can't
  represent that, and reinterpreting a v1 user's normalized entries as raw responses
  would break them. So fetchJSON handles transport (timeout/abort) for the two search
  fetches, and `cacheGet`/`cacheSet` keep v1's exact keys + `{t, v}` envelope via
  `Suite.store`. Same approach the zip migration used.
- **ISBN lookups now cached** (v1 fetched them uncached every time) — policy-mandated
  (API-AND-RELAY.md §2), via fetchJSON cacheKeys `books.isbn:<isbn>`,
  `books.author:<olid>`, `books.gisbn:<isbn>` (Google fallback), 7 d TTL. Rendering
  identical when fresh; when served stale after a network failure the status says
  "Offline — cached ISBN result from <time>" (new, honest-stale rule) instead of
  pretending freshness.
- **`Suite.esc` replaces v1's div-textContent `esc()`** — strictly stronger: v1's helper
  did not escape quotes, yet its output went into the `src="…"` attribute of the cover
  `<img>` string. The cover is now DOM-built anyway (see below).
- **Cover `<img>` built via `createElement`** (required by the onerror→listener
  conversion); order (cover first, then meta) preserved with `el.prepend(cover)`.
- **Style-diff neutralizers / overrides:** `.topbar .theme-btn { float:none }` (core adds
  an inert float; v1's button is a flex child), `.search { padding:.75rem 1rem }` (v1
  books uses .75rem vs core's .7rem), `footer { margin-top:2.6rem; font-size:.83rem;
  padding-top:1rem }` (v1 differs from core's footer metrics).
- **Remaining computed-style diffs are justified:** `-webkit-font-smoothing`
  (pre-approved) and `.search` outline (v1 declared `outline:none`; the tool autofocuses
  the search box on boot and core's `:focus-visible` outline — QUALITY.md §2, fixed once
  in core — now shows on it. Visible in the v2 screenshots as the accent ring around the
  focused search field; deliberate a11y improvement, not a regression).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (via Suite.theme) |
| `suite.books.readnext` | yes — JSON array of normalized books | yes — same key, same value shape (verified byte-equal in localstorage.json) |
| `suite.cache.books.s:<term>` | yes — `{t, v:[normalized books]}` | yes — same key, same envelope, same normalized shape |
| `suite.cache.books.isbn:<isbn>` | no | new — policy-mandated ISBN caching |
| `suite.cache.books.author:<olid>` | no | new — policy-mandated author-lookup caching |
| `suite.cache.books.gisbn:<isbn>` | no | new — Google ISBN fallback cache (not written in the run; OL answered) |

`keysOnlyInV1` is empty. `keysOnlyInV2` = the two policy-mandated ISBN/author caches
above. A v1 user's existing `s:<term>` caches and read-next list are read unchanged.

## escape allowlist requests

none — every remote-derived expression interpolated into `innerHTML` is wrapped in
`Suite.esc()` (`b.title`, `b.authors`, `sub.join(" · ")` in both the result cards and the
saved list); the remaining concatenated pieces are string literals or the boolean-derived
`(already ? ' added' : '')`. The cover URL no longer passes through markup at all
(DOM-built `img.src`). Note the tool builds HTML with string concatenation, not template
literals, so the heuristic should not fire here.

## a11y applied

- `Suite.liveRegion()` on `#status` — the single announcer for search/ISBN/offline/export
  states. Deliberately NOT on `#results` or `#savedList`: both re-render wholesale and a
  polite region would re-announce up to 20 cards per keystroke-triggered search.
- `aria-label="Search by title, author, keyword, or ISBN"` on `#q` (placeholder-only in
  v1). Enter already submits (v1 behavior, kept).
- Mode toggles get `aria-pressed` (true/false maintained on click).
- Icon-only ✕ remove buttons get `aria-label="Remove <title> from the read-next list"`
  (set via `setAttribute`, no markup interpolation).
- Theme button labeled + `aria-pressed` by core `Suite.theme.init()`; verified in the
  toggle probe (light → dark, aria-pressed=true).
- Keyboard path: every action is a real `<button>` or input; no overlays, so no Esc
  handling needed.

## endpoints

Every host the tool can contact:

- `https://openlibrary.org` — `/search.json` (search), `/isbn/<isbn>.json` +
  `/authors/<olid>.json` (ISBN lookup), all via `Suite.fetchJSON`. In CATALOG.md: present.
- `https://covers.openlibrary.org` — cover images, plain `<img>` loads (stays plain per
  the addendum). **img-src needs this host.** In CATALOG.md: present (line ~344).
- `https://www.googleapis.com` — `/books/v1/volumes?q=` automatic fallback for search and
  ISBN (v1 feature; removing it would violate "no behavior removed" — it was missing from
  the task's given endpoint list). In CATALOG.md: present (`googleapis.com/books/v1`).
- `https://books.google.com` — Google Books thumbnail host (`volumeInfo.imageLinks.*`
  URLs point here; the tool upgrades them to https). **img-src needs this host** or the
  fallback path renders placeholder covers only. NOT currently named in CATALOG.md —
  flagged for the orchestrator.

`cacheTtlMin: 10080` — reference-data class (API-AND-RELAY.md §2): book records, edition
counts and covers are stable reference data; 7 d matches factbook/zip.

## concerns for the reviewer

- **Google Books fallback not live-rendered.** Open Library answered throughout the run,
  so the fallback was only proven as far as "attempted and aborted" in the offline pass
  plus code-identical normalization. A targeted run aborting only `openlibrary.org` would
  prove it end-to-end against the live API if wanted.
- **`books.google.com` and `www.googleapis.com` were absent from the task's endpoint
  list** but are required by the v1 Google fallback (connect-src + img-src). If the
  orchestrator prefers to drop the fallback instead, that is a feature removal and needs
  an explicit decision. `books.google.com` also needs a CATALOG.md mention.
- **The offline stale test back-dates by 8 days, not the addendum's 24 h** — with the 7 d
  TTL a 24 h back-date stays fresh and would exercise the fresh-cache path, not the stale
  path. The 8-day variant forces expired-cache + network-down, which is the state the
  addendum means to prove. (The fresh-cache path is separately proven by the restored
  step: "Results (cached just now)" with no refetch.)
- **TTL semantics for ISBN changed from "never cached" to 7 d** — a user re-looking-up an
  ISBN within a week gets the cached record with the v1 status text. Policy-mandated;
  flagging because it is a real behavior difference.
- **v1's ISBN 404 nuance:** `Suite.fetchJSON` breaks out of retries on 404 (no retry
  storm) and, with `tries:1` here anyway, the unknown-ISBN path ends in the same
  "No book found for ISBN …" message via the Google fallback, as v1.
- The 25 `net::ERR_FAILED` console errors in interaction.txt are all from the deliberate
  network-abort phase (2 JSON fetches + ~20 aborted cover images + author fetch); the
  harness's hard-issue filter excludes them, and the pre-abort console was clean.
- The v2 screenshots show an accent focus ring on the search box that v1 lacks — that is
  core's `:focus-visible` outline on the autofocused input (QUALITY.md §2), not a palette
  drift; explained under changes.

## Phase 4 a11y audit

Re-verified 2026-07-16 against QUALITY.md §2 (Phase 4 audit addendum). Full runtime log in
`a11y-phase4.txt` (harness: `tests/a11y-phase4-batch.mjs`, Open Library route-fulfilled).

| # | Checklist item | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | icon-only controls named | pass | the saved-list ✕ carries a per-item `aria-label` ("Remove <title> from the read-next list"); everything else is worded |
| 2 | aria-live on async containers | pass | `aria-live=polite` on #status — the announced channel; the results grid itself is deliberately not live (list re-renders would spam screen readers), status announces every outcome incl. offline/stale |
| 3 | keyboard path | pass | search, add-to-list, remove, mode switch, and ISBN lookup all driven keyboard-only (Enter submits; Tab reaches every button); no positive tabindex; no overlays |
| 4 | input labels | pass | #q has `aria-label` covering both modes |
| 5 | contrast, both palettes | fixed | see below — 2 tool-local failures fixed, 1 suite flag |
| 6 | focus visibility | pass | 8/8 tabbed elements show the core 2px accent outline |

Contrast measurements:
- FIXED: `.mode.on` was `#fff` on `var(--accent)` — **2.36:1 dark**. Now `color: var(--bg)`
  (5.26:1 light / 7.60:1 dark).
- FIXED: `.saved-item .rm:hover` was hardcoded `#c0552d` (3.55:1 on the dark card) — now a
  3-layer `--rm-hover` accent (#c0552d light 4.51:1 / #e0766a dark 5.41:1).
- SUITE FLAG (not fixed locally): `--muted` on `--bg` = **4.36:1 light** (footer). Dark passes.
- n-a: the 📖 cover placeholder glyph on `--chip` is decorative (no information conveyed).

Fixes made: the two CSS changes above (tools/books.html only).
Harness after fix: `node verify-tool.mjs books` → exit 0 (live Open Library fetch, cover load,
TSV export, stale path).
