# jobs.html — migration report (Batch C, embedded-BLS remediation; completed from handoff draft)

Completer note: the prior agent's draft at handoff/batchC-drafts/jobs.html was found essentially
complete and correct. Diffed line-by-line against v1; one fix applied before verification:
the `.card` local override gained `flex-direction:row; gap:normal` resets against core's flex
card (the exact pattern currency/gas/markets use) so the computed-style diff stays clean.
The draft's embedded numbers were NOT trusted: they were re-verified value-by-value against a
fresh live BLS pull (below). No partial jobs.mjs or jobs evidence existed; both were produced
fresh. Draft file removed from handoff/batchC-drafts/ (plain move).

## embedded data — provenance and verification

Marker: `const BLS = /* @suite:bls */{...}/* /@suite:bls */;` — strict JSON, schema
`{asOf, start, series:{<BLS series id>:[number|null,...]}}`, arrays dense from `start`
(2021-01), `null` = a month BLS did not publish (the Oct 2025 household-survey gap).

- asOf: **2026-06** (June 2026) — confirmed the newest month BLS has published.
- Series: LNS14000000 (unemployment rate), LNS11300000 (participation rate),
  CES0000000001 (total nonfarm employment level, thousands).
- Exact curl used (ONE request total, keyless v1 API, response archived as
  `bls-live-response.json` in this directory):

```
curl -s -X POST "https://api.bls.gov/publicAPI/v1/timeseries/data/" \
  -H "Content-Type: application/json" \
  -d '{"seriesid":["LNS14000000","LNS11300000","CES0000000001"],"startyear":"2021","endyear":"2026"}'
```

- Verification: a comparison script aligned the live response to the embedded arrays —
  **all 66 values x 3 series match exactly**, including the two nulls, and the live
  `latest:true` month equals asOf. Status REQUEST_SUCCEEDED.
- UI labels the reference month first-class: header pill "Data: June 2026 · refreshed
  monthly at build time" (`#dataStamp`), plus per-stat month labels and the chart note —
  all driven from the embedded object.

## v1 feature walk-through

- [x] Theme toggle persists suite.theme AND redraws the SVG chart (v1 read chart colors from
  CSS vars at draw time) — interaction.txt: chart stroke #2f6f6a -> #6fb5ae on toggle,
  redrawn:true; harness probe light->dark, aria-pressed=true.
- [x] Three stat cards (unemployment, participation, payroll MoM change) with latest value,
  month label, and 24-month sparkline — interaction.txt: 4.2% Jun 2026 / 61.5% Jun 2026 /
  +57K Jun 2026 · month-over-month, sparkline=true x3; matches the live BLS numbers.
- [x] Payroll change computed from the level series (month-over-month diff in thousands) —
  +57K = 158,984 - 158,927 (Jun - May levels); also exercised via relay merge: +1,016K.
- [x] 4-year unemployment SVG chart: gridlines, % axis labels, month x-labels, area fill,
  line, end dot — 2 paths, 3 gridlines, 12 text labels; screenshots both themes.
- [x] Chart note with latest reading — "Latest embedded reading: Jun 2026." and moves to
  "Aug 2026" after a paste merge.
- [x] Three BLS link chips (Employment Situation, Unemployment chart, BLS data tools) —
  hrefs byte-identical to v1; visible in screenshots (navigation links, not endpoints).
- [x] "Update the data" panel: series selector, paste textarea, both v1 row formats parsed
  ("2026 M07 9.9" and "2026-08,9.8" exercised in one merge), merge writes suite.data.jobs,
  ok message, textarea cleared, all renders re-driven — interaction.txt.
- [x] Paste error path — "Couldn't find any year-month + value rows…" exercised with a
  garbage paste.
- [x] Clear my updates — key removed (null), display reverts to embedded-only, ok message.
- [x] Relay live path: URL persisted, three BLS v1 series fetched through the relay, M-periods
  parsed ("-" values skipped, code identical to v1), merged into overrides, re-rendered —
  route-fulfilled deterministically; "Live fetch merged 3 data points."; headline 3.3% Jul 2026.
- [x] Relay contract: all three requests exactly `<base>?url=<encoded>` per Suite.relay /
  relay/worker.js — requested-as-expected=true x3 (URL-normalized: bare host gains "/").
