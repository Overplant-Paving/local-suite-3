# almanac — migration report (Batch A)

(Archived by the orchestrator from the migration agent's final message — the agent's direct
Write of this file was blocked by a harness hook; content unchanged.)

## v1 feature walk-through

Every v1 feature, each verified against `tools/almanac.html` run from `file://` by the
harness (`interaction.txt`) or by direct inspection:

- [x] **First-run location screen** when no `suite.location` exists — harness log line 1:
  `firstrun visible on fresh open: true`.
- [x] **ZIP lookup via zippopotam.us** — live request performed: ZIP 92101 → `San Diego, CA
  92101`, `suite.location = {"lat":32.7185,"lon":-117.1593,"label":"San Diego, CA 92101"}`.
  Invalid-format and lookup-failure branches preserved verbatim.
- [x] **Enter submits the ZIP field** — exercised via keyboard.
- [x] **"Use my location" geolocation path** — code preserved verbatim; not exercised live
  (Playwright on file:// has no geolocation grant); ZIP path proves the shared showApp flow.
- [x] **Location bar with label + "change" button** — round-trip exercised.
- [x] **Date picker + "today" button** — 2026-12-21: sunrise 8:48 AM / sunset 6:47 PM /
  10h 00m day (vs 14h 06m on Jul 15); `today` restored.
- [x] **Sun card** — San Diego 2026-07-15: 7:52 AM / 2:55 PM / 9:58 PM / 14h 06m.
- [x] **Daylight arc SVG** — rendered: 1231 chars, 4 circles, 5 text labels; sun dot correct.
- [x] **Polar day/night handling** — `at()` state logic preserved verbatim.
- [x] **Twilight & golden hour card** — all 8 rows logged (astronomical dawn 6:14 AM,
  evening golden hour 9:23–9:58 PM).
- [x] **Moon canvas** — 590 bright pixels for a 4% waxing crescent, correct limb.
- [x] **Moon phase name / % / age** — `Waxing Crescent · 4% illuminated · 1.9-day age`.
- [x] **Next full / new moon (Meeus ch. 49)** — full Wed Jul 29 (correct), new Wed Aug 12.
- [x] **Seasons (Meeus ch. 27)** — Autumn Equinox Sep 22 2026 7:06 PM (69 d); Winter
  Solstice Dec 21 2026 2:51 PM (159 d); Spring Equinox Mar 20 2027; Summer Solstice Jun 21 2027.
- [x] **Theme toggle repaints canvas/SVG** — v1's toggle called `redraw()`; v2 keeps it via
  an added themeBtn listener after `Suite.theme.init()`. Console clean.
- [x] **Persistence** — `suite.theme`, `suite.location` byte-identical to v1.

## changes beyond the recipe

- Tool-local overrides to stay on v1: `.back` (v1 pill style), `footer` (2.5rem/.82rem/1rem),
  `.card` (block layout reset vs core flex), `.theme-btn{float:none}`.
- themeBtn click listener calling `redraw()` (v1 repaint behavior, not a new feature).
- `zipLookup` on `Suite.fetchJSON` (same 12 s timeout, no cache key as v1, same error UX).
- `sunAltitude()` retained although v1 never calls it either (parity).

## localStorage keys

`suite.theme` (bare string) and `suite.location` (same JSON shape/key order) — byte-identical
to v1; key diffs empty both ways.

## escape allowlist requests

Nothing remote reaches innerHTML (ZIP place name renders via textContent). Provably local:
- `${k}`, `${v}` in `rowHTML` — literal labels + formatter outputs of local math.
- `${countdown(s.date, now)}`, `${s.name}`, `${fmtDate(s.date)}`, `${s.date.getFullYear()}`,
  `${fmtTime(s.date)}` in `#seasonGrid` — fixed 4-element names array + formatter outputs.
- All `${...}` inside `drawSunArc`'s SVG string — numeric coordinates, own CSS variables,
  fmtTime outputs.

## a11y applied

- `aria-label` on `#zipIn`; `Suite.liveRegion` on `#frErr`; `role="img"` + labels on moon
  canvas and sun arc; theme-button aria from core; Enter already submitted in v1 (verified).

## endpoints

`https://api.zippopotam.us` — one GET in the first-run ZIP lookup only. Listed in the
manifest so CSP connect-src permits it (metadata said [] but the source verifiably fetches).
Classification stays `offline` per the burn-down table; flagged for the orchestrator.

## concerns for the reviewer

- `network: "offline"` vs the one real setup-time endpoint — see above.
- Geolocation path not live-exercised (file:// permission constraints).
- Arc caption/sunset label overlap near right edge — present in v1 identically.
- v1/v2 screenshots capture the first-run screen (fresh profile); populated view evidenced
  by `v2-after-interaction.png` (dark theme — theme probe runs before the shot).

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/almanac.html` from `file://`, light + dark
(raw log: `phase4-a11y-audit.txt`). **Verdict: fixed (2 contrast items).**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass (n/a) | none; sun-arc SVG and moon canvas carry `role=img` + aria-label |
| 2 | async regions aria-live | pass | `#frErr` (the tool's only fetch result — ZIP lookup) = polite; date-change recomputes are synchronous responses to the date input the user just operated |
| 3 | keyboard paths | pass | keyboard-only drive: typed 12/21/2026 into the date input → sun card recomputed (sunrise 8:55 AM… 9h 53m), Enter on "today" restored, Enter on "change" opened first-run, ZIP typed + Enter fired lookup (blocked network → live error announced via `#frErr`). Note: the walk's "trap" flag on `#dateIn` is a false positive — Chrome date inputs consume 3 Tabs for MM/DD/YYYY segments, then focus moves on (verified: 4th Tab lands on `#todayBtn`) |
| 4 | input labels | pass | `#zipIn` aria-label; `#dateIn` wrapping label; lat/lon fields n/a (tool has none — geo/ZIP only) |
| 5 | contrast both palettes | **fixed** | see below |
| 6 | focus visibility | pass | 2px accent outline on every stop, both themes |

Contrast fixes (tool-local, all four theme contexts):
- new `--soft-muted` (#59606c L / #9aa0a8 D) for `.count .cl/.cw` (season-card captions on
  `--accent-soft`): was 4.11 (L) → now **5.38 (L)**, dark unchanged at 5.64.
- `.err` was hardcoded #b0472f with no dark value (2.94 on the dark card): now `var(--err)`
  (#b0472f L / #e07a6a D) → measured **5.46 (L) / 5.57 (D)** on the first-run card.

Harness: `node verify-tool.mjs almanac` re-run after the fix — exit 0, console clean.
SUITE-WIDE flags: muted-on-`--bg` 4.36 light (footer); dark white-on-accent pair present
on the first-run `.btn` (hidden in the seeded scans, same suite-wide 2.36 pair).
