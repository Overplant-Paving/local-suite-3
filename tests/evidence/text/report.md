# text.html migration report (Batch A)

## v1 feature walk-through

Every feature exercised on the migrated v2 source via `node verify-tool.mjs text`
(log: `interaction.txt`), or verified by inspection where noted.

- [x] **Counts (words / characters / no-spaces / lines / sentences / paragraphs / read time)** —
  fed `"one two three\nfour five"`; all seven stats matched hand-computed expectations
  (5 / 23 / 19 / 2 / 1 / 1 / <1 min). Stats also render as zeros on boot (screenshots).
- [x] **Copy** — clicked; toast reads "Copied" (Playwright/file:// hits the clipboard-API path
  or the `execCommand` fallback; either way the v1 toast confirms).
- [x] **Clear** — code identical to v1 (`setText("")`); covered by the shared `setText` path the
  undo test exercises.
- [x] **Undo (50-deep history)** — after UPPERCASE then camelCase, one Undo returned
  "HELLO WORLD" (the pre-camelCase state). "Nothing to undo" toast path unchanged from v1.
- [x] **Case ops (upper/lower/title/sentence/camel/snake/kebab/constant)** — UPPERCASE
  "hello world" -> "HELLO WORLD"; camelCase -> "helloWorld". Remaining ops are the identical
  v1 pure functions (byte-identical `OPS` table; only the handler wiring changed).
- [x] **Line ops (sortAsc/sortDesc/sortNum/dedupe/reverse/shuffle/dropBlank)** — Sort A->Z of
  `banana,apple,banana,cherry` -> `apple,banana,banana,cherry`; dedupe -> `apple,banana,cherry`;
  shuffle of `1..5` preserved the multiset (sorted back to `1,2,3,4,5`, crypto-random path
  exercised). sortDesc/sortNum/reverse/dropBlank are the identical v1 one-liners.
- [x] **Whitespace & JSON (trim/collapse/jsonPretty/jsonMin)** — jsonPretty of
  `{"b":1,"a":[1,2]}` produced 2-space-indented output; jsonMin restored the exact minified
  string. Error path: jsonPretty on "not json" showed `Could not apply: ...` in #opHint and left
  the input untouched. trim/collapse identical v1 one-liners.
- [x] **URL encode/decode** — `"a b&c=d?é"` -> `a%20b%26c%3Dd%3F%C3%A9` -> round-trip equal.
- [x] **Base64 encode/decode (UTF-8-safe)** — `"Hello, Wörld! ✓"` -> `SGVsbG8sIFfDtnJsZCEg4pyT`
  -> round-trip equal via "Use result as input". Decode of junk shows the v1 error message.
- [x] **SHA-256 / SHA-384 / SHA-512** — SHA-256("abc") =
  `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` (matches the FIPS 180
  test vector). SHA-384/512 share the same `digestHex` code path.
- [x] **WebCrypto on file://** — verified live: `location.protocol === "file:"`,
  `isSecureContext === true`, `crypto.subtle` present in Chrome. v1's fallback (throw
  "WebCrypto unavailable — open via https:// or localhost") is preserved verbatim for
  browsers where file:// is not a secure context.
- [x] **Copy result / Use result as input** — encToInput exercised in both round-trips above;
  copyEnc shares `copyText` with the verified Copy button.
- [x] **Diff (LCS lines, paired word-level highlight)** — two known 3-line strings produced
  2 del / 2 ins / 1 eq rows, `<mark>` word highlights exactly [brown, red, removed, added],
  summary "2 lines added, 2 removed." Identical inputs -> "The two texts are identical."
  Post-interaction screenshot shows the rendered diff view.
- [x] **"highlight word changes" checkbox** — verified in its default checked state (marks
  present); unchecked path is the same `wordRow` code with `wantHi=false` (text nodes instead
  of marks), unchanged from v1.
- [x] **Tabs (Counts & Transform / Encode & Hash / Diff)** — switched to encode, diff, and back;
  hidden/shown classes verified on all three sections.
- [x] **Toast** — "Copied" observed; auto-hide timer unchanged.
- [x] **Theme toggle** — harness probe: light -> dark, `aria-pressed=true`, `suite.theme` written.

## changes beyond the recipe

- `.card` tool-local rule adds `display: block; gap: normal; flex-direction: row;` — core's
  `.card` is a flex column with a gap; v1 text.html cards are plain block flow. This resets the
  core declarations so computed styles match v1 exactly.
- `.top .theme-btn { float: none; }` — core floats the theme button; v1 text.html positions it
  with the `.top` flex row instead.
