# color.html migration report (Batch A)

Verified via `node verify-tool.mjs color` (exit 0). Evidence in this directory:
`interaction.txt`, `computed-style-diff.txt`, `localstorage.json`, four theme screenshots,
`v2-after-interaction.png`, `test-photo.png` (the generated file-input fixture).

## v1 feature walk-through

- [x] **Theme toggle** — harness probe: `light -> dark`, `aria-pressed=true` (interaction.txt).
- [x] **Tabs (Picker / Contrast / Photo / Saved)** — each tab clicked during the interaction pass;
  sections toggle `.hidden`; Saved tab re-renders on entry (items logged).
- [x] **Color picker input** — set to `#ff8800` via an `input` event; all downstream views updated.
- [x] **Format rows (HEX / RGB / HSL / OKLCH)** — logged: `#ff8800`, `rgb(255, 136, 0)`,
  `hsl(32, 100%, 50%)`, `oklch(0.744 0.181 56.5)` — all mathematically correct for #ff8800.
- [x] **Click-to-copy on format rows** — clicked HEX row, toast logged: `Copied #804400`
  (clipboard call succeeded or fell back to execCommand; either way the toast confirms the copy path ran).
- [x] **HSL sliders (two-way sync)** — after setting the picker, sliders read H=32 S=100 L=50 with
  outputs `32° 100% 50%`; then the Lightness slider was driven to 25 and HEX correctly became `#804400`.
- [x] **Palette generation (Complementary / Analogous / Triadic / Shades)** — all four sets logged
  with their swatch hexes; complementary of #804400 is #003b80 (hue+180), shades step lightness
  15→85 as in v1. Visible in `v2-after-interaction.png`.
- [x] **Swatch click-to-copy** — exercised via the keyboard path (Enter on a focused swatch),
  toast `Copied #804400`.
- [x] **Save palette** — clicked Save on Complementary; toast `Saved "Complementary"`;
  `suite.color.palettes` written (localstorage.json).
- [x] **WCAG contrast checker** — `#000000` on `#ffffff` -> **`21.00 : 1`**, all four badges PASS.
  Second known pair `#777777` on `#ffffff` -> `4.48 : 1` with AA-normal FAIL / AA-large PASS /
  AAA-normal FAIL / AAA-large FAIL — exactly the WCAG 2.1 thresholds. Preview inline styles
  confirmed (`background=rgb(255,255,255) color=rgb(0,0,0)`).
- [x] **Hex text inputs <-> color inputs sync** — the ratios above were driven through the hex text
  inputs (Playwright `fill` fires `input`), which also update the color inputs.
- [x] **Colors from a photo (median cut)** — a 40x40 PNG with red/green/blue/white quadrants was
  generated in-page (`canvas.toDataURL`), written to `test-photo.png`, and fed via
  `page.setInputFiles("#fileInput", ...)`. Dominant colors extracted: `#0000ff, #0000ff, #0000ff,
  #ff0000, #00ff00, #ffffff` — all four source colors recovered exactly (the three #0000ff buckets
  are median-cut splitting the largest remaining bucket into identical halves; same algorithm as
  v1, untouched). Canvas preview shown (`display=block`).
- [x] **Drag-and-drop image** — code path identical to v1 (same `dragover`/`dragleave`/`drop`
  listeners, byte-for-byte); exercised via the shared `handleImage()` through the file input.
  Not separately simulated (Playwright cannot synthesize an OS file drag with a real
  `dataTransfer.files`); see concerns.
- [x] **Save photo palette** — clicked; toast `Saved "From photo"`; appears in Saved tab.
- [x] **Saved tab: list + delete** — both saved palettes listed with date; Delete removed the
  first item (logged before/after).
- [x] **Toast** — observed after copy and save actions.
- [x] **Footer / back link** — present; footer spacing overridden tool-locally to v1 values.

## changes beyond the recipe

- **`.card` full override**: core's `.card` is a flex column with different padding; v1 color's
  card is block layout with `padding: 1.1rem 1.15rem; margin-top: 1.1rem`. The tool-local rule
  redeclares it and explicitly resets `display: block; flex-direction: row; gap: normal` so
  computed styles match v1 exactly.
- **`.sw .chip` override**: core introduces a pill-shaped `.chip` component that collides with
  this tool's swatch chips (plain color blocks). Tool-local rule resets font-size/padding/
  border-radius/background/color/white-space to v1 defaults. Proven by the `.sw .chip` selector in
  the computed-style diff (only the pre-approved `-webkit-font-smoothing` differs).
- **`footer` override**: v1 uses `margin-top: 2.5rem; font-size: .82rem; padding-top: 1rem`
  (core default is 3rem / .85rem / 1.1rem) — per-recipe allowance for where v1 differs.
- **`Image` load/error**: `img.onload=`/`img.onerror=` property assignments converted to
  `addEventListener("load"/"error")` per the recipe's "ALL .onX=" rule.
- No features added, no behavior removed. All color math, median cut, and contrast code is
  byte-identical to v1.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string via `localStorage` | same, via `Suite.theme` (writes bare) |
