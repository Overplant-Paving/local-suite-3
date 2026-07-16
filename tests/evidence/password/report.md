# password.html migration report (Phase 2, Batch D — large embedded data)

Migrated `../Local Suite/password.html` → `tools/password.html`. Verified with
`node verify-tool.mjs password` (exit 0); all evidence in this directory.
Batch D extra deliverable: `data-integrity.txt` (byte-exact wordlist proof, replayable
extraction one-liner for the post-build dist check).

## v1 feature walk-through

Each feature exercised via `tests/interactions/password.mjs`; observed values in
`interaction.txt`. `crypto.getRandomValues` was replaced mid-session with a seedable
xorshift32 (`window.__seedRng`), and the module re-implements v1's rejection-sampling +
generation algorithms on the same seed, so every generated value is checked against an
**independent word-for-word / char-for-char prediction**, not just eyeballed.

- [x] **Char password on load (default 20, all four classes)** — pre-stub, real crypto:
  `"LYA7QDx-&6hIm{_R9YGQ"`, 129 bits, "Overkill", bar 100% var(--good), crack
  "7.8e15 millenniums".
- [x] **Generate button** — seed 0xC0FFEE produced `"a=YD0oT:/kP7%^On{luh"`; independent
  replica predicted the identical string (match=true).
- [x] **Entropy display (char)** — displayed 129 = round(20 × log2(86)) = round(128.53);
  pool recomputed independently as 26+26+10+24 = 86.
- [x] **Length slider 6–64 + live value** — set to 32: `#lenval` shows "32", output length
  32, prediction match=true, 206 bits displayed = independent recompute.
- [x] **Character-class toggles** — symbols and digits off, look-alikes on (seed 7): output
  is 32 chars, every char in the independently filtered 45-char pool, zero look-alikes,
  prediction match=true, 176 bits = recompute.
- [x] **"Keep at least one set" guard** — with only lowercase active, clicking it is refused:
  toast "Keep at least one set", pill stays on (class + aria-pressed).
- [x] **Strength ladder low end** — 6 chars, lowercase noAmbig (24-char pool): 28 bits
  (= recompute), "Very weak", bar 12%, crack "under a second".
- [x] **Tab switch Password ↔ Passphrase** — phrase panel shown, char panel hidden,
  aria-pressed follows; regeneration fires on switch (v1 behavior).
- [x] **Passphrase, 6 words, dash** — seed 2026: `"stillness-salsa-commode-setup-playpen-styling"`;
  independent prediction identical; 6 words, all present in the embedded EFF list.
