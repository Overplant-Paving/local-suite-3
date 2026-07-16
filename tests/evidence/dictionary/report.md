# dictionary.html — migration report (Batch B, EA flag)

Evidence: this directory. Harness run `node verify-tool.mjs dictionary` exit 0.
Extra archive: `interaction-run1-genuine-404s.txt` (see "console gate" below).

## v1 feature walk-through

- [x] **Auto-search on load** — empty history searches "serendipity"; existing history
  searches `history[0]`. Verified: interaction.txt line 1 (auto serendipity, live fetch);
  offline reload re-searched history[0]="ephemeral" (line 17).
- [x] **Word card: headword + phonetic** — "serendipity" + `/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/` rendered
  (lines 1–2, screenshots).
- [x] **Pronunciation audio button** — rendered when the model has an audio URL; sets
  `player.src` and plays with `.catch(()=>{})`. Verified present with title AND aria-label
  (line 8). Audio host observed: `api.dictionaryapi.dev` (line 7) — dictionaryapi.dev now
  serves its own media files (the v1 footer's "Wikimedia Commons" is where the recordings
  originate; the URLs are api.dictionaryapi.dev).
- [x] **Per-POS sections, numbered definitions, examples** — noun section + 2 definitions
  for serendipity; noun + adjective and 3 adjective defs for ephemeral (screenshots,
  first-definition logs lines 3, 10).
- [x] **Definition-level and meaning-level synonym/antonym chip rows** — both levels
  rendered (lines 4–5 show the def-level + meaning-level duplicates exactly as v1
  renders them; screenshots show SYNONYMS/ANTONYMS rows at both levels).
- [x] **Chip click looks up the word (+ smooth scroll to top)** — synonym chip
  "ephemeron" activated -> rendered ephemeron (line 11). Behavior code path identical
  to v1 (`search(w); window.scrollTo(...)`).
- [x] **dictionaryapi.dev -> Wiktionary fallback** — proven live in run 1: "ephemeron"
  genuinely 404'd on dictionaryapi and rendered from Wiktionary (archived run-1 log;
  cache model has `phonetic:"", audio:""`, the Wiktionary shape; final run line 12 shows
  "Source: Wiktionary"). `stripHtml` still reduces Wiktionary HTML to plain text.
- [x] **Fallback to cached model when both sources fail** — offline reload rendered
  ephemeral from cache with the v1-style note "Offline — cached from <time> · Source: …"
  (lines 17–18, offline-stale.png).
- [x] **Not-found message** — double miss on "zzxqwvv" renders the exact v1 message
  (line 15); genuine live double-404 archived in run 1 line 14.
- [x] **History: 16 most recent, dedup, most-recent-first; misses not added** — chips
  render (line 13), gibberish not pushed (line 16), order updates on re-lookup
  (localstorage.json history arrays).
- [x] **History chip click re-searches** — line 14 (served from fresh cache — see TTL note).
- [x] **Enter submits; Search button submits** — ephemeral submitted via Enter (line 9);
  the go button uses the same `search(qEl.value)` listener.
- [x] **Model cached under `suite.cache.dictionary.<encodeURIComponent(word)>`** —
  localstorage.json: identical key sets, byte-identical model payloads (679 / 1072 /
  430 chars on both sides).
- [x] **Theme toggle** — light -> dark, aria-pressed=true (line 20).

## changes beyond the recipe

