# holidays.html — migration report (Batch A)

Evidence produced by `node verify-tool.mjs holidays` (exit 0). Interaction ran under
`page.clock.install({ time: 2026-07-15 12:00 local })` for deterministic countdowns.

## v1 feature walk-through

- [x] **Year bar: prev / next / "this year" navigation** — verified in interaction.txt:
  `nextYear` click → label "2027" and all three sections re-rendered with 2027 data;
  `thisYear` → back to "2026"; `prevYear` → 2025 DST dates logged (Mar 9 / Nov 2 — correct).
- [x] **Hero: next-holiday countdown** — with clock fixed at Wed 2026-07-15: "54 DAYS AWAY —
  Next holiday: Labor Day, Monday, September 7". Hand-check: Jul 15→Sep 7 2026 = 54 days;
  Sep 7 2026 is the 1st Monday of September. Correct.
- [x] **Hero: long-weekend countdown** — "52 DAYS TO A LONG WEEKEND — Labor Day, Sat Sep 5 →
  Mon Sep 7 · Mon weekend". Correct (Sep 5 is the Saturday before, 52 days out).
- [x] **Federal-holiday table, 11 rows with correct dates** — all 11 logged for 2026 and 2027
  (interaction.txt). Spot-checks: MLK 2026 = Mon Jan 19 (3rd Mon), Memorial 2026 = Mon May 25
  (last Mon), Thanksgiving 2026 = Thu Nov 26 (4th Thu). All correct.
- [x] **Weekend-shift "observed" rule** — 2026: Independence Day Sat Jul 4 → "Friday, Jul 3
  observed". 2027: Juneteenth Sat Jun 19 → Fri Jun 18; Independence Day Sun Jul 4 → Mon Jul 5;
  Christmas Sat Dec 25 → Fri Dec 24. All match the Sat→Fri / Sun→Mon rule; non-shifted rows show "—".
- [x] **past / next row highlighting** — rows before 2026-07-15 carry `class: past`; Labor Day
  (first upcoming) carries `class: next`; when viewing 2027, New Year's Day is `next`. Logged.
- [x] **Market calendar (closures + early closes)** — 12 rows logged for both years. Good Friday
  2026 = Apr 3 (Easter Apr 5 − 2), 2027 = Mar 26 (Easter Mar 28 − 2): Computus verified. Early
  closes: Day-after-Thanksgiving both years; Christmas Eve 2026 (Thu Dec 24); Jul 3 2026 absent as
  an early close because it is the Independence Day closure itself — identical to v1's logic.
- [x] **DST cards with day deltas** — 2026: spring Mar 8 (2nd Sun) "129 days ago", fall Nov 1
  (1st Sun) "in 109 days"; 2027: Mar 14 / Nov 7; 2025: Mar 9 / Nov 2. All correct, including the
  past/future phrasing.
- [x] **Theme toggle** — harness probe: `light -> dark`, `aria-pressed=true`, `suite.theme` written.
- [x] **Static content** — notes, nyse.com link (`target=_blank rel=noopener` kept), footer:
  present in both screenshots, visually identical to v1.

## changes beyond the recipe

- Tool-local `footer { padding-top: 1.2rem; }` — v1 uses 1.2rem where core provides 1.1rem.
- Tool-local `.theme-btn { float: none; }` — core adds `float: right`, but this tool positions the
  button with its v1 flex `.topbar`/`.spacer`; the override keeps the computed style identical to v1.
- v1's local `escapeHtml()` helper replaced by `Suite.esc()` (same escape set, identical output).
- No feature changes; all date logic is copied verbatim from v1.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string via raw localStorage | bare string via `Suite.store` (writes strings bare) |

Only key either version touches. Parity: `keysOnlyInV1` and `keysOnlyInV2` both empty
(localstorage.json), values identical (`"dark"` after the toggle probe on each side).

## escape allowlist requests

All interpolations feed only local, hardcoded date math (no remote or user-influenced data — the
tool has no network and no free-text input; the only inputs are three buttons). Holiday **names**
are wrapped in `Suite.esc()` anyway (as v1 wrapped them in `escapeHtml`). The remaining unwrapped
expressions, all provably safe:

