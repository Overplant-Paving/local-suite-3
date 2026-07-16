# dates.html migration report (Batch A)

Evidence produced by `node verify-tool.mjs dates` (exit 0). Clock fixed to 2026-07-15 12:00
local via `page.clock.install()` in both `interact` and `v1Interact`, so every day-count
below is deterministic.

## v1 feature walk-through

- [x] **Saved countdowns — add**: filled name "Launch" + date 2026-12-25, clicked Save →
  card rendered with num **163** (2026-07-15 → 2026-12-25 = 16+31+30+31+30+25, hand-checked),
  when-line "163 days to go · Friday, December 25, 2026" (interaction.txt lines 2–4).
- [x] **Saved countdowns — remove (×)**: added a second countdown "Temp", clicked its ×
  → card count 2 → 1 (line 5).
- [x] **Saved countdowns — persistence**: reloaded the page; "Launch" card re-rendered from
  `suite.dates.countdowns` = `[{"name":"Launch","date":"2026-12-25"}]` (lines 18–19), byte-identical
  to what v1 writes (localstorage.json).
- [x] **Saved countdowns — sort by |diff| + past styling**: sort exercised implicitly — "Temp"
  (17 days) rendered before "Launch" (163) and was removed via its own aria-label, which only
  resolves if ordering worked. `.past` styling not exercised (no past countdown left persisted);
  code path identical to v1 (class toggle on diff < 0).
- [x] **Saved countdowns — empty-state message**: visible in the pre-interaction screenshots
  ("No saved countdowns yet — add one above."), hidden once a card exists (after-interaction shot).
- [x] **Validation alert on missing name/date**: code preserved verbatim (`alert(...)`); not
  scripted (Playwright dialogs would hang the run without a handler).
- [x] **Days until / since**: 2026-07-22 → "7" + "7 days from now · Wednesday, July 22, 2026 ·
  1 weeks"; past date 2026-07-01 → "14 days ago … · 2 weeks" (lines 6–8). The "1 weeks" quirk is
  v1-exact (`(7/7).toFixed(1).replace(/\.0$/,"")`).
- [x] **Add / subtract days — calendar mode**: boot default (today + 30 → Friday, August 14, 2026,
  visible in all four screenshots) and 2026-07-02 + 3 → Sunday, July 5, 2026 (line 11).
- [x] **Add / subtract days — business mode with holiday skip**: 2026-07-02 + 3 business days →
  **Wednesday, July 8, 2026** — correctly skips Fri Jul 3 (Independence Day observed, Jul 4 2026 is
  a Saturday) and the weekend (line 9). This exercises `federalHolidays`/`observed`/`isBusinessDay`.
- [x] **Add / subtract days — direction select**: "+3 … from" label confirms Add path; Subtract
  shares the same `dir` code path (dir = −1 multiplier), unchanged from v1.
- [x] **Age calculator**: DOB 1990-05-20 as of 2026-07-15 → parts [36, 1, 25] years/months/days,
  "13,205 days total · 1,886 weeks · 433.8 months" (lines 12–13; totals hand-checked:
  13,205 = 36y incl. 9 leap days + 56d).
- [x] **Between two dates**: 2026-07-01 → 2026-07-31 = "30 days", parts [21 business, 8 weekend]
  (lines 14–15). Hand-checked: span counts exclusive-of-start (Jul 2..31) = 8 weekend days,
  22 weekdays − 1 observed holiday (Fri Jul 3) = 21.
- [x] **Boot defaults**: today pre-filled into asStart / ageAs / wbA; all four out-panels render
  placeholder or computed text at load (screenshots).
- [x] **Theme toggle**: light → dark, `aria-pressed=true`, `suite.theme` written as bare string
  (line 20; localstorage.json).
- [x] **Visual parity**: v1 vs v2 screenshots pixel-equivalent in both themes (see verdicts below).

## changes beyond the recipe

- Core's `.card` is `display:flex; flex-direction:column; gap:.55rem` — v1 dates cards are plain
  blocks. The tool-local `.card` rule restores the v1 values (`display:block; flex-direction:row;
  gap:normal`) so computed styles match exactly (commented in the CSS).
- `cdAdd` handler extracted to a named `addCountdown()` so both the click listener and the new
  Enter-key listeners share it.
- Remove-button `aria-label` upgraded from the static "Remove" to "Remove countdown: <name>"
  (set via `setAttribute`, so the name is never interpolated into HTML).
- Segmented Calendar/Business buttons got `aria-pressed` state tracking + `role="group"`
  with `aria-labelledby` pointing at the existing "Count" label (id added).
