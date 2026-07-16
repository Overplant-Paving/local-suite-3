# weather — evidence notes

(File created by the Phase 4 a11y audit; weather is a Phase 1 pilot — its migration evidence
is live-fetch.txt / offline.txt / the png pairs, produced by verify-pilots.mjs.)

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/weather.html` from `file://`, light + dark, with a
LIVE NWS load each theme (an active LA heat-warning alert rendered, so the alert-card styles
were audited against real data). Raw log: `phase4-a11y-audit.txt`.
**Verdict: fixed (3 contrast values + 2 missing live regions).**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass | none icon-only; `#openSettings` "⚙ setup" also carries aria-label; injected `change` span has role=button |
| 2 | async regions aria-live | **fixed** | `#updated/#alerts/#currentBody/#hourly/#daily` already polite; **added `Suite.liveRegion()` on `#radarBody`** (repaints after the radar image fetch) **and `#zipHint`** (ZIP-lookup / geolocation result line). `#stationInfo` left not-live intentionally: every load it changes is already announced by `#updated` (double-announcing the same load is noise) |
| 3 | keyboard paths | pass | keyboard-only drive: Enter opens settings modal (focus moves to `#inZip`), **Esc closes it**, coordinates typed and **Enter submits** (modal closed, live reload to New York/OKX rendered), injected `change` span reachable by Tab and opens the modal on Enter; modal inputs all `label[for]` (checked with the modal open); no traps |
| 4 | input labels | pass | `#inZip/#inLat/#inLon` via `label[for]`; unit toggle is `role=group` + `aria-labelledby` with per-button `aria-pressed` |
| 5 | contrast both palettes | **fixed** | see below |
| 6 | focus visibility | pass | 2px accent outline on every stop, both themes |

Contrast fixes (tool-local colors, all four theme contexts kept):
- `--alert` #c0392b→**#b53427** (light), #e8654f→**#ec7560** (dark): `.sev` badge on the
  12%-alert-tinted card was 4.48 (L) / 4.28 (D) → now **4.93 / 4.76**.
- new `--alert-muted` (#59606c L / #9aa0a8 D) for `.alert p` and `.alert time`: was
  `--muted` at 3.99 (L) → now **5.19 (L) / 5.2+ (D)**.
Post-fix live screenshots: `phase4-a11y-light.png` / `phase4-a11y-dark.png` (alert card visible).

Verification: verify-tool.mjs has no weather module (pilot tool; verify-pilots.mjs checks
dist/, which is rebuilt by the orchestrator — do not run build.py per the addendum). Source-
level equivalent run instead: both-theme live loads, alert render, aria-live present, zero
non-network console errors (weather-evidence run, exit 0).

SUITE-WIDE flags: muted-on-`--bg` 4.36 light (station line, unit-toggle off state, footer);
white-on-accent 2.36 dark (`.btn.primary`, unit-toggle `.on`).

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.btn.primary`, `.unit-toggle button.on`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
