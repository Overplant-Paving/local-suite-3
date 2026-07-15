# random.html migration report — Decision Maker (Batch A)

Evidence: this directory (`tests/evidence/random/`). Harness run `node verify-tool.mjs random`
exited 0; console clean.

## v1 feature walk-through

- [x] **Tabs (dice / coin / spinner / pick / number)** — rendered dynamically, switching shows
  exactly one panel. Verified: interaction switches through all five tabs (interaction.txt lines
  6-14 each act inside a different panel); spinner tab triggers `drawWheel()` on show (spin
  succeeded after tab switch).
- [x] **Dice: count clamp 1-100, sides 4/6/8/10/12/20/100, per-die faces, total, sub line, log
  entry** — 3x `5d6` rolls: all faces observed in 1..6, displayed total equals sum of faces
  every time; `1d20` roll gave 8 (in range) and the sub line collapses to "1d20" (no "total of"
  suffix for a single die), matching v1's conditional. Log entries written per roll.
- [x] **Coin: flip, face H/T, gold/silver gradient swap, tally, streak dots (last 40), reset
  run** — 5 flips gave `[H, T, H, H, T]`, tally "Heads 3 · Tails 2" (sums to 5), streak string
  "HTHHT" (5 dots, order preserved). Reset run: face back to "?", tally zeroed, 0 streak dots.
  Gradient swap is the same inline-style code path as v1 (verbatim), face letters observed
  flipping.
- [x] **Spinner: editable labels, live redraw on input, "Update wheel", animated spin (5-7
  turns, 4200 ms ease-out), winner chosen by crypto randomness before animation, celebration
  result, log** — entered a custom 4-label wheel (Red/Green/Blue/Yellow), updated, spun under
  `page.clock` (installed first, advanced 4500 ms): result "🎉 Red", in the entered list.
  Animation math kept verbatim.
- [x] **Spin guards** — `items.length < 2 || spinning` early-return kept verbatim (code
  identical to v1; not separately exercised).
- [x] **Pick from list: custom options, pick N, no-repeat shuffle path, with-repeat sampling
  path, N clamping** — custom 5-planet list: pick 3 no-repeat -> 3 unique items, all from the
  list; pick 9 no-repeat -> input clamped to 5, 5 unique; pick 8 with repeats -> 8 items, all
  from the list, repeats present. Log entries written.
- [x] **Number: inclusive min/max, swapped-bounds tolerance, non-finite fallback to 0** —
  5 picks in 10..20 all in range; min=30/max=25 swapped internally, result 29 in 25..30.
  Non-finite fallback code kept verbatim.
- [x] **Recent-results log: newest first, 60-entry cap, timestamps, clear button, "Nothing
  yet." placeholder** — after the full pass the log held 20 entries with the newest action
  first; clear restored the single "Nothing yet." placeholder row. 60-cap code verbatim.
- [x] **Enter in an input/select triggers the panel's Go button** — Enter in `#numMin`
  produced a new number result (30, in 25..30).
- [x] **Crypto randomness (rejection sampling)** — `randInt`, `randFloat`, `shuffle` survive
  **byte-for-byte verbatim** from v1 (comments included), per the standing instruction not to
  simplify the randomness. All observed outputs were in their proper ranges.
- [x] **Theme toggle** — via `Suite.theme.init()`; harness probe: light -> dark,
  `aria-pressed=true`, `suite.theme` written.

## changes beyond the recipe

- Tool-local CSS overrides where v1 random differs from core defaults (visual parity, computed
  diff clean):
  - `.back` restored to v1's pill style (core's is a plain accent text link); hover keeps
    `text-decoration: none` to neutralize core's underline.
  - `.theme-btn { float: none; }` — header is flex here; keeps computed-value parity with v1
    (core's `float: right` is inert on a flex item anyway).
  - `.card` restored to v1's block layout (`display: block; flex-direction: row; gap: normal;`
    padding 1.3rem, margin-bottom 1.2rem) — core's `.card` is a flex column. Same convention as
    tools/dates.html.
  - `footer { margin-top: 2.5rem; font-size: .84rem; text-align: center; }` — v1 differs from
    the core footer values.
- Tool accent `--warn` kept in all four theme contexts (declared in v1; currently unused by any
  rule, preserved rather than removed).
- Live-region placement judgment call: the recent-results log is deliberately **not** a live
  region because every action already announces via its panel's live result container; a live
  log would double-announce each result (comment in source).
- Tab buttons get `aria-pressed` reflecting the active tab (they are toggle-style buttons, not
  a full ARIA tablist — no keyboard behavior contract added or changed).
- No other logic changes: script is v1 verbatim apart from theme-block removal,
  `addEventListener` conversions, and the a11y attribute additions listed below.

## localStorage keys

| | v1 | v2 |
|---|---|---|
| `suite.theme` | yes (bare string) | yes (bare string via `Suite.store`) |

The tool persists nothing else in v1 — spinner labels, pick lists, coin tallies, and the
results log are all session-only — and v2 matches (interaction.txt final line: only
`suite.theme` present after exercising every panel; localstorage.json `keysOnlyInV1`/`V2` both
empty). There is no list-persistence key to carry over.

## escape allowlist requests

none — the tool has no `innerHTML` interpolation at all; every dynamic node is built with
`createElement`/`textContent` (unchanged from v1).

## a11y applied

- `Suite.liveRegion()` on `#diceTotal`, `#coinTally`, `#spinResult`, `#pickResult`,
  `#numResult` (each panel's result container announces after user action).
- Canvas `#wheel` given `role="img"` + `aria-label="Spinner wheel"` (its outcome is announced
  through the live `#spinResult`).
- Tab buttons: `aria-pressed` state.
- Theme button labeled + `aria-pressed` by core (`Suite.theme.init`).
- Inputs: all already had `<label for>` in v1 (verified: diceCount, diceSides, spinLabels,
  pickList, pickN, noRepeat, numMin, numMax) — nothing to add.
- Enter-submits already existed in v1 for every input/select + Go pair (kept; verified).
- Icon-only buttons: none (all buttons carry text). Overlays/Esc: none exist.
- Keyboard path: all actions are native buttons/inputs; no mouse-only path.

## endpoints

none — zero network (`crypto.getRandomValues` only). `endpoints: []` in manifest-entry.json.

## concerns for the reviewer

- **Computed-style diff:** only the pre-approved `-webkit-font-smoothing: antialiased` (12
  selectors x 2 themes, from the core body rule). Nothing else differs.
- **Spinner verified under a fake clock**, not wall-clock: `page.clock.install()` +
  `runFor(4500)`. The animation completed and produced a correct winner, but real-time visual
  smoothness of the 4200 ms ease-out was not separately eyeballed (code is v1-verbatim, so risk
  is low).
- **`aria-pressed` on tabs** is a pragmatic choice; a purist would want `role="tablist"` with
  arrow-key navigation. I avoided that because it imposes a keyboard contract v1 never had and
  the recipe forbids adding features beyond a11y attributes; flag if you'd rather have the full
  tablist pattern suite-wide.
- The after-interaction screenshot is dark-themed because the harness's theme-toggle probe runs
  before the shot — expected harness behavior, not a defect.
- `--warn` is defined but unused in v1 and v2 alike; preserved to stay faithful. Could be
  dropped suite-wide later if you prefer dead-CSS removal.
