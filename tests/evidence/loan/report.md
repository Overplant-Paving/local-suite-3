# loan.html migration report (Batch A)

Evidence: this directory. Harness run `node verify-tool.mjs loan` exited 0; console clean.

## v1 feature walk-through

- [x] **Three-tab layout (Loan & schedule / Extra payments / Refinance compare)** — clicked all
  three tabs in the interaction pass; each section shows/hides via `.hidden`, active pill follows
  (`interaction.txt` lines for extra + refi outputs; after-interaction screenshot back on loan tab).
- [x] **Loan terms inputs (amount / APR / term / start month) with live recompute** — filled
  $300,000 @ 6.5% / 30 yr, start 2026-01; stats recomputed on every `input` event.
  **Known-loan math check: expected monthly P&I ~$1,896.20, actual $1,896.20** (`interaction.txt`).
- [x] **PITI escrow inputs (tax / insurance / HOA / PMI)** — left at 0 in the run; the
  "Full PITI / mo" stat is conditional on escrow > 0 exactly as v1 (code identical; default-state
  screenshots show 4 stats, no PITI card, same as v1 screenshots).
- [x] **Stats row (Monthly P&I, conditional PITI, total interest, total of payments, payoff
  month)** — observed `$1,896.20 / $382,633 / $682,633 / Dec 2055`; v1/v2 default-state
  screenshots show identical `$2,275.44 / $459,160 / $819,160 / Jun 2056` for the 360k default.
- [x] **Amortization table with year-end highlight rows** — 360 rows for the 30-yr loan; first row
  `1 | Jan 2026 | $1,896.20 | $271.20 | $1,625.00 | $299,728.80` (hand-check: 300000 x .065/12 =
  $1,625.00 interest exactly); last row `360 | Dec 2055 | ... | $0.00`. Year-end rows visible with
  `--accent-soft` background in both screenshot sets (row 12 highlighted).
- [x] **Canvas chart (balance + cumulative interest + cumulative principal) with y/x axis labels**
  — rendered in all four screenshots, identical curves and axis labels v1 vs v2.
- [x] **Chart redraw on theme toggle** — v1's toggle handler called `drawChart(lastSchedule)`;
  preserved via an added `themeBtn` click listener that runs after `Suite.theme.toggle`. Proven by
  `v2-after-interaction.png`: taken after the harness's theme-toggle probe, chart shows the
  dark-palette line colors (cssVar-resolved), not stale light colors.
- [x] **Chart redraw on window resize** — listener carried over verbatim.
- [x] **CSV export** — download captured to `amortization.csv` (361 lines = header + 360 rows);
  header and first/last data rows logged and consistent with the table.
- [x] **Extra payments what-if ($/mo, lump sum, lump month, biweekly select)** — $200/mo on the
  300k loan: "You'd save $103,449 in interest and be debt-free 6 yr 11 mo sooner — payoff moves
  from Dec 2055 to Jan 2049", plus the as-scheduled vs accelerated compare columns
  (`interaction.txt`). Biweekly/lump paths share the same `buildSchedule(opt)` code, copied
  verbatim from v1.
- [x] **Refinance compare with break-even + lifetime verdict** — 330k @6.5%/28yr vs 330k
  @5.25%/30yr with $6,000 costs: current P&I $2,135.15, new $1,822.27, "save $312.88/mo ...
  recoup after 20 months (~1.7 yr) ... come out $55,393 ahead" (`interaction.txt`). The `bad`
  verdict branch (higher payment / more lifetime interest) is verbatim v1 code.
- [x] **Persistence of all 19 inputs under `suite.loan.v1`** — written on loan-input render,
  restored on load; byte-identical JSON envelope confirmed in `localstorage.json` (identical
  values in v1 and v2 snapshots, both 288 chars).
- [x] **Start month defaults to current month when unset** — logic verbatim; default-state
  screenshots show "July 2026" in both versions.
- [x] **Financial math identical to v1** — `monthlyPayment`, `buildSchedule`, `renderExtra`,
  `renderRefi` copied without modification; spot checks above ($1,896.20 payment, $1,625.00
  first-month interest, 20-month break-even) all match hand calculation of v1's formulas.

## changes beyond the recipe