- [x] **Entropy display (phrase)** — displayed 78 = round(6 × log2(7776)) = round(77.5489)
  (the addendum's required sanity recomputation); "Strong", crack "3.5 millenniums"
  (independently consistent with 2^(bits−1)/1e10 s through v1's unit chain).
- [x] **Words slider 3–12 + live value** — 4 words: `#wordsval` "4", 52 bits (= recompute),
  prediction match=true.
- [x] **Separator select (dash/space/dot/underscore/comma/none)** — space and dot exercised;
  output joined accordingly, prediction match=true each time.
- [x] **Capitalize words** — all 4 words start uppercase; adds no entropy (bits unchanged
  by cap alone), prediction match=true.
- [x] **Add a random number** — output ends `.d` (single digit after separator); bits 55 =
  round(4 × log2(7776) + log2(10)) = round(55.02).
- [x] **Copy path (both branches)** — clipboard API spied: captured text equals the displayed
  password, toast "Copied to clipboard" with `.show`; then clipboard forced to reject →
  `document.execCommand("copy")` fallback invoked, same toast.
- [x] **Toast** — text + show/hide class observed; now also `aria-live="polite"` (a11y).
- [x] **Theme toggle** — harness probe: light → dark, `aria-pressed=true`, persisted to
  `suite.theme` (v1 parity snapshot equal).
- [x] **EFF wordlist (the LD segment)** — live page: `EFF_WORDS.length` = 7776, all unique;
  byte-exact hash proof in `data-integrity.txt` (v1 = v2 =
  `c523ba7b…3675`, 62,143 bytes, 7,776 words).
- [x] **randInt / pick / shuffle (rejection-sampled crypto)** — copied verbatim from v1;
  proven live by the deterministic predictions above (536 Uint32 draws served by the stub).

## changes beyond the recipe

- **Wordlist splice, not retype**: `tools/password.html` was written with a placeholder and
  v1's entire `const EFF_WORDS…` statement (62,175 bytes) spliced in with a binary-mode
  Python replace — recipe conversions stopped at the segment boundary per the Batch D
  addendum. Hashes in `data-integrity.txt`.
- `.card` tool rule gained `display: block; gap: normal; flex-direction: row;` — core makes
  `.card` a flex column; v1 password cards flow normally (same pattern as tools/text.html,
  tools/qr.html). `.out` keeps its own flex row exactly as v1.
- `.top .theme-btn { float: none; }` — v1 places the button in a flex row; core floats it
  (pattern from tools/text.html; keeps the computed-style diff clean).
- Footer override kept tool-local where v1 differs from core: `margin-top: 2.5rem;
  font-size: .82rem; padding-top: 1rem` (core has 3rem / .85rem / 1.1rem).
- `--weak / --ok / --good` extracted into the four-context tool-accent block, values
  identical to v1's palette blocks.
- All `.onclick / .oninput / .onchange` property assignments → `addEventListener` (recipe);
  no inline handler attributes existed.
- v1's theme-toggle script + `suite.theme` reads removed → `Suite.theme.init()`.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | written by theme toggle | written by `Suite.theme` (bare string, identical) |

No other keys — generator state is deliberately session-only in v1 and stays so.
`localstorage.json`: keysOnlyInV1 = [], keysOnlyInV2 = [].

## escape allowlist requests

none — the tool contains zero `innerHTML` sites (v1 and v2 both render exclusively via
`textContent` / class toggles / style properties).

## a11y applied

- Pill toggles (`.tg`) are `<span>`s in v1 with no keyboard path — added `role="button"`,
  `tabindex="0"`, `aria-pressed` (synced on every toggle), and Enter/Space activation
  (`wireToggle`). Verified in `interaction.txt` (Enter flips off, Space flips back on).
- Tabs got `aria-pressed` (synced) and the `.tabs` container `role="group"` +
  `aria-label="Generator mode"`.
- Toast marked `Suite.liveRegion` (`aria-live="polite"`) so "Copied to clipboard" /
  "Keep at least one set" are announced.
- `#pw` already had `aria-live="polite"` in v1 (kept). The strength meter was deliberately
  NOT made a second live region: it updates simultaneously with `#pw` on every action and a
  second polite region would double-announce.
- All inputs labeled in v1 (`for="len"/"words"/"sep"`) — kept; buttons have visible text;
  theme button labeled by core.
- Core provides `:focus-visible` outlines (matters now that pills are focusable) and the
  reduced-motion guard.

## endpoints

none — zero-network tool (`network: "offline"`, `endpoints: []`). The footer's no-network
claim was implicitly verified: the interaction run's console shows no failed requests and
the harness records no `net::ERR` entries.

## concerns for the reviewer

- **Post-build hash is the orchestrator's half**: `data-integrity.txt` carries the exact
  one-liner; it must be replayed against `dist/password.html` after integration and the
  dist hash appended. If the build ever normalizes whitespace/quotes inside scripts, this
  is the file that would catch it.
- The computed-style diff is clean except the pre-approved `-webkit-font-smoothing`
  (18 selectors × both themes, nothing else).
- `page.keyboard.press("Space")` in the keyboard test produces `e.key === " "` — the handler
  checks both `"Enter"` and `" "`; older browsers reporting `"Spacebar"` would not match,
  consistent with the suite's modern-browser baseline.
- The `role="group"` + `aria-pressed` treatment of the two mode tabs (rather than a full
  ARIA tabs pattern with `role="tablist"/"tab"/"tabpanel"`) was chosen to stay minimal and
  match how the suite's other migrated tab UIs were handled; flagging in case the Phase 4
  a11y re-verification wants the full pattern suite-wide.
- The initial on-load password is generated with real `crypto.getRandomValues` (logged
  pre-stub); all deterministic assertions apply to post-stub generations only — by design.