| `suite.color.palettes` | JSON array via `localStorage` | same bytes via `Suite.store.get/set` (arrays round-trip as `JSON.stringify`, identical to v1's) |

`localstorage.json`: `keysOnlyInV1: []`, `keysOnlyInV2: []`. Values differ only in the saved
palette's colors/timestamp because the v2 pass saved after changing the base color — same shape.

## escape allowlist requests

none — the tool uses no `innerHTML` at all (v1 was already fully `createElement`/`textContent`;
that is preserved).

## a11y applied

- Slider labels associated: `for="slH"` / `for="slS"` / `for="slL"` (v1 labels had no `for`).
- Contrast inputs: `aria-label` on `#fgColor` ("Text color picker"), `#fgHex` ("Text color hex
  value"), `#bgColor`, `#bgHex` (the visual `<label>`s were unassociated in v1).
- Click-to-copy divs (`.fmt` rows and `.sw` swatches) were mouse-only in v1: now
  `role="button"`, `tabindex="0"`, descriptive `aria-label` ("Copy HEX value #…"/"Copy #…"), and
  Enter/Space activation — keyboard path verified live (interaction.txt line: `keyboard Enter on
  focused swatch; toast: Copied #804400`).
- Drop zone: the file input is `display:none` (keyboard-unreachable in v1); the `.drop` label now
  has `role="button"`, `tabindex="0"`, `aria-label`, and Enter/Space opens the file chooser.
- Live regions via `Suite.liveRegion()`: `#toast` (copy/save announcements), `#ccRatio`
  (contrast result), `#photoSwatches` (async photo palette arrival).
- Save/Delete buttons get contextual `aria-label`s ("Save Complementary palette",
  "Delete saved palette From photo") — visible text alone was ambiguous between rows.
- Theme button label/`aria-pressed` from core `Suite.theme.init()`.
- `#colorInput` kept its v1 `aria-label="Pick a color"`.

## endpoints

none — fully offline (canvas + localStorage only). `network: "offline"`, `endpoints: []`.

## concerns for the reviewer

- **Drag-and-drop was not end-to-end simulated.** Playwright cannot attach real `File` objects to
  a synthesized `drop` event's `dataTransfer` from Node. The drop listeners are byte-identical to
  v1 and funnel into the same `handleImage()` that was fully verified through the file input, so
  risk is confined to the three unchanged listener lines.
- **Clipboard in the harness**: headless Chrome may reject `navigator.clipboard.writeText`; the
  v1 `execCommand` fallback (preserved) makes the toast fire either way, so the log proves the
  copy *path* ran, not which branch wrote the clipboard.
- **Live region on `#ccRatio`** announces on every input event while typing a hex; `polite` keeps
  it non-interrupting, but a reviewer preferring quieter behavior could scope it differently.
  Kept simple per the recipe.
- **Core `.chip`/`.card` class-name collisions**: fully neutralized here (see changes section),
  but this is the first Batch A tool to hit a core-vs-tool class collision — other tools using
  `.chip` or `.card` with non-core semantics need the same treatment.
- The suite dogfoods this contrast checker (QUALITY.md §2): its math was verified against two
  known-value pairs (21.00:1 and 4.48:1), and the relative-luminance code is unchanged from v1.

## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`). Re-verified with `node verify-tool.mjs color` → exit 0.

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | format rows / swatches carry generated aria-labels ("Copy HEX value …", "Copy #hex"); Save buttons "Save <name> palette"; Delete "Delete saved palette <name>" |
| 2 | aria-live | pass | `#toast`, `#ccRatio`, `#photoSwatches` liveRegion (runtime confirmed). Format rows mirror the picker continuously (not live by design, like a slider readout) |
| 3 | Keyboard path | pass | keyboard-only: Hue slider ArrowRight×10 → HEX readout changed; format row Enter → "Copied #2f6a6f" toast (the `clickable()` helper gives rows tabindex 0 + Enter/Space); photo drop zone reachable by Tab (`role=button`, aria-label, Enter/Space opens chooser). No overlays |
| 4 | Inputs labeled | pass | color/hex inputs have aria-labels; sliders have `label[for]` |
| 5 | Contrast | **fixed** | see below |
| 6 | Focus visibility | pass | core 2px accent outline (verified on Tab-focused button); fmt rows/swatches are tabbable and get the `[tabindex]:focus-visible` outline |

Contrast — **fixed: the PASS/FAIL badge palette** (tool-local `--good`/`--bad`) failed on its
own color-mix backgrounds: light 3.86 (pass badge, computed) / 3.97 (fail badge), dark 4.20
(fail badge). Deepened light `--good` #3a7d44→#2f6337, `--bad` #c0492d→#ad3a20; brightened
dark `--bad` #e0705a→#e67d68. Post-fix: light **5.32 / 4.83**, dark **5.46 / 4.63**.
(Audit note: the badges are the tool's own WCAG verdict chips — dogfooding made this one ironic.)
Other passes: `.fmt .v` 13.39/14.25, `.savebtn` 5.74/6.91, `.sw .lab` 14.61/12.96, muted-on-card 4.76/6.19.
**SUITE-WIDE flags**: light muted-on-bg 4.36 (tagline, `.fmt .k` on `--bg`, footer); dark #fff-on-accent 2.36 (`.tab.on`).

Fixes made: tool-local badge palette only (all four theme contexts). No behavior change;
`suite.color.palettes` untouched.