- [x] Relay empty-input error — "Enter a relay URL first." exercised.
- [x] Relay fetch-failure message path — code inspection (catch renders "Relay fetch failed: …";
  same shape as v1) and exercised on the v1 side (v1Interact aborts the relay fetch); not
  separately driven on v2.
- [x] Works offline / file:// with zero network — all http(s) aborted, reload, full render
  from embedded data (offline-embedded.png). The tool makes no network requests by default,
  so there is no cache/stale path to verify (network "blocked", cacheTtlMin null).
- [x] Back link, header, tag copy, footer attribution — byte-identical copy; screenshots.

## changes beyond the recipe

- **Embedded-data remediation (the Batch C task):** v1's `EMB` object (internal names
  unemp/part/payroll) became the `@suite:bls` marker object keyed by real BLS series IDs with
  `asOf`/`start`, refreshed to current data and verified live. Internal v1 vocabulary is kept
  via the SERIES_IDS mapping so suite.data.jobs override keys stay byte-compatible.
- **.example removal (fatal gate):** v1 relay placeholder `https://my-relay.example/?url=`
  replaced; relay input now takes a base URL (placeholder `https://your-worker.workers.dev`).
- **Relay behind Suite.relay (route-fulfilled):** v1's raw-prefix concat with a second
  unencoded-fallback fetch became the single `<base>?url=<encoded>` contract via
  Suite.relay + Suite.fetchJSON (12 s timeout, uncached — parity with v1's uncached relay
  fetch). Writes the suite-wide `suite.relay.url`; reads v1's legacy `suite.relay` once as a
  prefill (stripping a trailing `?url=`) so a v1 user's saved relay still appears.
- **Reference-month stamp** (`#dataStamp` pill) — mandated first-class labeling; the only
  visual addition (accounts for the ~40 px body-height diff in computed-style-diff.txt).
- **Theme-redraw wiring:** core's toggle doesn't know about the chart, so the tool adds its
  own #themeBtn click listener (registered after Suite.theme.init, so it runs post-toggle)
  calling render() — preserves v1's redraw-on-toggle behavior.
- **.card resets** vs core's flex card: display:block; flex-direction:row; gap:normal
  (shared pattern with currency/gas/markets).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| suite.theme | bare string | identical (core) |
| suite.data.jobs | JSON `{unemp:{ym:v},part:{...},payroll:{...}}` | byte-identical shape via Suite.store |
| suite.relay | raw prefix string, read+written | read once as prefill only — never written or deleted |
| suite.relay.url | — | written by the relay path (suite-wide Suite.relay convention) |

localstorage.json: keysOnlyInV1=["suite.relay"], keysOnlyInV2=["suite.relay.url"] — exactly the
mandated convention change, explained above; all other keys identical. (Values of
suite.data.jobs differ at snapshot time only because v2's last interaction was the fake relay
merge — shape and key are identical.)

## escape allowlist requests

All remote-ish values in the stats innerHTML are Suite.esc()-wrapped. Requesting allowlist for
locally-generated markup/numbers only:

- `${sparkline(U.slice(-24),css("--accent"))}` / `${sparkline(P.slice(-24),css("--c2"))}` /
  `${sparkline(C.slice(-24),css("--c3"))}` (render() stats template) — returns SVG markup built
  entirely from numeric coordinates (`toFixed(1)`) and a getComputedStyle color; escaping would
  destroy the markup. Inputs are numbers by construction (embedded JSON numbers or parseFloat
  results — user paste and relay values alike are reduced to floats before storage).
- Inside `sparkline()`: `${W}`, `${H}`, `${d}`, `${color}`, `${x(...)}`, `${y(...)}` — numeric
  path data and CSS custom-property color values.
- Inside `drawChart()`: `${padL}`, `${W-padR}`, `${yy}`, `${(+yy+3).toFixed(1)}`, `${v}%`,
  `${grid}`, `${muted}`, `${accent}`, `${x(i).toFixed(1)}`, `${Ht-padB+16}`, `${area}`, and the
  line/circle coordinate interpolations — all local math on numbers plus getComputedStyle
  colors; the month labels there ARE wrapped in Suite.esc(fmtMonth(...)).

