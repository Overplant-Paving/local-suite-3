# focus — evidence notes

(This file was created by the Phase 4 a11y audit; the Batch A migration evidence for focus
lives in interaction.txt / computed-style-diff.txt / localstorage.json / the png pairs.)

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/focus.html` from `file://`, light + dark themes
(Playwright; raw log: `phase4-a11y-audit.txt`). **Verdict: pass-as-was — no tool changes.**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass (n/a) | zero icon-only buttons/links; theme button has visible text + core aria-label |
| 2 | async regions aria-live | pass | `#dataHint` (export/import results) = polite; `#clock` deliberately NOT live (per-second ticking would spam SRs); `#summary`/`#log` are passive stats repainted alongside the announced dataHint |
| 3 | keyboard paths | pass | keyboard-only drive: Enter on Start→"Pause", clock ticked to 24:59, Enter→"Resume", Enter on Skip→"Short break", global Space shortcut toggled run state, Enter on summary opened settings, session-length inputs reachable; no traps, no positive tabindex |
| 4 | input labels | pass | 6/6 inputs via `label[for]` |
| 5 | contrast both palettes | pass (tool-local) | no tool-local failures; two SUITE-WIDE pairs logged below |
| 6 | focus visibility | pass | 2px accent outline on every Tab stop, both themes |

Contrast measurements (worst per category): body ink/bg 13.39 (L) / 14.25 (D); accent text on
card 5.74 (L) / 6.91 (D); white on accent .btn 5.83 (L); muted on card 4.76 (L) / 6.19 (D).

SUITE-WIDE flags (core palette — reported, not fixed locally per the addendum):
- `--muted` #6b7280 on `--bg` #f5f3ee = **4.36** (light) — footer text here; affects every tool.
- white on `--accent` #6fb5ae = **2.36** (dark) — `.btn` and `.modeRow button.on` here; the
  accent-background/white-text button convention fails suite-wide in dark.

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.modeRow button.on`, `.btn`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
