# wiki.html migration report (Batch B — CORS-open fetchers, EA flag)

Evidence produced by `node verify-tool.mjs wiki` (exit 0): screenshots both themes both
versions, `v2-after-interaction.png`, `offline-stale.png`, `computed-style-diff.txt`,
`interaction.txt`, `localstorage.json`.

## The QUALITY.md §1.3 mechanism (EA flag) — studied before touching anything

The §1.3 note says wiki.html "renders Wikipedia HTML; must keep using DOM append, never raw
injection." What v1 actually does, verified line by line: **v1 never injects any remote string
into `innerHTML` at all.** Every remote value — article title, description, extract, feed text,
suggestion titles — is rendered through the `el(tag, cls, txt)` helper, which uses
`document.createElement` + `textContent`, or through `document.createTextNode`. The REST
`page/summary` endpoint's `extract` field is plain text (v1 never touches `extract_html` or
`displaytitle`, which DO contain markup — they sit unused inside the cached envelope and are
never rendered). `innerHTML` is only ever assigned the empty string to clear a container.
v2 preserves this mechanism verbatim: same `el()` helper, same `createTextNode`, `innerHTML`
only for clearing, and a security comment now marks the invariant at the top of the script.
The escape calls §1.3 counted in v1 do not exist as remote-data escapes — there are zero
interpolations to escape; the Phase 4 re-audit should find the same.

## v1 feature walk-through

- [x] **Search with title suggestions (debounced 200 ms, 8 max)** — typed "Ada Lovelace";
  6 suggestions rendered, first "Ada Lovelace" (interaction.txt line 8). Live fetch of
  `/w/rest.php/v1/search/title` observed (200).
- [x] **Suggestion keyboard nav (ArrowUp/ArrowDown/Enter) + Escape closes + click-outside
  closes** — code preserved unchanged; Escape verified in interaction.txt line 9
  ("suggest hidden after Escape: true"). Enter-with-no-active-item path exercised to open
  the article (lines 10–11).
- [x] **Summary lookup + clean article card (title, italic description, extract, thumbnail,
  Read-full-article link, save button)** — "Ada Lovelace" opened live: h2, desc
  "English mathematician (1815–1852)", extract logged; also the auto-opened "Wikipedia"
  article (lines 1–3). Read-link href logic (content_urls fallback) unchanged.
- [x] **Article thumbnail images load** — `upload.wikimedia.org` thumbnail rendered at
  natural 330x302 px (line 3); visible in all screenshots. `img` error-fallback (remove on
  failure) converted from `.onerror=` to `addEventListener("error")`, behavior identical —
  seen working in offline-stale.png (image gone, layout intact).
- [x] **Random button** — one roll: "Guinea national football team" rendered and its summary
  cached under `suite.cache.wiki.s:<title>` exactly as v1 does (lines 15–16).
- [x] **Featured today panel (tfa, mini card, click opens article)** — live fetch of
  `/feed/featured/2026/07/15`; "Cognition — Mental process dealing with knowledge" rendered
  (line 4); click-through preserved (now also keyboard-reachable).
- [x] **On this day panel (selected events, 10 max, year + text, click opens page)** — live
  fetch of `/feed/onthisday/selected/07/15`; 10 items rendered, first two logged (lines 5–7).
- [x] **Reading list (save/unsave toggle, unshift order, click opens, ✕ removes, persists in
  `suite.wiki.readlist`)** — saved "Ada Lovelace": button flips to "✓ In reading list",
  key holds `["Ada Lovelace"]`, panel row rendered (lines 12–14); survives reload (stale-path
  reload reopened readlist[0]).
- [x] **First-load behavior: open readlist[0], else "Wikipedia"** — both paths seen: fresh
  profile opened "Wikipedia" (line 1); after saving, reloads opened "Ada Lovelace" (lines
  17, 21).
- [x] **Offline/stale fallbacks** — article renders cached copy with "· Offline — cached from
  <time>" line; feeds render cached content; error cards ("Couldn't load…", "Couldn't fetch a
  random article…", "Featured article unavailable…", "On-this-day feed unavailable.") all
  preserved with v1 wording. Stale path proven: offline-stale.png + interaction.txt lines
  17–20.
- [x] **404 semantics** — v1: 404 → render cached copy if present, else the "may not exist,
  or you may be offline" error card. `Suite.fetchJSON` reproduces this exactly (404 breaks
  its retry loop, falls back to cache when present, throws otherwise → same error card).
- [x] **Theme toggle** — harness probe: light → dark, aria-pressed=true (line 22).

## changes beyond the recipe

- **Cache-first summaries (policy-mandated, API-AND-RELAY.md §2):** v1 always fetched the
  summary and used its cache only as a failure fallback. v2 serves a cached summary younger
  than the TTL without a request. Cache keys unchanged (`suite.cache.wiki.s:<title>`).
  Rendering identical.
- **Feed TTLs 6 h/12 h → 24 h (cacheTtlMin 1440):** the featured and on-this-day feeds
  change once per day and their v1 cache keys are date-scoped (`feat:YYYYMMDD`, `otd:MMDD`),
  so a new day is a new key and refetches immediately regardless of TTL; within a day the
  content is by definition current. 1440 declares the honest refresh interval (daily-stats
  class). Summaries share the same TTL — a day-old summary is indistinguishable
  reference-class text.
