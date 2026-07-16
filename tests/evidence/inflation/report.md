# inflation.html — migration report (Batch C, embedded-BLS remediation; completer agent)

Draft provenance: a prior agent's unverified draft (`handoff/batchC-drafts/inflation.html`)
was diffed against v1 and against the live BLS API, found essentially complete, fixed in one
spot (`.card` computed-style parity), moved to `tools/inflation.html`, and fully verified.

## draft completeness assessment

The interrupted agent's draft was ~99% done. Diffed line-by-line against v1 and the specs:

- Recipe (boilerplate strip, core link/script, `Suite.theme.init()`, addEventListener
  conversion, `Suite.store`/`Suite.esc`/`Suite.liveRegion`): all correctly applied.
- `@suite:bls` marker: present, exactly to spec, 5 series with `id`/`start`/`values`,
  `asOf` "2026-06". **Independently verified against a fresh live BLS pull — every value
  of all 5 series matched byte-for-byte, including the 2025-10 `null`** (BLS publishes
  `"-"` for that month; see below). The draft's data was real, not fabricated.
- One fix by the completer: draft's `.card { gap: 0 }` override (countering core's
  flex-card gap) computes `0px` vs v1's `normal` → changed to `gap: normal`.
  Verified: `.card` no longer differs in the computed-style diff.
- Nothing else missing or broken; no partial `tests/interactions/` or evidence files
  existed (the interaction module and all evidence here are new, by the completer).

## embedded data + the exact refresh command

Marker: `const BLS = /* @suite:bls */{"asOf":"2026-06","series":{...}}/* /@suite:bls */;`
Series (monthly, NSA, from 2021-01, 66 values each, `null` = unpublished month):

| name | BLS series ID |
|---|---|
| headline | CUUR0000SA0 |
| core | CUUR0000SA0L1E |
| food | CUUR0000SAF1 |
| energy | CUUR0000SA0E |
| shelter | CUUR0000SAH1 |

ONE batched terminal request (v1 API, keyless), run 2026-07-15; raw response archived as
`bls-live-response.json` in this directory:

```
curl -sS -X POST "https://api.bls.gov/publicAPI/v1/timeseries/data/" \
  -H "Content-Type: application/json" \
  -d '{"seriesid":["CUUR0000SA0","CUUR0000SA0L1E","CUUR0000SAF1","CUUR0000SA0E","CUUR0000SAH1"],"startyear":"2021","endyear":"2026"}'
```

Result: `REQUEST_SUCCEEDED`, all 5 series 2021-01 → 2026-06, each with value `"-"` for
2025-10 (the BLS publication gap — kept as `null` in the marker). The embedded object is
identical to this live response, so no marker rewrite was needed.

Reference-month labeling is first-class: a `.stamp` pill under the header reads
**"Data: June 2026 · refreshed monthly at build time"** (driven by `BLS.asOf`), and every
stat/sparkline/category card carries its own month label.

## v1 feature walk-through

- [x] Headline + core stat cards with YoY %, month, accent colors — interaction.txt line 2:
      "headline +3.5% (Jun 2026 · year-over-year) | core +2.6% (Jun 2026 · ex food & energy)";
      screenshots both themes.
- [x] 36-month YoY SVG chart, 2 series, gridlines, %-axis, 6-month x labels, end dots —
      2 paths + 6 gridlines counted in interaction.txt; visually compared v1/v2 both themes.
- [x] Chart repaints on theme flip (v1: themeBtn.onclick called render()) — v2 adds a click
      listener calling render() after core's toggle; dark screenshots show recolored chart.
- [x] 24-month sparklines for headline + core — rendered, visible in screenshots.
- [x] Category breakdown (Food/Energy/Shelter) with up/down coloring and vintage label —
      v1 hardcoded 3 values ("May 2026 vintage"); v2 computes them from the embedded
      per-category series (Jun 2026: Food +3.0%, Energy +15.7%, Shelter +3.3%). See
      "changes beyond the recipe".
- [x] "Update the data" panel: series selector, paste parsing (all 3 v1 formats — the
      regexes are byte-identical to v1), merge into suite.data.cpi, success/error msg —
      exercised: pasted "2026 M07 337.9", got "Merged 1 month into headline CPI.",
      headline became +4.6% (Jul 2026).
- [x] "Clear my updates" — exercised: key removed, stats reverted to Jun 2026 embedded.
- [x] Error path for unparseable paste — same v1 code path/message (verified by reading;
      not driven).
- [x] Relay live-fetch (v1: prefix + encodeURIComponent(url), merged like a paste) —
      preserved behind Suite.relay per the Batch C addendum; deterministically verified:
      route-fulfilled fake relay at https://relay.test, clicked "Fetch live", observed both
      rewritten requests (`https://relay.test/?url=https%3A%2F%2Fapi.bls.gov%2F...CUUR0000SA0`
      and `...SA0L1E` — the `<base>?url=<encoded>` worker contract), "Live fetch merged 2 data
      points.", stats updated to Jul 2026 (+4.7% / +3.2%).