- **`.card` core conflict neutralized**: core's `.card` is a flex column with `gap: .55rem` and
  different padding; v1 loan's `.card` is a plain block. The tool-local `.card` rule keeps v1's
  declarations and adds `display: block; flex-direction: row; gap: normal;` so computed styles
  match v1 (verified: `.card` shows zero diffs beyond font-smoothing in
  `computed-style-diff.txt`).
- **`.back` / `.theme-btn` positioning kept tool-local**: v1 loan absolutely positions both inside
  the header (core uses float for the theme button); kept `position:absolute` overrides plus
  `float: none` on `.theme-btn`.
- **footer override**: v1 loan uses `font-size: .82rem; padding-top: 1rem` where core provides
  `.85rem / 1.1rem`; tool-local override keeps v1's values.
- **Theme-toggle chart redraw**: v1 redrew the chart inside its own toggle handler. v2 adds
  `themeBtn.addEventListener("click", () => drawChart(lastSchedule))` after `Suite.theme.init()`
  (init registers first, so the redraw runs after the theme flips). Behavior-preserving.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.loan.v1` | JSON object of all 19 input values, written by `save()` on loan-input render | identical — `Suite.store.set(KEY, o)` JSON-stringifies objects exactly like v1's `JSON.stringify` (envelope confirmed byte-equal in `localstorage.json`) |
| `suite.theme` | bare string via theme toggle | identical via `Suite.theme` (bare string) |

`keysOnlyInV1` / `keysOnlyInV2`: both empty. v1's save-timing quirk (extra/refi edits persist only
when a loan input next re-renders) is preserved, not "fixed".

## escape allowlist requests

All `innerHTML` interpolations are locally computed numbers or constants — no remote data (the
tool is zero-network) and no free-text user strings (all inputs are `type=number`/`type=month`/a
fixed `<select>`, read via `+$(id).value` numeric coercion). Exact expressions:

- `fmt$2(sch.basePay)`, `fmt$2(piti)`, `fmt$(sch.totalInterest)`, `fmt$(sch.totalPaid)` — numeric
  formatter output (`$` + `toLocaleString` digits)
- the escrow ternary `escrow > 0 ? \`<div class="stat"><b>${fmt$2(piti)}</b><span>Full PITI / mo</span></div>\` : ""`
  — intentional markup, inner expression covered above
- `payoff`, `basePayoff`, `newPayoff`, `monthLabel(L.sy, L.sm, r.m - 1)`,
  `monthLabel(L.sy, L.sm, r.m-1)` — output of `monthLabel()`: a constant `MONTHS[]` entry + a
  number
- `ye ? "yearend" : ""` — literal CSS class name
- `r.m`, `cur.months` — integers from the schedule builder
- `fmt$2(r.pay)`, `fmt$2(r.principal)`, `fmt$2(r.interest)`, `fmt$2(r.bal)` — numeric formatter
- `fmt$(intSaved)`, `yrs ? yrs + " yr " : ""`, `mos` — numbers/literals
- `fmt$(base.totalInterest)`, `fmt$(base.totalPaid)`, `fmt$(accel.totalInterest)`,
  `fmt$(accel.totalPaid)` — numeric formatter
- `fmt$2(curPay)`, `fmt$(cur.totalInterest)`, `fmt$2(newPay)`, `fmt$(nw.totalInterest)`,
  `fmt$(costs)` — numeric formatter
- `fmt$2(-monthlySaved)`, `fmt$2(monthlySaved)`, `breakeven`,
  `breakeven === 1 ? "" : "s"`, `(breakeven/12).toFixed(1)`, `fmt$(lifetimeDiff)`,
  `fmt$(-lifetimeDiff)` — numbers/literals

CSV template (`${r.m},${monthLabel(...)},${r.pay.toFixed(2)},...`) builds a Blob, not innerHTML.

## a11y applied

- Every `<label>` now carries `for=` pointing at its input/select (19 pairs: principal, apr, term,
  start, tax, ins, hoa, pmi, exMonthly, exLump, exLumpAt, exBiweekly, rCurBal, rCurApr, rCurTerm,
  rNewBal, rNewApr, rNewTerm, rCosts). v1 had bare labels with no association.
