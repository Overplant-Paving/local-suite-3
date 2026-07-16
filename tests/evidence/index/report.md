
## Phase 4 a11y audit (2026-07-16)

Independent re-verification of the QUALITY.md §2 checklist, executed in the running tool
(Playwright/Chrome from file://, light + dark, keyboard-only drive of the primary feature,
contrast computed from getComputedStyle with ancestor alpha-compositing).

| # | Checklist item | Verdict | Evidence |
|---|---|---|---|
| 1 | icon-only controls have accessible names | pass | unnamed: (none) |
| 2 | async/result regions carry aria-live | FIXED | runtime check below |
| 3 | keyboard path for every mouse path | pass | keyboard-only drive log below; no positive tabindex ((none)); no traps |
| 4 | inputs labelled | pass | unlabelled: (none) (labelled: 1) |
| 5 | contrast, both palettes | fixed in tools/index.html (dist re-audit pending next build); remaining FAILs are the suite-wide --muted flags | full pair tables below |
| 6 | visible focus indicator | pass | light: all stops show an indicator; dark: all stops show an indicator |

### Contrast — light
```
contrast pairs (11 unique fg/bg combos):
  FAIL 3.23 (need 4.5) fg=#b0752a bg=#f5e9d8 11.5px/400 — span.chip.warn "embedded"
  FAIL 4.1 (need 4.5) fg=#6b7280 bg=#efece4 11.5px/400 — span.chip "settings.html"
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.6px/400 — footer "Everything here runs from a sing"
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 14.1px/400 — p.desc "Backup and restore, API keys, re"
  pass 4.95 (need 4.5) fg=#2f6f6a bg=#e3efed 11.5px/400 — span.chip.good "file:// ✓"
  pass 5.26 (need 3) fg=#2f6f6a bg=#f5f3ee 24px/700 — b "62"
  pass 5.74 (need 4.5) fg=#2f6f6a bg=#fffdf9 13.1px/400 — summary "data · api.bart.gov"
  pass 5.83 (need 4.5) fg=#ffffff bg=#2f6f6a 13.1px/400 — button.pill.on "All"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 30.4px/700 — h1 "Local Suite · Command Center"
  pass 13.39 (need 4.5) fg=#23282e bg=#f5f3ee 18.4px/700 — h2 "🧰 Utilities & Toys (offline)"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: button#themeBtn.theme-btn [outline] -> input#q.search [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline]
```

### Contrast — dark
```
contrast pairs (11 unique fg/bg combos):
  FAIL 2.36 (need 4.5) fg=#ffffff bg=#6fb5ae 13.1px/400 — button.pill.on "All"
  FAIL 3.39 (need 4.5) fg=#b0752a bg=#372f27 11.5px/400 — span.chip.warn "embedded"
  pass 5.47 (need 4.5) fg=#9aa0a8 bg=#262a31 11.5px/400 — span.chip "settings.html"
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 13.1px/400 — button.pill "☀️ Weather & Sky"
  pass 6.3 (need 4.5) fg=#6fb5ae bg=#1f292b 11.5px/400 — span.chip.good "no key"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.6px/400 — footer "Everything here runs from a sing"
  pass 6.91 (need 4.5) fg=#6fb5ae bg=#1d2026 13.1px/400 — summary "data · api.weather.gov · api.zip"
  pass 7.6 (need 3) fg=#6fb5ae bg=#15171b 24px/700 — b "72"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 30.4px/700 — h1 "Local Suite · Command Center"
  pass 14.25 (need 4.5) fg=#e7e5e0 bg=#15171b 18.4px/700 — h2 "☀️ Weather & Sky"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: button#themeBtn.theme-btn [outline] -> input#q.search [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> button.pill [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline] -> a [outline] -> summary [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  "/" shortcut -> search focused: true
  typed "password" -> grid filtered to 1 card(s)
  Esc -> search cleared (value=""), all cards back: 72
  Tab -> reached Space & Flight pill (BUTTON after 4 tab(s))
  Enter on category pill -> filtered to 1 section, 6 cards
  Tab -> reached first tool card link (A after 14 tab(s))
  tool card link reachable by Tab (Enter would navigate — verified focusable)
  Tab -> reached card data summary (SUMMARY after 1 tab(s))
  Enter on summary -> details open: true

### aria-live runtime check
  #cats: aria-live=(missing)
  #empty: aria-live=(missing)
```

### Source-hub (tools/index.html) fix verification
```
### keyboard-only primary-feature drive
  "/" -> search focused: true
  typed no-match query -> #resStatus (aria-live=polite) announces: "Nothing matches — try fewer filters."
  Esc -> cleared; #resStatus now: "Nothing matches — try fewer filters." (0 tools in source hub — grid is build-injected)
  .pill.on computed: color=rgb(245, 243, 238) on bg=rgb(47, 111, 106) ("All")

### aria-live runtime check
  #resStatus: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
(fixes applied to tools/index.html ONLY, per the HUB EXCEPTION; dist/index.html needs the next build to pick them up)
- `.pill.on` text `#fff` -> `var(--bg)` (2.36:1 on the dark accent -> 5.26/7.60).
- `.chip.warn` ink: the single hardcoded #b0752a (3.23:1 light / 3.39:1 dark on its tint) -> new four-context `--warn-ink` var: #8a5a1d light (4.92), #d69a4c dark (5.37).
- NEW visually-hidden live status `#resStatus` (aria-live=polite): render() now announces "N tools shown" / "Nothing matches — try fewer filters." after every search/pill filter — the grid itself stays non-live (announcing 72 re-rendered cards would be noise). Verified at runtime on the source hub: typing a no-match query announces the empty message.

(NOTE: pre-fix failing pairs are archived in the audit log; the tables above are post-fix.)

### Notes
- HUB EXCEPTION followed: populated-grid checks (search filter, "/" shortcut, Esc clear, pills, card links, details) ran against dist/index.html; chrome + fix verification ran against tools/index.html (grid is build-injected, so the source hub renders 0 cards by design). The dist copy still shows the pre-fix values until the next build — REBUILD REQUIRED for the hub fixes to ship.

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
- No per-tool interactions module exists for the hub (covered by smoke.mjs); tools/index.html changes verified by the source-hub runtime pass above. **dist/index.html must be rebuilt** (never edited by hand).
