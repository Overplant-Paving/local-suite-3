# word.html migration report (Batch D — embedded-data special, EA flag)

## v1 feature walk-through

- [x] **Deterministic word of the day** (FNV-1a over `"Y-M-D"` mod word count): under
  `page.clock` fixed to 2026-07-29 the card rendered **"candid"**; a same-date reload rendered
  "candid" again; advancing the clock to 2026-07-30 and clicking "Today's word" rendered
  **"tundra"** — same date = same word, next date = next word. Both values match an independent
  out-of-browser recomputation of the scheme (runnable one-liner in `data-integrity.txt`,
  prints `374 candid tundra anthology`). Evidence: `interaction.txt` lines 1–7, 14.
- [x] **Sentinel filtering**: 376 raw lines parse to 374 words (the `haleffect` and
  `susceptance` placeholder rows dropped) — confirmed by the independent recomputation's count;
  filter code is byte-identical logic to v1.
- [x] **Card contents** — label with long-form date, word, pos pill, definition, "Origin." note:
  all logged (`interaction.txt` lines 2–4) and visible in all four screenshots.
- [x] **"Another word"** (random pick): with `Math.random` stubbed to 0.5 it rendered
  **"anthology"** (= index 187 of 374, as predicted independently).
- [x] **"Today's word"**: returned to the daily pick after a random detour (line 7).
- [x] **"Fuller definition"** (dictionaryapi.dev): ONE live lookup on "candid" — logged
  phonetic `/ˈkæn.dɪd/` and definition fragment "A spontaneous or unposed photograph…";
  cache envelope `suite.cache.word.candid` written `{t, v:[1 entry]}` (lines 8–10).
- [x] **Lookup-failure path is a designed state driven by the embedded list**: with
  api.dictionaryapi.dev route-aborted and no cache ("tundra"), the card kept its embedded
  definition and origin and the fuller box showed the quiet note
  "Couldn't reach the dictionary — the embedded origin above still stands." (lines 15–16).
- [x] **404 / HTTP-status messages** preserved by mapping `Suite.fetchJSON`'s `HTTP <n>` errors:
  404 → "No extra entry found for this word.", other → "Lookup failed (n)." — code path only,
  not live-exercised (see concerns).
- [x] **"Words I've met"** — dedupe-unshift, 60-cap, chips re-open the word, empty-state text:
  after the visits, `suite.word.met` = `["candid","anthology","brocade"]`; persisted across
  reload; chips rendered with the "· 3" count badge; clicking the "anthology" chip re-showed
  that word (lines 11–13). The 60-cap and the pre-first-visit empty state are code-identical
  to v1 (the empty state is unreachable in practice because boot always adds today's word —
  same as v1).
- [x] **Chip scroll-to-top** (`scrollTo({behavior:"smooth"})`): preserved verbatim.
- [x] **Theme toggle**: harness probe — light → dark, `aria-pressed=true`.
- [x] **Stale-cache offline path** (batchB): cache back-dated 48 h (> the 24 h TTL), all network
  blocked → the cached fuller definition rendered with
  "Offline — cached definition from Jul 28, 12:00 PM." (lines 17–18, `offline-stale.png`).

## changes beyond the recipe