## a11y applied

- Chart SVG: `role="img"` + descriptive aria-label (v1 had none); sparkline SVGs
  `aria-hidden="true"` (decorative, values are adjacent text).
- Suite.liveRegion on #pasteMsg, #relayMsg, and #stats (async/action-updated regions).
- Labels: `for=` on series select, paste textarea, relay input (v1 already had these — kept).
- Enter in the relay input triggers Fetch live (text-entry + button pair rule).
- Theme button aria-label + aria-pressed from core; focus-visible outlines from core.
- No overlays; details/summary is natively keyboard-operable.

## endpoints

`[]` — the tool can contact nothing from the browser by default: data is embedded, BLS links
are plain navigation (`<a href>`), and the optional relay host is user-configured (unknowable
at build time, unset for everyone by default). api.bls.gov is contacted only at build time from
the terminal (`--refresh-data`) and already appears in CATALOG.md.

## concerns for the reviewer

1. **Marker schema has one key beyond the spec's example:** `{"asOf","start","series"}` —
   `start` is required to map the dense arrays to months. The schema is documented in the
   comment directly above the marker; build.py --refresh-data must emit it (or the tool
   breaks). Flagging so the orchestrator implements the refresher against this exact shape
   (inflation.html should use the same one).
2. **suite.relay -> suite.relay.url has no Suite.store.migrate entry.** MIGRATION.md §4 says
   renames need one, but this is the suite-wide relay convention shared by all Batch C relay
   tools, and migrate() lists are suite-global — a per-tool entry would be wrong. Mitigation
   here: the legacy key is read as a prefill and left untouched. Orchestrator should decide
   once, suite-wide.
3. **v1 on disk differs from the batch prompt's description.** The prompt says "v1 fetches
   LNS14000000 through my-relay.example"; the actual ../Local Suite/jobs.html already ships
   embedded EMB data (comment dated 2026-07-14) with the relay as an optional path (the
   .example string only in the input placeholder). The migration was diffed against the file
   on disk (the authority per standing rules). Worth confirming nothing modified the v1 repo.
4. **v2 relay fetch-failure branch not driven in the harness** (empty-input and contract/
   success paths are; the failure branch is code-inspected and exercised on v1). Trivial to
   add if the reviewer wants it.
5. Harness note: the after-interaction screenshot intentionally shows the fake relay-merged
   state (3.3% Jul 2026 etc.) — that is test fixture data proving the merge path, not real
   BLS data. The clean embedded state is in v2-light/dark.png and offline-embedded.png.

## Phase 4 a11y audit (2026-07-16)

Independent re-verification of the QUALITY.md §2 checklist, executed in the running tool
(Playwright/Chrome from file://, light + dark, keyboard-only drive of the primary feature,
contrast computed from getComputedStyle with ancestor alpha-compositing).

| # | Checklist item | Verdict | Evidence |
|---|---|---|---|
| 1 | icon-only controls have accessible names | pass | unnamed: (none) |
| 2 | async/result regions carry aria-live | pass | runtime check below |
| 3 | keyboard path for every mouse path | pass | keyboard-only drive log below; no positive tabindex ((none)); no traps |
| 4 | inputs labelled | pass | unlabelled: (none) (labelled: 3) |
| 5 | contrast, both palettes | fixed (see below); remaining FAILs are the suite-wide --muted flags | full pair tables below |
| 6 | visible focus indicator | pass | light: all stops show an indicator; dark: all stops show an indicator |

