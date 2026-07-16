# worldclock.html — migration report (Batch A)

Evidence produced by `node verify-tool.mjs worldclock` (exit 0). All interactions ran under
`page.clock.install({ time: 2026-07-15T12:34:56 local })` so clock renders are deterministic
(the log's concrete times below are reproducible on an America/Chicago host).

## v1 feature walk-through

- [x] **Local zone shown as default clock on first run** — fresh profile boots with 1 clock,
  label `Chicago (local)`, zone `America/Chicago` (interaction.txt lines 1–2); the default is
  written to `suite.worldclock.zones` immediately, exactly as v1 does.
- [x] **Add a city from the embedded ~80-city list** — selected `Asia/Tokyo`, clicked Add:
  clock count 1→2, label `Tokyo, Japan`, time `02:34:56`, date `Thu 07/16 · GMT+9` (line 3).
  The CITIES array is byte-identical to v1 (all 82 entries, sorted at render like v1).
- [x] **Add a free-typed IANA zone** — typed `Asia/Kolkata`: clock count 2→3, label `Kolkata`
  (v1's `niceLabel`), time `23:04:56` (half-hour offset correct), input cleared after add (line 4).
- [x] **Enter key submits the free-zone field** — the Kolkata add above was performed by
  pressing Enter in `#freeZone`, not by clicking the button.
- [x] **Invalid zone rejected with the v1 alert** — typed `Not/A_Zone`: alert
  `"Not/A_Zone" is not a valid IANA time zone.` shown, clock count unchanged (line 5).
- [x] **Day/night tint, sun/moon glyph, Tomorrow/Yesterday badge** — Tokyo clock at 02:34 local
  shows the moon glyph and the `Tomorrow` badge (line 3 + v2-after-interaction.png, where the
  badge and the night tint on the Tokyo card are visible).
- [x] **Live ticking (1 s) + per-minute planner refresh** — both `setInterval`s preserved
  verbatim; seconds visibly advance between the sequential v1/v2 captures (12:00:49 → :51).
- [x] **Meeting planner grid** — 3 zone rows × 24 cells while 3 clocks existed (line 6); colors
  from the same `hourColor` bands; "now" column header shaded; selected column outlined
  (3 `.sel` cells, one per row — line 7; visible in all screenshots).
- [x] **Hour slider (incl. keyboard)** — exercised with Home → `00:00 (12am)` then 9×ArrowRight
  → `09:00 (9am) in Chicago (local)` (lines 7–8); slider initializes to the current reference
  hour on boot (12:00 in the screenshots, mocked time 12:34).
- [x] **Readout cards for the selected hour** — at 09:00 Chicago: Tokyo `23:00 Wed 07/15`,
  Kolkata `19:30 Wed 07/15` — half-hour zone math and day tags correct (line 9); the
  after-interaction shot shows Tokyo `02:00 Thu 07/16 (+1d)` for 12:00 Chicago.
- [x] **Reference zone select** — switched to Tokyo: hourLabel becomes
  `09:00 (9am) in Tokyo, Japan` (line 10).
- [x] **Remove a clock (× button)** — removed Kolkata: clocks 3→2, planner rows 3→2 (line 11),
  and the saved list updated.
- [x] **Persistence** — `suite.worldclock.zones` holds
  `[{Chicago (local)},{Tokyo, Japan}]`; after `page.reload()` both clocks re-render from
  storage (lines 12–13).
- [x] **Theme toggle** — light→dark flip with `aria-pressed=true` (line 14), persisted to
  `suite.theme`.
- [x] **Empty states** — `#clocksEmpty` / `#planEmpty` markup and toggling logic preserved
  verbatim (not reachable in this run because v1 always reseeds the local zone when the list is
  null; the empty state only appears after removing every clock — logic is unchanged from v1).

## changes beyond the recipe

- Removed the dead no-op `if (slider.value === "") {}` line inside `fullRender()` (v1
  worldclock.html:451) — provably no behavior.
- Replaced the tool-local `esc()` helper with `Suite.esc()` (identical escaping table; the
  local function was v1's own copy of the shared helper, same dedup class as the fetch helpers).
- The `.rm` button's static `aria-label="Remove clock"` became a per-clock
  `aria-label="Remove clock: <label>"` set via `setAttribute` (a11y improvement, allowed class).
- Nothing else: CITIES data, zone math (`zoneParts`/`zoneOffsetMin`/`wallToInstant`), renderers,
  and boot order (`initSlider()` before `fullRender()`) are line-for-line v1.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.worldclock.zones` | JSON array via raw `localStorage` | same key, same JSON bytes via `Suite.store` (arrays serialize with `JSON.stringify`, identical to v1) |
| `suite.theme` | bare string via raw `localStorage` | same key via `Suite.theme` (writes strings bare) |

Parity proven in localstorage.json: identical key sets AND identical values in both versions
after the same interaction sequence (`keysOnlyInV1: []`, `keysOnlyInV2: []`).

## escape allowlist requests

All are string concatenations (not template literals), so the heuristic should not flag them;
listed for completeness since they interpolate into `innerHTML` unescaped:

- `m.hour`, `m.minute`, `m.second`, `m.month`, `m.day` — `Intl.DateTimeFormat("en-US").formatToParts` 2-digit numeric part values; never user or remote text.
- `m.weekday` — Intl short weekday from the fixed `en-US` locale ("Wed" etc.).
- `off` (in `tick()`) — output of local `fmtOffset()`: `"GMT" + sign + digits`.
- `badge` (in `tick()`) — one of two fixed HTML literals or `""`.
- `cls.trim()`, `st`, `sel` (in `renderPlanner()`) — fixed class-name/style literals chosen by boolean tests.
- `h % 2 === 0 ? h : ""` — loop counter number or empty string.
- `col` / `hourColor(zh)` — one of three hex-color literals.
- `dayTag` — one of three fixed literals (`" (+1d)"`, `" (−1d)"`, `""`).

Everything user-influenced (`z.label`, `z.zone` — the free-zone input feeds both) is wrapped in
`Suite.esc()` exactly where v1 used its local `esc()`, in all three interpolation sites
(planner `zh` cells, cell `title` attributes, readout labels).

## a11y applied

- `#freeZone` text input: added `aria-label="IANA time zone name"` (had only a placeholder).
- Per-clock remove buttons: `aria-label="Remove clock: <label>"` (v1 had a generic
  "Remove clock" on every button; now distinguishable to screen readers).
- `#hourLabel` wrapped in `Suite.liveRegion()` so the selected meeting hour is announced as the
  slider moves. Deliberately NOT applied to `#clocks` (re-renders every second — would spam) or
  the planner grid/readout (visual restatements of the hourLabel announcement).
- Already present in v1 and kept: `aria-label="Add a city"` on `#citySel`; implicit `<label>`
  wrapping on the reference select and hour slider; Enter submits the free-zone field.
- Keyboard paths: verified slider works via Home/ArrowRight in the interaction; all controls
  are native buttons/selects/inputs; no overlays (the one modal is a native `alert`).
- Core provides: theme-button label + `aria-pressed`, focus-visible outlines, reduced-motion guard.

## endpoints

None. Zero network — `Intl.DateTimeFormat` / the browser's IANA tz database only. `endpoints: []`.

## concerns for the reviewer

- **Planner cell contrast is a v1 carryover**: grid cells use fixed light backgrounds
  (`#8fce9b`/`#e6c96a`/`#d98b8b`) with fixed `color:#1c1c1c` text in BOTH themes — same in v1
  (screenshots match). Contrast is acceptable (dark text on light chips) but these chips don't
  follow the theme; flagged in case the Phase 4 a11y audit wants themed variants. Not changed
  here per the parity rules.
- **`--ok` and `--warn` variables are defined but unused** — also true in v1 (only `--bad` is
  used, on `.rm:hover`). Kept for byte-parity of the tool-accent block.
- The `Tomorrow`/`Yesterday` badge and day/night glyphs are computed against the *local* zone's
  calendar day (v1 semantics, preserved); the `en-US` date formatting is v1's hardcoded locale,
  unchanged.
- The after-interaction screenshot shows the slider back at 12:00: the persistence check reloads
  the page, which re-runs v1's `initSlider()` (slider resets to the current reference hour by
  design — slider position was never persisted in v1 either).

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/worldclock.html` from `file://`, light + dark
(raw log: `phase4-a11y-audit.txt`). **Verdict: fixed (1 contrast item).**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass | every clock's `×` carries aria-label "Remove clock: <label>" |
| 2 | async regions aria-live | pass | `#hourLabel` = polite announces the selected planner hour; `#clocks` deliberately NOT live (ticks every second — announcing would spam SRs); `#readout` repaints with the announced hour label |
| 3 | keyboard paths | pass | keyboard-only drive: select type-ahead "Tokyo" + Enter on Add → clock added; typed Asia/Kolkata + **Enter submitted** the zone field; ArrowRight on the planner slider → "02:00 (2am) in Chicago" announced; Tab to a clock's × + Enter removed it; no traps |
| 4 | input labels | pass | `#citySel`/`#freeZone` aria-label; `#refSel`/`#hourSlider` wrapping labels |
| 5 | contrast both palettes | **fixed** | see below |
| 6 | focus visibility | pass | outline (or input shadow) on every stop, both themes |

Contrast fix (tool-local, all four theme contexts) — found by compositing the 16% day/night
tint overlay the generic ancestor-walk can't see:
- muted text on NIGHT-tinted cards in light theme (`.zone`, `.date`, `.time .sec`) was
  **3.50**; new `--soft-muted` #59606c → measured **4.59** (night, light) with dark theme at
  6.34 and day-tinted cards unchanged (4.64 L / 5.65 D, passing).
Also measured: planner cells #1c1c1c on the fixed hour colors = 9.31 / 10.49 / 6.51 (both
themes); day/night emoji (`.sun`) is a color emoji glyph — CSS color doesn't paint it, the
1.72 scanner line is N/A.

Harness: `node verify-tool.mjs worldclock` re-run after the fix — exit 0, console clean.
SUITE-WIDE flags: muted-on-`--bg` 4.36 light (footer); white-on-accent 2.36 dark (`.btn`).

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.btn`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
