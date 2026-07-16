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

## Phase 4 a11y audit (2026-07-16)

Independent re-verification of the QUALITY.md §2 checklist, executed in the running tool
(Playwright/Chrome from file://, light + dark, keyboard-only drive of the primary feature,
contrast computed from getComputedStyle with ancestor alpha-compositing).

| # | Checklist item | Verdict | Evidence |
|---|---|---|---|
| 1 | icon-only controls have accessible names | pass | unnamed: (none) |
| 2 | async/result regions carry aria-live | pass | runtime check below |
| 3 | keyboard path for every mouse path | pass | keyboard-only drive log below; no positive tabindex ((none)); no traps |
| 4 | inputs labelled | pass | unlabelled: (none) (labelled: 1) |
| 5 | contrast, both palettes | fixed (see below); remaining FAILs are the suite-wide --muted flags | full pair tables below |
| 6 | visible focus indicator | pass | light: all stops show an indicator; dark: all stops show an indicator |

### Contrast — light
```
contrast pairs (9 unique fg/bg combos):
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.1px/400 — footer "No network — everything happens "
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 13.1px/400 — p.hint "and a few brackets, so codes are"
  pass 4.95 (need 4.5) fg=#2f6f6a bg=#e3efed 13.8px/400 — span.tg.on "a–z lowercase"
  pass 5.26 (need 4.5) fg=#2f6f6a bg=#f5f3ee 14.4px/400 — a.back "← suite"
  pass 5.26 (need 4.5) fg=#f5f3ee bg=#2f6f6a 14.4px/400 — button#tabChar.tab.on "Password"
  pass 5.74 (need 4.5) fg=#2f6f6a bg=#fffdf9 14.7px/400 — button#copy.btn.ghost "Copy"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 25.6px/700 — h1 "Password & Passphrase Generator"
  pass 13.39 (need 4.5) fg=#23282e bg=#f5f3ee 18.4px/400 — div#pw.pw "23Euvj,aAbbBpcNtv-8@"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#regen.btn [outline] -> button#copy.btn [outline] -> button#tabChar.tab [outline] -> button#tabPhrase.tab [outline] -> input#len [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#regen.btn [outline] -> button#copy.btn [outline] -> button#tabChar.tab [outline] -> button#tabPhrase.tab [outline] -> input#len [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline]
```

### Contrast — dark
```
contrast pairs (9 unique fg/bg combos):
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 13.6px/400 — span "Strength:"
  pass 6.3 (need 4.5) fg=#6fb5ae bg=#1f292b 13.8px/400 — span.tg.on "!@#$ symbols"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.1px/400 — footer "No network — everything happens "
  pass 6.91 (need 4.5) fg=#6fb5ae bg=#1d2026 14.7px/400 — button#copy.btn.ghost "Copy"
  pass 7.6 (need 4.5) fg=#6fb5ae bg=#15171b 14.4px/400 — a.back "← suite"
  pass 7.6 (need 4.5) fg=#15171b bg=#6fb5ae 14.7px/400 — button#regen.btn "↻ Generate"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 25.6px/700 — h1 "Password & Passphrase Generator"
  pass 14.25 (need 4.5) fg=#e7e5e0 bg=#15171b 18.4px/400 — div#pw.pw "#Vi0dpB?%?j9{F^W2&Gb"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#regen.btn [outline] -> button#copy.btn [outline] -> button#tabChar.tab [outline] -> button#tabPhrase.tab [outline] -> input#len [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#regen.btn [outline] -> button#copy.btn [outline] -> button#tabChar.tab [outline] -> button#tabPhrase.tab [outline] -> input#len [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline] -> span.tg [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached regenerate button (BUTTON#regen after 3 tab(s))
  Enter on regen -> new password generated
  Tab -> reached copy button (BUTTON#copy after 1 tab(s))
  Enter on copy -> toast "Copied to clipboard" (aria-live=polite)
  Tab -> reached passphrase tab (BUTTON#tabPhrase after 2 tab(s))
  Enter on phrase tab -> panel shown=true
  Tab -> reached Capitalize pill (span role=button) (SPAN after 3 tab(s))
  Space on pill -> aria-pressed=true
  Enter on pill -> aria-pressed=false
  Tab -> reached words range slider (INPUT#words after 9 tab(s))
  ArrowRight on slider -> words 6 -> 7 (regenerated)

### aria-live runtime check
  #pw: aria-live=polite
  #toast: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
- `.btn` and `.tab.on` text `#fff` -> `var(--bg)` (2.36:1 on the dark accent -> 7.60:1). Embedded EFF wordlist untouched (hash below).

### Notes
- The `.tg` option pills (span role=button tabindex=0) honor both Enter and Space, flip aria-pressed, and sit in the natural tab order — verified keyboard-only. Sliders respond to arrow keys and regenerate.

### Suite-wide contrast flags (REPORTED, not fixed locally — core palette)

The light palette's `--muted` (#6b7280) misses WCAG AA 4.5:1 on two core surfaces
(it passes on `--card` at 4.76, and the dark palette passes everywhere, 5.5-6.8):

| pair | ratio | where it shows in this tool set |
|---|---|---|
| `--muted` on `--bg` #f5f3ee | **4.36** | core `footer` rule; tool taglines/hints/stamps on the page background (every tool) |
| `--muted` on `--chip` #efece4 | **4.10** | core `.chip`; tool-local chip-bg recreations (jobs #dataStamp, markets .caveat, settings/transit/passes `code`, airport chips, hub chips) |
| `--muted` on `--accent-soft` #e3efed | **4.11** | parks `.code` chip inside picker rows |

Root cause is the palette value, not any one tool: per the audit addendum these are
suite-wide failures — fixing them tool-by-tool would fork the palette across 71 files.
Suggested one-line core remedy (NOT applied): darken light `--muted` to ~#5f6670
(-> 5.23 on --bg, 4.91 on --chip, 5.71 on --card). Decision belongs to core.

### Harness re-runs
- `node verify-tool.mjs password` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
- Embedded-data byte parity: python re-extraction of EFF_WORDS after the edit: 62143 bytes, sha256 c523ba7b5e0d3f77cc6cf0d83bed3f250143c0c90c255d6a646dd992f8453675, 7776/7776 unique words — identical to the recorded v1/v2 hash.