### Contrast — light
```
contrast pairs (11 unique fg/bg combos):
  pass 4.08 (need 3) fg=#b06d2b bg=#fffdf9 32px/700 — b "61.5%"
  FAIL 4.1 (need 4.5) fg=#6b7280 bg=#efece4 12.8px/400 — p#dataStamp.stamp "Data: June 2026 · refreshed mont"
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.1px/400 — footer "Data: U.S. Bureau of Labor Stati"
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 13.6px/400 — label "Relay URL"
  pass 5.11 (need 3) fg=#4a6f9c bg=#fffdf9 32px/700 — b "+57K"
  pass 5.26 (need 4.5) fg=#2f6f6a bg=#f5f3ee 14.4px/400 — a.back "← suite"
  pass 5.26 (need 4.5) fg=#f5f3ee bg=#2f6f6a 14.4px/600 — button#relayBtn.btn "Fetch live"
  pass 5.74 (need 3) fg=#2f6f6a bg=#fffdf9 32px/700 — b "4.2%"
  pass 5.74 (need 4.5) fg=#2f6f6a bg=#fffdf9 12.8px/400 — a "bls.gov/data"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 27.2px/700 — h1 "Jobs & Unemployment Snapshot"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> a.linkchip [outline] -> a.linkchip [outline] -> a.linkchip [outline] -> summary [outline] -> a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> a.linkchip [outline]
```

### Contrast — dark
```
contrast pairs (11 unique fg/bg combos):
  pass 5.47 (need 4.5) fg=#9aa0a8 bg=#262a31 12.8px/400 — p#dataStamp.stamp "Data: June 2026 · refreshed mont"
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 11.8px/400 — div.lbl "Unemployment rate"
  pass 6.46 (need 3) fg=#7ea6d6 bg=#1d2026 32px/700 — b "+57K"
  pass 6.69 (need 3) fg=#d69a52 bg=#1d2026 32px/700 — b "61.5%"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.1px/400 — footer "Data: U.S. Bureau of Labor Stati"
  pass 6.91 (need 3) fg=#6fb5ae bg=#1d2026 32px/700 — b "4.2%"
  pass 6.91 (need 4.5) fg=#6fb5ae bg=#1d2026 13.1px/400 — a.linkchip "Employment Situation →"
  pass 7.6 (need 4.5) fg=#6fb5ae bg=#15171b 14.4px/400 — a.back "← suite"
  pass 7.6 (need 4.5) fg=#15171b bg=#6fb5ae 14.4px/600 — button#mergeBtn.btn "Merge & refresh"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 27.2px/700 — h1 "Jobs & Unemployment Snapshot"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> a.linkchip [outline] -> a.linkchip [outline] -> a.linkchip [outline] -> summary [outline] -> a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> a.linkchip [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached paste textarea (TEXTAREA#paste after 3 tab(s))
  Tab -> reached merge button (BUTTON#mergeBtn after 1 tab(s))
  keyboard paste-merge -> headline 4.2% -> 9.9%, msg "Merged 1 month into the unemp series."
  Tab -> reached clear button (BUTTON#clearBtn after 1 tab(s))
  keyboard clear -> "Your updates were cleared. Showing embedded data only."

### aria-live runtime check
  #pasteMsg: aria-live=polite
  #relayMsg: aria-live=polite
  #stats: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
- `.btn` text `#fff` -> `var(--bg)`: white on the dark-theme accent #6fb5ae was 2.36:1; now 5.26:1 light / 7.60:1 dark. (The light `#dataStamp` muted-on-chip 4.10 is the suite-wide `--muted` flag below, not fixed locally.)

### Suite-wide contrast flags (REPORTED, not fixed locally — core palette)

The light palette's `--muted` (#6b7280) misses WCAG AA 4.5:1 on two core surfaces
(it passes on `--card` at 4.76, and the dark palette passes everywhere, 5.5-6.8):

| pair | ratio | where it shows in this tool set |
|---|---|---|
| `--muted` on `--bg` #f5f3ee | **4.36** | core `footer` rule; tool taglines/hints/stamps on the page background (every tool) |
| `--muted` on `--chip` #efece4 | **4.10** | core `.chip`; tool-local chip-bg recreations (jobs #dataStamp, markets .caveat, settings/transit/passes `code`, airport chips, hub chips) |
| `--muted` on `--accent-soft` #e3efed | **4.11** | parks `.code` chip inside picker rows |

Root cause is the palette value, not any one tool: per the audit addendum these are
suite-wide failures — fixing them tool-by-tool would fork the palette across 71 files.
Suggested one-line core remedy (NOT applied): darken light `--muted` to ~#5f6670
(-> 5.23 on --bg, 4.91 on --chip, 5.71 on --card). Decision belongs to core.

### Harness re-runs
- `node verify-tool.mjs jobs` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