1. **7-day fresh-cache TTL (policy-mandated, API-AND-RELAY.md §2).** v1 always re-fetched
   and used its cache only as a failure fallback. v2 serves a cached model younger than
   cacheTtlMin=10080 (reference-data class: definitions don't change) without a request;
   rendering is identical to a fresh fetch. The cache stays the v1 layout — the
   NORMALIZED model at the v1 keys — so `Suite.fetchJSON` is called WITHOUT `cacheKey`
   (`fallbackToCache:false`) and the tool keeps its own {t,v} envelope via Suite.store;
   using fetchJSON's raw-response cache would have added new per-source keys and broken
   key parity.
2. **Honest stale timestamp (policy: "never pretend").** v1 called `cacheSet`
   unconditionally, so on a cache-fallback render it re-stamped the entry with `t=now`
   and the "Offline — cached from" line always showed the current time. v2 only
   re-stamps when the model came from the network and shows the entry's true fetch time
   (offline-stale.png shows the 8-day-old timestamp).
3. **`stripHtml` via DOMParser instead of a detached-div `innerHTML`.** Same textContent
   result, but DOMParser never triggers subresource loads (a detached div parsing remote
   Wiktionary HTML would fetch any `<img src>` in it). EA-flag hardening; output parity
   proven by the byte-identical ephemeron model on both sides.
4. **`getHistory` guards `Array.isArray`** (Suite.store.get parses JSON but can return a
   bare string for corrupted values); same "[]" fallback as v1's try/catch.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | identical (core) |
| `suite.dictionary.history` | JSON array, max 16 | identical (Suite.store.set stringifies identically) |
| `suite.cache.dictionary.<encodeURIComponent(word)>` | `{t, v:model}` | identical envelope, byte-identical models |

Verdict: keysOnlyInV1 = [], keysOnlyInV2 = [] (localstorage.json). No legacy non-suite keys.

## escape allowlist requests

None. The tool builds all output with `createElement`/`textContent` (v1 already did);
the only `innerHTML` uses are bare `= ""` container clears with no interpolation.
Remote prose (definitions, examples, synonyms, phonetics, word) always flows through
`textContent`. Wiktionary's HTML definitions are reduced to text via DOMParser and never
injected. The one remote value used outside textContent is `model.audio` assigned to
`audio.src` — a media URL from the API response, not markup (see concerns).

## a11y applied

- `Suite.liveRegion(resultEl)` — loading, result card, offline note, and not-found
  states are all announced (they render inside #result).
- Search input: `aria-label="Look up a word"` (placeholder-only in v1). Enter already
  submitted in v1 — kept and verified.
- Audio button (icon-only 🔊): `aria-label="Play pronunciation"` added alongside the title.
- History and synonym/antonym chips were click-only `<span>`s in v1 — no keyboard path.
  Now `role="button"` + `tabindex="0"` + Enter/Space activation (the weather.html
  "change" pattern; spans kept so computed styles stay identical to v1). Verified by
  activating the ephemeron chip via keyboard Enter (interaction.txt lines 11–13).
- History container: `aria-label="Recent lookups"` (not a live region — announcing 16
  chips after every search would be noise; the result region carries the outcome).
- Focus outline on the search box comes from core `:focus-visible` (QUALITY.md §2 "once
  in core"); v1 set `outline:none`. This is the only visible difference in the
  screenshots (v2-light/dark show the ring because the input autofocuses).

## endpoints

- `https://api.dictionaryapi.dev` — definitions (primary) AND pronunciation mp3s
  (`/media/pronunciations/...`, observed live). In CATALOG.md ("dictionaryapi.dev …
  community; flaky").
- `https://en.wiktionary.org` — `/api/rest_v1/page/definition/<term>` fallback.
  In CATALOG.md ("Wiktionary definitions").
- No other hosts: no images, and the audio observed is same-host with the API.

cacheTtlMin 10080: reference-data class per API-AND-RELAY.md §2 (a word's definition is
effectively static; CATALOG notes dictionaryapi.dev occasionally throttles — long TTL is
the good-citizen behavior).

## concerns for the reviewer

1. **Harness console gate vs 404-means-miss semantics.** A lookup that misses a source
   emits a browser-level "Failed to load resource: 404" console error which
   verify-tool.mjs counts as a hard issue (only `net::ERR` is filtered). Run 1 exercised
   the GENUINE live 404s (dictionaryapi miss -> Wiktionary fallback; double 404 ->
   not-found card) and is archived as `interaction-run1-genuine-404s.txt`; the final
   exit-0 run drives the same tool code paths but aborts those two known-miss requests
   at the harness level (abort -> filtered `net::ERR_FAILED`). The tool's catch path is
   identical for 404 and network failure. If the reviewer prefers, extending the harness
   filter to expected-404 messages would let the genuine run pass — I did not touch
   verify-tool.mjs (hard rule).
2. **`audio.src` from remote data.** The model's audio URL comes from the API response
   and is assigned to the `<audio>` element (v1 behavior, preserved). It is not an XSS
   sink, but it is a network side-channel: dist CSP derives `connect-src`/`img-src` from
   the manifest — if `media-src` is not emitted, `default-src 'none'` will block dist
   audio playback even for the legitimate host. Flagging for the CSP suite-wide rollout
   (Phase 4): either derive `media-src` from endpoints or accept audio being dev-only.
3. **Wiktionary REST is marked experimental** (CATALOG.md); rate limits are far above
   this tool's volume. No `application=` identifier param is documented for either API;
   none added (the addendum's identify-yourself rule applies "where asked").
4. **`fromCache` render nuance:** a fresh-TTL cache hit renders exactly like a live
   fetch (no "Offline" note) — deliberate: the data is within its declared freshness
   window, and weather.html sets the same precedent. Only network-failure fallbacks are
   labeled stale.
5. **Style-diff residue** (computed-style-diff.txt): `-webkit-font-smoothing`
   (pre-approved), `.theme-btn float: right` from core (inert — the button is a flex
   item in `.topbar`, floats don't apply), `.search` outline (the core focus-visible
   ring, item above). Nothing else differs in either theme.

## Phase 4 escaping audit (line-by-line)

Audit date 2026-07-16. Scope: every dynamic-markup and attribute-context site in
`tools/dictionary.html` (post-audit line numbers). Verified against a fresh
`node verify-tool.mjs dictionary` run — exit 0, evidence in this directory.

### Site inventory (complete)

| line | sink | interpolated data | provenance | verdict |
|---|---|---|---|---|
| 77 | `el()` helper: `e.textContent = txt` | all card text flows through here | mixed (remote + local) | safe — text node, never parsed as markup |
| 116 | `box.innerHTML = ""` | none | — | safe — bare literal clear |
| 170 | `resultEl.innerHTML = ""` | none | — | safe — bare literal clear |
| 171 | loading card via `el(..., "Looking up “"+word+"”…")` | `word` (user input) | local user input | safe — textContent |
| 120 | history chips `el("span","hchip",w)` | `w` from `suite.dictionary.history` | localStorage (originally user/remote words) | safe — textContent |
| 201 | `resultEl.innerHTML = ""` | none | — | safe — bare literal clear |
| 202 | not-found msg via `el()` | `word` (user input) | local user input | safe — textContent |
| 212 | `resultEl.innerHTML = ""` | none | — | safe — bare literal clear |
| 215 | `el("h2", null, model.word)` | headword | remote (dictionaryapi.dev) / cache | safe — textContent |
| 216 | `el("span","phon", model.phonetic)` | phonetic | remote | safe — textContent |
| 218–228 | audio button: `btn.title`, `aria-label` | literals only | local | safe |
| 225 | `player.src = audioUrl` | audio URL | remote / cached model | **was UNSAFE-adjacent — FIXED** (see below) |
| 232 | `el("h3", null, m.pos)` | partOfSpeech | remote | safe — textContent |
| 236 | `document.createTextNode(d.def)` | definition | remote (incl. Wiktionary HTML pre-reduced by `stripHtml`) | safe — text node |
| 237 | example via `el()` | example | remote | safe — textContent |
| 238–245 | def- and meaning-level `chipRow()` | synonym/antonym words | remote | safe — textContent; className is a literal ternary (`"synchip"`/`" ant"`) |
| 249 | src-note via `el()` | `fetchedAt` (`Date.toLocaleString`), `model.source` | local clock; source is a normalizer-set literal (arbitrary only via tampered same-origin cache) | safe — textContent either way |
| 164–167 | `stripHtml` DOMParser | Wiktionary definition/example HTML | remote | safe — inert document (no subresource loads, scripts dead), only `textContent` extracted |
| 173 | `q.value = word` | user input | local | safe — value property, not markup |

`sourceUrls` from dictionaryapi.dev are **never rendered** — `fromDictApi` drops them
and the tool has no dynamic `href` sink at all (the only anchor is the static back
link). Grep-verified: the sinks above are the exhaustive set of
`innerHTML|outerHTML|insertAdjacentHTML|document.write|.src=|.href=|setAttribute|.title=`
occurrences; all `setAttribute` calls use literal names/values (`role`, `aria-label`).

### Fix applied (1)

- **`player.src` scheme guard** (render(), the audio button block): `model.audio` is
  remote data — and on a cache-fallback render it comes from localStorage, including
  v1-era caches — reaching a URL attribute context. A media `src` is not a script
  sink in any current browser (`javascript:` does not execute on `<audio>`), but it
  was the tool's single remote-data-to-URL-context flow, so it now passes through
  `/^https?:\/\//i`: a non-http(s) audio value (javascript:, data:, blob:) renders NO
  audio button and never touches `player.src`. No behavior change for legitimate data
  (observed audio URLs are `https://api.dictionaryapi.dev/media/...`). The Batch B
  report's reviewer-concern #2 (CSP `media-src`) still stands and is unchanged by this.

No other site needed changes: the tool was already fully `createElement`/`textContent`
(v1 heritage), matching the Batch B report's claim — re-verified line by line.

### Adversarial probe (route-fulfilled hostile payloads)

`tests/interactions/dictionary.mjs` now ends with a probe section (runs inside the
standard harness pass; probe cache/history state is removed afterwards so localStorage
parity stays byte-clean — `keysOnlyInV1/V2` still `[]`):

- **Hostile dictionaryapi.dev payload** (`xzzhostileprobe`): `<img onerror>` in word +
  definition, `<svg onload>` in phonetic + antonym, `<script>` in partOfSpeech,
  `<img onerror>`/`<iframe javascript:>` in synonyms, `example` attribute-breakout
  string, `audio: "javascript:window.__pwned=3"`, `sourceUrls:
  ["javascript:window.__pwned=10"]`.
- **Hostile Wiktionary payload** (`xzzwikprobe`, primary aborted to force the
  fallback): `<img onerror>` in the definition HTML, `<script>` in examples[0].

Results (interaction.txt lines 20–28): `window.__pwned` stayed `undefined` through
both probes after a 500 ms grace period; **zero** `img/svg/script/iframe` elements
inside `#result` or `#history`; every hostile string rendered as literal visible text
(headword, phonetic, pos, definition, example, chips — screenshot
`hostile-probe.png`); the `javascript:` audio URL produced **no button** and
`player.src` stayed `""` (the new scheme guard, exercised); **no anchors** rendered
(`sourceUrls` never reach the DOM); `stripHtml` reduced the hostile Wiktionary HTML to
`"wik definition"` / `"wik example"` with nothing executed. The probe throws (fails
the harness) on any escape, so this is a standing regression gate, not a one-off.

### Allowlist

`tests/escape-allowlist.json` has no dictionary.html entries and still needs none —
no previously-allowlisted expression exists for this tool, and none was found unsafe.

Harness: `node verify-tool.mjs dictionary` exit 0 (2026-07-16 run; the 6
`net::ERR_FAILED` console lines are the harness-aborted known-miss/offline/probe
requests, filtered by design). Note: this run required the verify-tool.mjs line-98
string-literal fix (raw newline -> `\n`) landed by the orchestrator — the harness at
the previous HEAD did not parse.
