# convert.html migration report (Phase 2, Batch A)

## v1 feature walk-through

Every v1 feature, each verified against the v2 source via the harness run
(`interaction.txt`) or the screenshots in this directory:

- [x] **8 category tabs** (Length, Area, Volume, Weight, Temperature, Fuel economy,
  Cooking, Recipe scaler) rendered as pills; clicking switches the visible card and
  re-highlights the pill — verified by the interaction pass, which visits 7 of the 8
  tabs and observes card visibility flip (`Cooking tab: cookCard hidden=false,
  genCard hidden=true`); post-interaction screenshot shows the Recipe scaler pill "on".
- [x] **Generic converter, factor-based categories** (Length/Area/Volume/Weight):
  known-value checks logged expected vs actual — 1 km → 3,280.84 ft / 39,370.08 in;
  2 US cup → 473.17647 mL / 0.47318 liter / 32 tablespoon; "1 ½" pound → 680.38856 g /
  24 ounce. All match.
- [x] **Generic converter, custom categories**: Temperature 350 °F → 176.66667 °C /
  449.81667 K; Fuel economy 30 mpg (US) → 7.84049 L/100km. Both match.
- [x] **Unit list rebuilt per category; "from" unit highlighted `.hot`** — verified
  visually (km cell shows ink-colored value in screenshots) and by `selectOption`
  succeeding on category-specific units (°F, pound, mpg (US), US cup).
- [x] **Number parsing**: unicode fractions with a whole number ("1 ½") parsed in the
  Amount field — verified (680.38856 g). Commas stripped, ascii fractions and decimals
  covered by the same `parseNum` (unchanged verbatim from v1).
- [x] **Ingredient (density) converter**: 2 cup All-purpose flour → 250.78353 g /
  8.84613 oz, round-trips to 2 cups; reverse direction 250 g Granulated sugar →
  1.24316 cups. Density hint line renders "Density used: 0.53 g/mL (1 cup ≈ 125 g)."
  All match hand-computed expectations.
- [x] **Recipe scaler**: default six-line recipe present on load; ×2 gives
  "4 cups … / 3 tsp … / 1 1/2 cup sugar / 6 large eggs / 1 tsp salt / 2 cup milk";
  custom ×1.5 gives "3 cups … / 2 1/4 tsp … / 1 1/8 cup sugar …" and clears the
  preset button highlight; × ½ gives "1 cups … / 3/4 tsp … / 3/8 cup sugar".
  Mixed numbers, unicode fractions, and clean-fraction output (`fmtQty`) all observed.
- [x] **Theme toggle + persistence**: harness clicks the button — `light -> dark`,
  `aria-pressed=true`, `suite.theme` written (see `localstorage.json`).
- [x] **Footer / header / tag copy**: byte-identical markup; screenshots match.

Embedded conversion tables (`CATS`, `DENS`, `VOL_ML`, `WT_G`, `FRAC`) survive
**verbatim** — copied unchanged from v1, no value touched.

## changes beyond the recipe

- Core `suite.css` gives `.card { display:flex; flex-direction:column; gap:.55rem }`.
  v1 convert cards are plain blocks and rely on the `hidden` attribute (an author
  `display` on `.card` would defeat the UA `[hidden]{display:none}` rule). The
  tool-local `.card` rule therefore resets `display:block; flex-direction:row;
  gap:normal` and adds `.card[hidden] { display:none }`. Computed-style diff confirms
  parity (zero non-approved diffs).
- Core `.theme-btn` has `float:right`; v1 convert positions the button in a flex
  topbar with no float — tool-local `.topbar .theme-btn { float:none }` restores the
  v1 computed value.
- Pills' `b.onclick = …` property assignment converted to `addEventListener` (recipe
  requires it); scale-button and custom-scale handlers were already listeners.
- v1's unused `.big` CSS rule kept (nothing removed).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | written by the inline theme script (bare string) | written by `Suite.theme` (bare string) |

Only key the tool touches, in both versions. `localstorage.json`:
`keysOnlyInV1: []`, `keysOnlyInV2: []` — parity exact.

## escape allowlist requests

none — the only `innerHTML` uses are bare `= ""` clears; all dynamic DOM is built
with `createElement`/`textContent` (unchanged v1 pattern).

## a11y applied

- `<label for=…>` added on every labeled control: `genValue`, `genUnit`, `cookValue`,
  `cookUnit`, `cookIng`, `customScale`, `recipeOut` (v1 labels had no `for`).
- `aria-label="Recipe ingredient lines"` on the `recipeIn` textarea (had no label).
- `Suite.liveRegion()` on the three result containers that update after user input:
  `#genResults`, `#cookResults`, `#cookDensity`.
- `aria-pressed` state on the category pills and the recipe scale buttons (toggled in
  sync with the `.on` class).
- Theme button label/`aria-pressed` from core (`Suite.theme.init`), verified in the
  harness (`aria-pressed=true` after toggle).
- Keyboard: all interactive elements are native `button`/`input`/`select`/`textarea`;
  conversions run live on `input` (no Enter-to-submit pair exists); no overlays.

## endpoints

none — fully offline, embedded tables only. `endpoints: []`.

## concerns for the reviewer

- The `.card` flex-reset override (above) is the one structural CSS deviation from a
  pure strip-and-keep; without it the core class breaks both layout and the `hidden`
  attribute. The computed-style diff (12 values per theme, all the pre-approved
  `-webkit-font-smoothing`) shows it lands exactly on v1.
- `interaction.txt` line 19 shows "1 cups all-purpose flour" for × ½ — grammatically
  odd but **identical to v1 behavior** (the scaler rewrites only the leading quantity,
  never pluralization). Not a regression.
- The first harness run had two wrong *expected* annotations in my log messages (I
  mislabeled the default Length unit as m instead of km, and miscomputed the sugar
  cups value); the tool output was correct both times. Fixed the annotations and
  re-ran; the committed evidence is the clean second run.
- `tests/interactions/` did not exist before this migration (the pilots pre-date the
  shared harness modules); this tool's module is the first file in it — created as a
  deliverable, no existing files touched.

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/convert.html` from `file://`, light + dark
(raw log: `phase4-a11y-audit.txt`). **Verdict: pass-as-was — no tool changes.**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass (n/a) | none (scale buttons "× ½" etc. read as text and carry aria-pressed) |
| 2 | async regions aria-live | pass | `#genResults`, `#cookResults`, `#cookDensity` = polite; `#recipeOut` is a readonly textarea (form field — readable on focus, not a live region by design) |
| 3 | keyboard paths | pass | keyboard-only drive: Enter on Temperature pill (aria-pressed=true), typed 100 + ArrowDown to °F → 37.77778 °C / 310.92778 K announced; Enter on Recipe-scaler pill, Enter on ×2 → "4 cups all-purpose flour", custom ×1.5 → "3 cups"; no traps |
| 4 | input labels | pass | all inputs/selects via `label[for]` or aria-label (`#recipeIn`) |
| 5 | contrast both palettes | pass (tool-local) | all tool pairs ≥4.76 (L) / ≥6.19 (D); only the two suite-wide pairs below fail |
| 6 | focus visibility | pass | 2px accent outline on every stop, both themes |

SUITE-WIDE flags: muted-on-`--bg` 4.36 light (footer); white-on-accent 2.36 dark (`.pill.on`).