- `${n === 0 ? "Today" : n}`, `${n <= 0 ? "Now" : n}` — `n` is `daysUntil(...)`, a Number from date arithmetic.
- `${n === 0 ? "is a holiday" : n === 1 ? "day away" : "days away"}` and
  `${n <= 0 ? "long weekend on" : n === 1 ? "day to a long weekend" : "days to a long weekend"}` — string literals only.
- `${fmtDOW(...)}` (5 sites), `${fmtLong(nextLW.start)}`, `${fmtLong(new Date(nextLW.day.getTime() + (nextLW.kind === "Fri" ? 2 : 0) * DAY))}` — return values built solely from hardcoded weekday/month-name arrays and `Date.getDate()`.
- `${MONTHS[...getMonth()]}` / `${MONTHS[...].slice(0,3)}` (6 sites), `${...getDate()}` (6 sites) — hardcoded month-name array / Number.
- `${nextLW.kind}` — one of the literals `"Mon" | "Fri" | "Thu–Sun"`.
- `${past ? "past" : ""}` (2 sites), `${isNext ? "next" : ""}` — class-attribute literals.
- The nested `${shifted ? \`...<span class="tag-obs">observed</span>\` : "—"}` — composed of the fmtDOW/MONTHS/getDate expressions above plus literals.
- `${badge}` — one of two hardcoded `<span class="badge ...">` literals.
- `${title}`, `${dir}`, `${note}` in `renderDST`'s `mk()` — hardcoded string arguments of the two local calls.
- `${n === 0 ? "today" : n > 0 ? \`in ${n} day${n===1?"":"s"}\` : \`${-n} day${n===-1?"":"s"} ago\`}` (with nested `${n}`, `${-n}`, plural ternaries) — Numbers and literals.

## a11y applied

- `#yearLabel` marked `Suite.liveRegion()` (`aria-live="polite"`) — a year change re-renders every
  section; the announced year is the meaningful summary (announcing full table re-renders would be
  noise). Verified in interaction.txt: `#yearLabel aria-live: polite`.
- Icon-only year buttons already had v1 `aria-label="Previous year"` / `"Next year"` — kept and
  verified in interaction.txt.
- Theme button `aria-label` + `aria-pressed` come from core `Suite.theme.init()` — probe logged
  `aria-pressed=true` after toggle.
- Inline `.onclick =` property assignments (prevYear/nextYear/thisYear/themeBtn) converted to
  `addEventListener`.
- No form inputs exist; all controls are native `<button>`s (keyboard path free); no overlays.

## endpoints

None. The tool is pure local date math — zero `fetch`/XHR anywhere in the v1 source (confirmed by
reading it in full; the only URL is the informational `nyse.com` hyperlink, a plain `<a>`
navigation, not a script-contacted endpoint). The task brief said v1 MAY reference Nager.Date —
it does not.

## concerns for the reviewer

- **Inherited v1 quirk (parity preserved, not fixed):** in years where Christmas Day falls on a
  Saturday (e.g. 2027), the market table lists Dec 24 twice — as the observed "Christmas Day —
  Closed" and as "Christmas Eve — Early close 1:00 pm ET". An early close on a fully closed day is
  contradictory, but both rows come straight from v1's `marketDays()`; fixing it would be a
  behavior change, so it was left identical. Visible in interaction.txt (`[next(2027)]` market
  rows). Possible post-migration fix for the orchestrator to consider.
- Similarly inherited: the "Independence Day eve" early-close condition (both Jul 3 and Jul 4
  weekdays) mirrors informal NYSE practice imperfectly (real NYSE early closes vary year to year).
  Kept as-is; the tool's own note tells users to confirm at nyse.com.
- The post-interaction screenshot (`v2-after-interaction.png`) shows the dark theme because the
  harness's theme-toggle probe runs before the shot — harness ordering, not a defect.
- Computed-style diff: only `-webkit-font-smoothing` (pre-approved), 13 selectors, both themes.
  Nothing else differs.