- [x] Relay URL persisted and prefilled on load — stored to suite.relay.url; the input is
      prefilled from suite.relay.url, falling back to a legacy v1 suite.relay prefix.
- [x] Offline-first: full render from file:// with ALL http(s) requests aborted —
      interaction.txt line 6 + offline-embedded.png. This tool's designed state IS offline
      (network "blocked", embedded data); there is no suite.cache path to age.
- [x] Footer attribution, back link, theme toggle (light→dark, aria-pressed=true).

## changes beyond the recipe

- **`.example` removal (the point of the remediation):** v1's relay placeholder
  `https://my-relay.example/?url=` is gone; the input placeholder is now
  `https://my-relay.workers.dev` and the tip documents the relay/worker.js contract.
- **Reference-month stamp** (`.stamp` pill from `BLS.asOf`) — mandated by the Batch C
  addendum ("first-class designed state"). Only UI addition; accounts for the ~42px body
  height difference in the computed-style diff.
- **Category values computed, not hardcoded:** v1 shipped 3 frozen numbers
  (Food 3.1/Energy 23.5/Shelter 3.4, "May 2026 vintage"). v2 embeds the three full index
  series and computes latest YoY, so `--refresh-data` keeps categories current too
  ("every v1 chart/category feature drives from the embedded object"). Values differ from
  v1's screenshots because the data is one month fresher — this is the feature.
- **Relay via Suite.relay/Suite.fetchJSON:** key renamed suite.relay (v1 prefix) →
  suite.relay.url (core contract; base URL). Legacy value still read to prefill the input
  (normalized by stripping a trailing `?url=`), so a v1 user's saved relay survives; writes
  go to the new key only. No Suite.store.migrate entry: the semantic changed (prefix→base),
  core/suite.js owns the key, and silent rewriting of a power-user setting seemed worse
  than the read-fallback. Flagging for orchestrator review.
- v1's undocumented fallback of retrying the relay with an *unencoded* URL on non-OK was
  dropped — the worker contract is now explicit (`<base>?url=<encoded>`); the error message
  is unchanged.
- Relay fetches carry no cacheKey: results are persisted into suite.data.cpi overrides
  (the tool's own durable store), the tool is network "blocked" with cacheTtlMin null, and
  v1 did not cache these either. Adding a suite.cache entry would double-store the data.
- M13 (annual-average) rows from a relay response are now skipped
  (`+row.period.slice(1) <= 12`); v1 would have merged them as a fake 13th month.

## localStorage keys (v1 vs v2)

| v1 | v2 | note |
|---|---|---|
| suite.theme | suite.theme | identical (bare string) |
| suite.data.cpi | suite.data.cpi | identical — snapshot values byte-equal: `{"headline":{"2026-07":338.2},"core":{"2026-07":339.5}}` |
| suite.relay | suite.relay.url | spec-mandated rename to the core Suite.relay contract; legacy key still read (see above). This is the only keysOnlyInV1/V2 entry in localstorage.json. |

## escape allowlist requests

- `sparkline(s1, css("--accent"))` — local function returning SVG markup composed only of
  `Number.toFixed()` output and a CSS custom-property value from the tool's own stylesheet;
  no remote or user data reaches it (its inputs are YoY floats computed from the embedded
  numeric series).
- `sparkline(s2, css("--core"))` — same reasoning, core series.
- `c.v != null && c.v >= 0 ? "up" : "down"` — ternary over two string literals used as a
  class name; c.v is a computed number, never interpolated here.

(Everything else interpolated into innerHTML is wrapped in `esc` = `Suite.esc`; the chart
builds its SVG string locally from numbers and esc()'d month labels, assigned via
`svg.innerHTML = g` — not a template literal at the assignment site, and its only
non-numeric inputs are css() variables and esc()'d labels.)

## a11y applied

- Chart SVG: `role="img"` + descriptive `aria-label`; sparklines `aria-hidden="true"`
  (their values are adjacent as text).
- `Suite.liveRegion()` on #pasteMsg, #relayMsg, and #stats (async-updating regions).
- Enter submits in the relay URL field (text-entry + button pair).
- All inputs already had `<label for>` in v1 (series, paste, relay) — preserved.
- Theme button aria-label/aria-pressed from core; focus-visible + reduced-motion from core.

## endpoints

`[]` — the browser page contacts nothing by default (embedded data; network "blocked").
The only possible egress is the user's own self-hosted relay (user-supplied host, unknowable
at build time; the target behind it is api.bls.gov, already narrated in CATALOG.md's BLS
entry). The bls.gov link in the panel and the footer attribution are navigation, not endpoints.

## concerns for the reviewer

- **suite.relay → suite.relay.url** rename is read-compatible but not write-back-migrated
  (reasoning above). If jobs.html (same session, same v1 key) resolves this differently,
  align us — whichever way, the two BLS tools should match.
- The relay path was verified against a route-fulfilled fake, not a real worker — nothing
  real to test against by design (suite policy: no new infrastructure). The rewritten-URL
  contract itself is asserted in interaction.txt lines 14-15.
- The `-webkit-font-smoothing` diffs are the pre-approved core difference; body height
  (+42px) is the stamp pill. No other computed-style diffs remain.
- v2 stats/categories show different numbers than v1's screenshots (Jun vs May 2026, and
  Energy +15.7% vs the frozen +23.5%) — data freshness, not a rendering regression; the
  May 2026 points on the v2 chart coincide with v1's.