- `Suite.liveRegion()` on `#stats`, `#exSavings`, `#refiVerdict` — the three summary containers
  that recompute after user input. Deliberately NOT on the 360-row schedule table or the compare
  grids: announcing those on every keystroke would drown a screen reader; the stats/savings/verdict
  lines carry the same conclusions.
- `role="img"` + descriptive `aria-label` on the chart canvas (was unlabeled; the legend text is
  adjacent for sighted users).
- Theme button `aria-label` + `aria-pressed` come from core `Suite.theme.init()` (probe logged
  `aria-pressed=true` after toggle).
- No icon-only buttons (tabs, CSV button, theme button all have visible text). No text-entry+
  submit-button pair (everything recomputes on `input`), no overlays — Enter/Esc requirements not
  applicable. Tabs are real `<button>`s, keyboard-reachable in DOM order.

## endpoints

None. Zero-network tool; no fetch calls of any kind. `endpoints: []` in the manifest entry.

## concerns for the reviewer

- **Core `.card` collision** is the one place this tool fights the core stylesheet (see changes
  above). If later tools hit the same pattern, a shared convention (e.g. a `.card--block`
  modifier in core) might beat per-tool neutralization — flagged for the orchestrator, not acted
  on (core/ is frozen for Batch A subagents).
- **`aria-live` on `#stats` fires on every keystroke** while typing a loan amount (v1 recomputes
  per `input` event). Polite level keeps it interruptible, but a screen-reader user typing
  "360000" will hear several intermediate announcements. Kept because the recipe mandates live
  regions on result containers; debouncing would be a behavior change.
- **Verdict `.bad` uses `color-mix()`** (v1 CSS carried over verbatim) — fine in every browser the
  suite targets (Chrome/Edge 111+, Firefox 113+), noting only because it's the newest CSS feature
  in the file.
- The screenshots were captured on 2026-07-15; the default-state start month ("July 2026") and
  payoff ("Jun 2056") are date-dependent dynamic content and will differ on re-runs — not a
  parity issue (both versions compute it the same way).
- The interaction's after-screenshot is in dark theme because the harness toggles the theme
  before shooting — that is what proves the chart-redraw-on-toggle behavior survived.

## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`). Re-verified with `node verify-tool.mjs loan` → exit 0.

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | no symbol-only controls (all buttons have text); theme-btn from core |
| 2 | aria-live | pass | `#stats`, `#exSavings`, `#refiVerdict` liveRegion (runtime confirmed) — each tab's recomputed headline result announces. Schedule table/chart not live (stats is the announcing summary; chart has `role=img` + aria-label) |
| 3 | Keyboard path | pass | keyboard-only: principal typed → P&I stat changed ($2,275.44 → $1,580.17, announced via live `#stats`); Extra tab via Enter, extra-monthly typed → savings sentence announced; CSV button reachable by Tab |
| 4 | Inputs labeled | pass | every field `label[for]` (18 inputs + selects) |
| 5 | Contrast | **fixed** | see below |
| 6 | Focus visibility | **fixed** | tool CSS suppresses the core outline on `.field` inputs/selects. Wrapped inputs keep v1's indicator — `.in:focus-within` border flips line→accent (verified: rgb(228,224,214) → rgb(47,111,106)). But the bare month input (`#start`) and the selects had **no indicator at all** — added a tool-local `:focus-visible` outline for exactly those (verified at runtime: "solid 2px" on both). Buttons/tabs keep the core outline |

Contrast — **fixed: light `--interest`** — #c07f2d failed as the "Current loan" heading on
the card (**3.27**) and in `.verdict.bad` on its color-mix background (**2.77**). Deepened to
#875510 → **6.19 / 4.91**. Dark passes unchanged (7.13 / 5.31). Chart lines redraw from the
same variables (line contrast vs card now ≥3 in both themes). Other passes: stats 5.74/6.91
(large) with 4.76/6.19 labels, schedule th 4.76/6.19, year-end rows 12.61/11.81,
verdict-good on accent-soft (accent 4.95-class).
**SUITE-WIDE flags**: light muted-on-bg 4.36 (tagline, $ / % / yrs affixes on `--bg`);
dark #fff-on-accent 2.36 (`.tab.on`).

Fixes made: light `--interest` (both light contexts) + the `:focus-visible` rule. No
behavior change; `suite.loan.v1` untouched.
