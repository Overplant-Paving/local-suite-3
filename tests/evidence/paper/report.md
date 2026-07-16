# paper.html — migration report (Phase 2, Batch A)

(Archived by the orchestrator from the migration agent's final message.)

Evidence: this directory. Harness run: `node verify-tool.mjs paper` — exit 0, console clean.

## v1 feature walk-through

- [x] Graph/grid: Letter portrait 5mm -> 92 lines, heavy cadence stroke 0.324.
- [x] Dot grid: 336 circles, 0 lines. Lined: 38 lines college 7.1mm, preset select shown only here.
- [x] Isometric: 47 clipped lines. Music: 75 lines = 15 staves, stroke 0.234. Handwriting: 51 lines
  = 17 bands incl. dashed midline. Battleship: 44 lines + 42 labels.
- [x] Sizes Letter/A4 (215.9x279.4 / 210x297 mm), orientation control, margins + full-bleed "0"
  (37->41 lines), spacing value+unit (mm/cm/in), heavy-every-N, ruling presets + red margin line
  (uncheck removes exactly 1 line), weights (0.4 -> 0.72 heavy), color picker + 7 swatches,
  border box (third rect), Download SVG (real download, paper-graph-a4.svg).
- [x] Print/Save PDF wired to window.print (not clickable headless).
- [x] PRINT CSS (the product): @page + @media print block byte-identical to v1 (359-char string
  compare === true; references only #fff). v1-print.png and v2-print.png are SHA256-IDENTICAL
  (7BE1B20C...AA5DCD). Print fidelity: exact.
- [x] Type-dependent control visibility; theme toggle + suite.theme persistence.

## changes beyond the recipe

- .back/.theme-btn absolute positioning kept tool-local (v1 header layout); footer override;
  local `esc()` here is an SVG number-rounding helper, unrelated to Suite.esc, kept.
- render() also updates the preview aria-label (a11y only). Renderers/SVG builder verbatim v1.

## localStorage keys

Only suite.theme, byte-identical; key diffs empty.

## escape allowlist requests

None flagged (innerHTML assigns a variable). All SVG interpolations local: rounded numbers via
the local esc() helper, browser-normalized #rrggbb from input[type=color], `${s}` in txt() only
ever local constants ("YOUR FLEET", "TRACKING / SALVOS", A-J, 1-10), `${dash}` literal "1.4 1.4".

## a11y applied

aria-label on #type, label for= on size/margin/spacing/unit/heavy/ruled/weight/weightMaj,
role=group on orientation, aria-label on bleed button + swatches + #color, preview is
Suite.liveRegion + role=img with render()-synced label. Native controls = full keyboard path.

## endpoints

None. endpoints: [].

## concerns for the reviewer

- Print proof is print-media emulation, not a rasterized PDF measurement (mm-sized SVG attribute
  survives verbatim).
- for= label fixes are edits inside v1 markup — re-diff recommended (orchestrator does).
- aria-live on role=img container may be silent on some SRs (no worse than v1).
- Dot-grid node-count perf ceiling inherited from v1.

## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | ink swatch buttons have `aria-label="Ink color #…"`; the "0" full-bleed button has `aria-label="No margins — full bleed"` |
| 2 | aria-live | pass | `#preview` is the result container: liveRegion + `role=img` with an aria-label rebuilt on every render ("Preview: <type> paper, <size>, <orientation>") — verified changing at runtime |
| 3 | Keyboard path | pass | keyboard-only: paper type via select ArrowDown → preview label changed to "Dot grid"; orientation via Enter on the segmented button → "landscape"; margins via ArrowUp then full-bleed via Enter → 0. Print/Download are plain buttons. No overlays |
| 4 | Inputs labeled | pass | every field `label[for]` (type select + ink color: aria-label; orientation group: `aria-labelledby`) |
| 5 | Contrast | pass locally / suite flags | see below |
| 6 | Focus visibility | pass | core 2px accent outline (buttons, selects, number inputs) |

Contrast: `.btn.ghost`/accent-on-card 5.74/6.91, section headings and field labels on card
4.76/6.19, `.note b` 13.39-class. The SVG preview itself is user-configured ink on white
(the tool's whole point) — n/a.
**SUITE-WIDE flags (no paper-local color fails)**: light muted-on-bg 4.36 (tagline, idle
segmented buttons on `--bg`, print note, hints); dark #fff-on-accent 2.36 (active segmented
button, `.btn`). Core-palette pairs.

No changes made to paper.html — **pass as was**.