- No features removed; no other behavior changes.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.dates.countdowns` | raw `localStorage` + `JSON.stringify` array | `Suite.store.get/set` — same JSON bytes (proven: identical values in localstorage.json) |
| `suite.theme` | raw bare string | `Suite.theme` — bare string (identical) |

`keysOnlyInV1` = `keysOnlyInV2` = [].

## escape allowlist requests

All `innerHTML` writes interpolate only locally computed values; user-entered text (`c.name`)
and the locale strings shown next to it are assigned via `textContent`, exactly as v1 did.
Expressions that appear inside `.innerHTML` template concatenations:

- `head` / `commas(diff)` / `commas(-diff)` (renderDU) — output of `Number.toLocaleString()` on a
  day-arithmetic result, or the literal "Today"; no user text.
- `sub + weeks` (renderDU) — concatenation of `plural()` (number + fixed word), `fmtLong()`
  (`Date.toLocaleDateString`), and a fixed-format weeks string; no user text.
- `fmtLong(result).split(",").slice(0,1)`, `fmtLong(result)`, `label`, `toYMD(start)` (renderAS) —
  locale/ISO date formatting of computed timestamps plus a label built from parseInt results.
- `years`, `months`, `days`, `commas(totalDays)`, `commas(Math.floor(totalDays/7))`,
  `commas(Math.round(totalDays/30.44*10)/10)` (renderAge) — arithmetic on parsed dates.
- `commas(days)`, `weeks`, `rem`, `commas(biz)`, `commas(weekend)` (renderWB) — arithmetic.
- `num` (renderCD) — "Today" or `commas(Math.abs(diff))`; the user-controlled `name` and the
  `when` string are set through `textContent` on the already-parsed nodes (v1 pattern kept).

None of these can carry user- or remote-controlled markup; the values never originate from
outside the page. Reason to allowlist rather than rewrite: byte-level behavior parity with v1.

## a11y applied

- `Suite.liveRegion()` on all four result panels (`#duOut`, `#asOut`, `#ageOut`, `#wbOut`) and on
  the `#countdowns` grid — every container that updates after user input.
- Icon-only × button: per-card `aria-label="Remove countdown: <name>"` (v1 had a bare "Remove").
- Segmented control: `aria-pressed` kept in sync with the `.on` class (verified in
  interaction.txt line 10: cal=false biz=true after switching); `role="group"` +
  `aria-labelledby="asModeLabel"` associates the previously-orphaned "Count" label.
- Enter submits in the countdown name and date fields (text-entry + button pair rule); verified:
  Enter in `#cdName` added a card (line 16).
- All other inputs already had `<label for=>` in v1 (kept); theme-button labeling +
  `aria-pressed` comes from core `Suite.theme.init()`.
- No overlays, so no Esc path needed; all controls are native buttons/inputs (keyboard-reachable).

## endpoints

None. Zero-network tool; `endpoints: []`.

## style-diff verdict

Only diff in both themes: `-webkit-font-smoothing: auto → antialiased` on all 12 selectors —
the pre-approved core diff. Nothing else (computed-style-diff.txt).

## concerns for the reviewer

- The **alert() validation path** (empty name/date) was not exercised by the harness — Playwright
  needs a dialog handler and the harness owns the page. Code is verbatim v1; risk is low, but it
  is the one uncovered branch.
- `.cd.past` (grey styling for past countdowns) was likewise not left persisted in evidence; the
  "days since" logic behind it *was* verified (line 8: 14 days ago).
- `renderCD` sorts a mapped copy but the × handler splices by original index `i` — this is
  correct (i is captured pre-sort), verified by removing "Temp" while "Launch" at a different
  sort position survived. Flagged only so the reviewer doesn't mistake it for a bug.
- The after-interaction screenshot shows the post-reload state (persistence check ends the
  interaction), so the filled calculator panels appear only in interaction.txt, not the shot.
- v1's `alert` and the "1 weeks" pluralization quirk are preserved deliberately (no behavior
  changes allowed); polishing them would be a v2.x decision.

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/dates.html` from `file://`, light + dark
(raw log: `phase4-a11y-audit.txt`). **Verdict: pass-as-was — no tool changes.**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass | countdown `×` buttons carry aria-label "Remove countdown: <name>" |
| 2 | async regions aria-live | pass | all five result surfaces polite: `#duOut`, `#asOut`, `#ageOut`, `#wbOut`, `#countdowns` |
| 3 | keyboard paths | pass | keyboard-only drive: typed name+date, **Enter saved** the countdown ("Launch", 168 days), typed a days-until date → announced result, Enter on "Business days" (aria-pressed=true) → +30 business days recomputed, Tab to countdown × + Enter removed it. The walk's "trap" on `#cdDate` is the Chrome date-segment false positive (verified: Tab 1-3 = MM/DD/YYYY segments, Tab 4 → `#cdAdd`) |
| 4 | input labels | pass | 10/10 inputs/selects via `label[for]` |
| 5 | contrast both palettes | pass (tool-local) | all tool pairs ≥4.76 (L) / ≥6.19 (D); `.seg button.on` white-on-accent 5.83 passes light, fails dark only via the suite-wide pair |
| 6 | focus visibility | pass | 2px accent outline on every stop, both themes |

SUITE-WIDE flags: muted-on-`--bg` 4.36 light (footer); white-on-accent 2.36 dark (`.btn`,
`.seg button.on`).