- **Stale-feed honesty note:** v1 silently rendered cached feed data on network failure. The
  batch rule "never pretend stale data is fresh" now appends a muted
  "Offline — cached from <time>" line under the featured and on-this-day panels when stale
  (article card already had this in v1). Visible in offline-stale.png.
- **Typeahead suggestions intentionally uncached:** caching per-keystroke queries would
  write unbounded one-shot keys into localStorage; v1 didn't cache them either. The 200 ms
  debounce (kept) is the etiquette mechanism. Flagged here as the one deliberate deviation
  from "cache everything".
- **Random rolls: fetch always, then cache manually.** `Suite.fetchJSON` without `cacheKey`
  (a roll must never be served from cache), then the envelope is written to
  `suite.cache.wiki.s:<title>` via `Suite.store.set` — byte-compatible with v1's `cacheSet`.
- **`getReadList` hardening:** `Suite.store.get` returns raw strings for unparseable values,
  so an `Array.isArray` guard replaces v1's try/catch-to-`[]`. Same outcome for all inputs.

## localStorage keys (v1 vs v2)

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | identical (`Suite.store` writes strings bare) |
| `suite.wiki.readlist` | JSON array of titles | byte-identical (`["Ada Lovelace"]` both sides) |
| `suite.cache.wiki.s:<title>` | `{t, v}` envelope | identical envelope, identical key |
| `suite.cache.wiki.feat:YYYYMMDD` | `{t, v}` | identical |
| `suite.cache.wiki.otd:MMDD` | `{t, v}` | identical |

`localstorage.json`: `keysOnlyInV1 = ["suite.cache.wiki.s:VqmR sRNA"]`,
`keysOnlyInV2 = ["suite.cache.wiki.s:Guinea national football team"]` — both are the cached
summary of each run's **Random** roll; the key name is random by nature, so the sets can
never match literally. Every deterministic key matches exactly.

## escape allowlist requests

none — the tool contains no template-literal interpolation into `innerHTML` anywhere
(remote data is rendered exclusively via `createElement`/`textContent`; `innerHTML` is only
assigned `""`).

## a11y applied

- `aria-label="Search Wikipedia"` on the `#q` search input (placeholder-only in v1).
- `aria-label="Remove “<title>” from reading list"` on the icon-only ✕ buttons (v1 had only
  `title="Remove"`).
- `Suite.liveRegion()` on the four async containers: `#article`, `#featured`, `#onthisday`,
  `#readlist`.
- Keyboard path for every mouse path: on-this-day items, the featured mini-card, and
  reading-list title spans were click-only divs/spans in v1 — now `role="button"`,
  `tabindex="0"`, and Enter/Space activation via a shared `clickable()` helper. Suggestion
  items keep their v1 keyboard path (ArrowUp/ArrowDown/Enter from the input).
- Enter submits the search (v1 already had it; verified). Esc closes the suggestion overlay
  (v1 already had it; verified — note Escape in an `<input type=search>` also natively
  clears the field, in both versions).
- Theme button labeling/`aria-pressed` from core `Suite.theme.init()`.

## endpoints

- `https://en.wikipedia.org` — REST v1 (`/api/rest_v1/page/summary`, `/page/random/summary`,
  `/feed/featured`, `/feed/onthisday/selected`) and the search endpoint
  (`/w/rest.php/v1/search/title`). In CATALOG.md (§7.2, verified table).
- `https://upload.wikimedia.org` — article/featured thumbnails (`img-src`; live-proven,
  330x302 px natural size). **Not currently listed in CATALOG.md** — needs an orchestrator
  CATALOG touch; a missing img-src host would break thumbnails in dist.
- CATALOG §7.2 nit for the same touch: it cites `feed/onthisday/all/…` but v1 and v2 use
  `feed/onthisday/selected/…`.

## concerns for the reviewer

- **upload.wikimedia.org missing from CATALOG.md** (above) — manifest-entry.json includes
  it; the CSP img-src derivation depends on the manifest, so dist is safe once the manifest
  entry lands, but the CATALOG cross-check gate will warn until the prose is updated.
- **interaction.txt shows 5 `net::ERR_FAILED` console errors** — these are the deliberately
  aborted requests of the Batch B offline-path test (route-abort + reload), the same pattern
  as other Batch B tools; the harness classifies them as non-hard issues and exited 0. No
  other console output.
- **`page/random/summary` cache write on quota-full browsers:** v1's `cacheSet` swallowed
  quota errors; `Suite.store.set` also swallows them — parity, but noting the manual
  envelope write in the random handler is the one place v2 writes a cache entry outside
  `Suite.fetchJSON`.
- **Suggestion dropdown ARIA is minimal** (no combobox/listbox roles) — v1 parity; full
  combobox semantics would be a feature addition beyond the checklist. Keyboard operation
  works and is verified.
- The stale-note additions under the two feed panels are new UI text (policy-driven); if the
  reviewer judges them scope creep, deleting the two `if (staleT) box.append(...)` lines
  restores exact v1 silence.