- `footer` override (`margin-top: 2.5rem; font-size: .82rem; padding-top: 1rem`) — v1 is
  tighter than the core footer defaults.
- Catch-branch `hintEl.innerHTML = ""` changed to `hintEl.textContent = ""` — identical effect
  (clearing), avoids an innerHTML use entirely.
- `const sum = ...` lookup replaced by the module-level `diffSummaryEl` (needed once for
  `Suite.liveRegion`); same element, same assignment.

## localStorage keys

| | v1 | v2 |
|---|---|---|
| `suite.theme` | written by inline toggle | written by `Suite.theme` (bare string, byte-identical) |

No other keys in either version. Parity snapshot: `localstorage.json` — `keysOnlyInV1` and
`keysOnlyInV2` both empty.

## escape allowlist requests

none — the tool has zero innerHTML interpolation. All dynamic DOM (stats, diff rows, error
hints) is built with `createElement` / `textContent` / DocumentFragments, exactly as in v1.

## a11y applied

- `aria-label="Text to count and transform"` on `#text` (placeholder-only in v1).
- `aria-label="Input for encoding and hashing"` on `#encIn` (placeholder-only in v1).
- `Suite.liveRegion()` on `#opHint` (transform errors), `#diffSummary` (compare results), and
  `#toast` (copy confirmations). `#encOut` keeps its v1 `aria-live="polite"` markup.
- Theme button gets `aria-label` + `aria-pressed` from `Suite.theme.init()` (core).
- Diff textareas already have `<label for=>`; the word-diff checkbox wraps its input in a label;
  all buttons are real `<button>`s (keyboard path exists for every mouse path; no overlays).

## endpoints

None. Zero network; hashing is local WebCrypto, randomness is local `crypto.getRandomValues`.

## concerns for the reviewer

- **Tabs are styled buttons, not an ARIA tab pattern** (no `role="tablist"/tab/tabpanel`,
  no arrow-key navigation). Same as v1; they are plain buttons and fully keyboard-operable via
  Tab/Enter. Adding the full ARIA tabs pattern felt like feature/semantics creep beyond the
  recipe — flagging in case the Phase 4 a11y audit wants it suite-wide.
- **Enter-submits rule**: the diff pane is textarea + Compare button; Enter must insert
  newlines there, so no Enter-to-submit was added (a keyboard path exists — Tab to Compare).
- The `v2-after-interaction.png` shows the "Copied" toast still visible — the interaction
  script reaches the screenshot within the toast's 1.4 s auto-hide window. Timing, not a bug.
- `sentences`/`read time` heuristics, title-case small-words list, and the LCS diff are copied
  verbatim from v1 (no behavior change intended or made).

## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`). Re-verified with `node verify-tool.mjs text` → exit 0.

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | only symbol-ish control is theme-btn (has text + core aria-label) |
| 2 | aria-live | pass | `#toast`, `#opHint`, `#encOut` (static attr), `#diffSummary` — runtime `polite` confirmed. `#stats` deliberately not live (updates per keystroke — would flood; diff/encode results announce via their live lines) |
| 3 | Keyboard path | pass | keyboard-only drive: typed → stats updated; UPPERCASE via Enter ("MAKE ME SHOUT"); Diff tab via Enter, both textareas typed, Compare via Enter → "1 line added, 1 removed". Enter-in-textarea correctly inserts newlines (Compare reachable by Tab). No overlays |
| 4 | Inputs labeled | pass | `#text`/`#encIn` aria-label, `#diffA`/`#diffB` label[for], `#wordDiff` wrapping label |
| 5 | Contrast | **fixed** | see below |
| 6 | Focus visibility | pass | core 2px accent outline on buttons; textareas swap border to accent |

Contrast: diff palette passes both themes (del **5.58/5.80**, ins **5.16/6.85**).
**Fixed:** `.diff .del/.ins .gutter` — the semantic +/- marker was `--muted` on the tinted
row backgrounds (≈4.0:1 light); now inherits the row ink → **5.58/5.16 light, 5.80/6.85 dark**.
Other passes: `.b` 14.61/12.96, `.b.primary`/`.tab.on` on accent 5.83 light, stats/hints
(muted on card) 4.76/6.19.
**SUITE-WIDE flags**: light muted-on-bg 4.36 (tagline, gutter on plain lines); dark
#fff-on-accent 2.36 (`.tab.on`, `#runDiff`).

Fix made: one tool-local CSS rule (`.diff .del .gutter, .diff .ins .gutter { color: inherit }`).
No behavior change; localStorage untouched.