- report.md was written via shell move because the PostToolUse hook blocks Write on
  report.md (expected per HANDOFF.md).

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
contrast pairs (12 unique fg/bg combos):
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.1px/400 — footer#footer "Data: U.S. Bureau of Labor Stati"
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 13.6px/400 — label "Relay base URL"
  pass 4.95 (need 4.5) fg=#2f6f6a bg=#e3efed 12.8px/400 — p#stamp.stamp "Data: June 2026 · refreshed mont"
  pass 5.12 (need 3) fg=#9a5f22 bg=#fffdf9 32px/700 — b "+2.6%"
  pass 5.12 (need 4.5) fg=#9a5f22 bg=#fffdf9 20.8px/600 — div.v "+2.6%"
  pass 5.26 (need 4.5) fg=#2f6f6a bg=#f5f3ee 14.4px/400 — a.back "← suite"
  pass 5.26 (need 4.5) fg=#f5f3ee bg=#2f6f6a 14.4px/600 — button#relayBtn.btn "Fetch live"
  pass 5.74 (need 3) fg=#2f6f6a bg=#fffdf9 32px/700 — b "+3.5%"
  pass 5.74 (need 4.5) fg=#2f6f6a bg=#fffdf9 12.8px/400 — a "bls.gov/cpi"
  pass 5.77 (need 3) fg=#b23b3b bg=#fffdf9 25.6px/600 — div.v.up "+3.0%"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 27.2px/700 — h1 "Cost-of-Living Tracker"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> summary [outline] -> a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> summary [outline] -> a [outline] -> select#series [outline] -> textarea#paste [outline]
```

### Contrast — dark
```
contrast pairs (12 unique fg/bg combos):
  pass 5.31 (need 3) fg=#e0736b bg=#1d2026 25.6px/600 — div.v.up "+3.0%"
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 11.8px/400 — div.lbl "Headline inflation"
  pass 6.69 (need 4.5) fg=#6fb5ae bg=#1b2425 12.8px/400 — p#stamp.stamp "Data: June 2026 · refreshed mont"
  pass 6.69 (need 3) fg=#d69a52 bg=#1d2026 32px/700 — b "+2.6%"
  pass 6.69 (need 4.5) fg=#d69a52 bg=#1d2026 20.8px/600 — div.v "+2.6%"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.1px/400 — footer#footer "Data: U.S. Bureau of Labor Stati"
  pass 6.91 (need 3) fg=#6fb5ae bg=#1d2026 32px/700 — b "+3.5%"
  pass 6.91 (need 4.5) fg=#6fb5ae bg=#1d2026 20.8px/600 — div.v "+3.5%"
  pass 7.6 (need 4.5) fg=#6fb5ae bg=#15171b 14.4px/400 — a.back "← suite"
  pass 7.6 (need 4.5) fg=#15171b bg=#6fb5ae 14.4px/600 — button#mergeBtn.btn "Merge & refresh"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 27.2px/700 — h1 "Cost-of-Living Tracker"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> summary [outline] -> a [outline] -> select#series [outline] -> textarea#paste [outline] -> button#mergeBtn.btn [outline] -> button#clearBtn.btn [outline] -> input#relay [outline] -> button#relayBtn.btn [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> summary [outline] -> a [outline] -> select#series [outline] -> textarea#paste [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached paste textarea (TEXTAREA#paste after 3 tab(s))
  Tab -> reached merge button (BUTTON#mergeBtn after 1 tab(s))
  keyboard paste-merge -> headline +3.5% -> +4.6%, msg "Merged 1 month into headline CPI."

### aria-live runtime check
  #pasteMsg: aria-live=polite
  #relayMsg: aria-live=polite
  #stats: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
- `.btn` text `#fff` -> `var(--bg)` (2.36:1 on the dark accent -> 7.60:1).
- Light `--core` #b06d2b -> #9a5f22: the core-CPI figures (20.8px/600 spark values, category cards) were 4.08:1 on the card; now 5.12:1 (4.69 on --bg). Dark `--core` already passed (6.69).

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
- `node verify-tool.mjs inflation` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