- `.card` gets `display:block; flex-direction:row; gap:normal` to neutralize core's flex
  `.card` (v1's card is block). Precedent: almanac.html:37, dictionary.html:22. This fix is
  what took the computed-style diff from 43 lines (flexed card, full-width pos pill) to the
  clean 14.
- `body { line-height:1.6 }` kept tool-local — v1 uses `16px/1.6`; the core base is 1.55.
- Footer override kept tool-local (v1: 2.6rem / .83rem / 1rem vs core 3rem / .85rem / 1.1rem).
- **Policy-mandated caching** (API-AND-RELAY.md §2; v1 did not cache): `fetchFuller` now goes
  through `Suite.fetchJSON` with `cacheKey: "word."+word.toLowerCase()`, TTL 1440 min. On a
  stale fallback it renders the cached senses **plus** a new
  "Offline — cached definition from <time>" fetchnote — the mandated stale disclosure; this
  line has no v1 counterpart.
- **Network-failure message**: v1 rendered raw `e.message` (in practice "Failed to fetch") and
  its own fallback string was dead code (`e.message` is always truthy). v2 routes non-HTTP
  failures to that designed string, "Couldn't reach the dictionary — the embedded origin above
  still stands." — v1's evident intent, and the Batch D requirement that failure be a designed
  state, not an error state. HTTP statuses keep v1's exact wordings via the `HTTP <n>` mapping.
- `esc` is now an alias for `Suite.esc`. v1's div-based esc did not escape quotes; `Suite.esc`
  does — strictly safer in the `data-w="…"` attribute, and rendering-identical for text.
- v1's per-file `fetchWithTimeout` helper removed (recipe); `Suite.fetchJSON`'s default
  timeout is the same 12 s.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | ✓ | ✓ (via core) |
| `suite.word.met` | ✓ JSON array | ✓ byte-identical format (`Suite.store.set` stringifies arrays exactly as v1's `JSON.stringify`) |
| `suite.cache.word.<word>` | — | ✓ new, policy-mandated caching (`{t,v}` envelope) |

`localstorage.json`: `keysOnlyInV1` empty; `keysOnlyInV2` = `["suite.cache.word.candid"]` —
the policy-mandated cache entry explained above.

## escape allowlist requests

none — every interpolation into innerHTML is wrapped in `Suite.esc()` (see EA inventory).

## EA flag — full innerHTML interpolation inventory (for the Phase 4 auditor)

Six innerHTML assignment sites, 13 interpolated expressions, all `Suite.esc()`-wrapped:

| # | site | expression | data origin | verdict |
|---|---|---|---|---|
| 1 | `renderMet` empty branch: `list.innerHTML = ""` | (none) | static | no interpolation |
| 2 | `renderMet` chips: `list.innerHTML = m.map(...)` | `esc(w)` (attribute `data-w`), `esc(w)` (text) | localStorage (user-influenced) | esc'd ×2 |
| 3 | `show()`: `wordCard.innerHTML` | `esc(new Date().toLocaleDateString(...))`, `esc(entry.word)`, `esc(entry.pos)`, `esc(entry.def)`, `esc(entry.origin)` | local date + embedded list | esc'd ×5 |
| 4 | `fetchFuller` loading: `box.innerHTML = '<p class="fetchnote">Looking up…</p>'` | (none) | static | no interpolation |
| 5 | `fetchFuller` result: `box.innerHTML = html` | `esc(phon)`, `esc(m.partOfSpeech \|\| "")`, `esc(d.definition)`, `esc(d.example)`, `esc(new Date(r.t).toLocaleString(...))` | **remote (dictionaryapi.dev)** ×4 + local time | esc'd ×5 |
| 6 | `fetchFuller` catch: `box.innerHTML = '<p class="fetchnote">' + esc(msg) + '</p>'` | `esc(msg)` | fixed local strings (mapped whitelist) | esc'd ×1 |

All dictionaryapi.dev strings are esc'd (requirement met). `metCount` uses `textContent`.
Note: `d.example` here is an API response property — the `--check` `.example` gate matches
URLs only (confirmed for dictionary.html in commit d638678), so no false positive expected.

## a11y applied

- Theme button `aria-label` + `aria-pressed` via `Suite.theme.init()` (core).
- `Suite.liveRegion()` on `#wordCard` (covers the nested `#fuller` async result) and `#metList`.
- No icon-only buttons (all carry visible text), no form inputs, no overlays; met chips are
  real `<button>` elements, so the keyboard path is native (focus-visible outline from core).

## endpoints

- `https://api.dictionaryapi.dev` — only external host; in CATALOG.md (§7.1/7.6 and the
  keyless table: "community; flaky"). Matches v1 source exactly
  (`/api/v2/entries/en/<word>`, `encodeURIComponent`'d).
- `cacheTtlMin: 1440` — the tool's cadence is one word per day, so a 24 h TTL means at most
  one live lookup per word per day; repeat opens the same day (chip re-visits, "Today's word")
  are served from cache. Dictionary entries are effectively reference data, so 24 h is the
  conservative end of the daily-stats class (API-AND-RELAY.md §2).

## concerns for the reviewer

1. **Two live lookups total, one per harness run** — run 1 was invalidated by the core-`.card`
   flex leak (43-line style diff, visibly stretched pos pill) and rerun after the fix; each
   run made exactly one live "candid" request. Within etiquette; dictionaryapi.dev was up.
2. **404 path not live-exercised** — the `HTTP 404` → "No extra entry found for this word."
   mapping is code-reviewed only; exercising it live would spend a second lookup on a word
   designed to miss. The equivalent live-404 behavior of the same API was proven in
   dictionary.html's run-1 evidence.
3. **Manifest flags: I added `"ea"` beyond the task note's `["embedded-data"]`** — word.html is
   on the QUALITY.md §1.3 Phase 4 escaping shortlist and the burn-down row says "LD · EA",
   matching dictionary/wiki/factbook/art (all `["ea"]`). Drop it if the manifest should track
   the task note instead.
4. **Stale-disclosure fetchnote is a new visual element** vs v1 (batchB-mandated; only appears
   offline-with-cache).
5. **Label line says "Word of the day · <today>" even for non-today words** (chips, "Another
   word") — v1 behavior, preserved.
6. Computed-style diff (14/theme): all `-webkit-font-smoothing` (pre-approved) except
   `.theme-btn float: right` from core — visually inert inside the flex `.topbar`; identical
   accepted diff in dictionary's evidence.
7. The harness boots at the real date before the clock installs, so `suite.word.met` also
   contains that day's word ("brocade" on 2026-07-15) — logged honestly; v1 side writes the
   same key on load, so parity holds regardless of run date.
8. report.md was written via scratchpad + shell copy because a PostToolUse hook can block
   direct Writes to report.md (expected per HANDOFF.md).
