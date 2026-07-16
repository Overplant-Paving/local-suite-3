# spaceweather.html — migration report (Batch B)

## v1 feature walk-through

- [x] **First-run "Set your location" card** when `suite.location` is absent — verified: harness opens with no location; interaction.txt line 1 logs the card; v1/v2 screenshots (both themes) show it side-by-side identical.
- [x] **ZIP lookup via zippopotam.us** (5-digit validation, "Looking up…" progress, saves `suite.location` with "City, ST ZIP" label, then loads) — verified live: ZIP 90012 -> locLabel "Los Angeles, CA 90012" (interaction.txt line 19).
- [x] **Enter key submits the ZIP field** — v1 keydown -> `#zipGo.click()` listener preserved verbatim.
- [x] **"Use my location" geolocation path** — code preserved (success -> `saveLocation` + load; error -> message). Not exercisable headless; failure-message path unchanged from v1.
- [x] **"change" button returns to the location card** — verified: interaction clicks `#changeLoc` and the ZIP flow ran on the card it rendered.
- [x] **Planetary K-index gauge** (semicircular SVG arc, fill fraction kp/9, colored dot) — verified live: Kp 2.33, gauge arc stroke `var(--quiet)` (line 8); visible in v2-after-interaction.png / offline-stale.png.
- [x] **Kp readout + severity color ramp** (quiet/unsettled/minor/storm/severe by Kp band) — verified live: rendered "2.33 / 9 Kp", readout color rgb(76,175,80) = computed `--quiet`, MATCH against the band recomputed from the raw cached response (lines 6, 8).
- [x] **NOAA G-scale label from Kp** ("Quiet / unsettled" / "Active" / "G1–G5 storm") — verified live: "Quiet / unsettled" for Kp 2.33, MATCH against replicated v1 mapping (line 7).
- [x] **"as of 3-hr period to &lt;time&gt;"** stamp from the latest time_tag — rendered "as of 3-hr period to Jul 15, 10 AM" for time_tag 2026-07-15T15:00:00 UTC (line 6; harness TZ is Pacific).
- [x] **3-day Kp sparkline** (last 24 readings, dashed Kp5 storm-threshold line, band-colored end dot) — verified: 24 polyline points for 62 numeric rows, label text exact (line 9).
- [x] **Aurora visibility answer** from `suite.location` latitude (emoji + verdict + explanation; KP_LAT table; north/south hemisphere wording) — verified live for seeded LA (34.0522): "Aurora very unlikely here — At 34.1° you're too far from the poles…", MATCH against the verdict recomputed from raw Kp + lat (lines 10-11). Storm-visible and "need Kp N+" branches preserved verbatim (byte-identical logic); not naturally reachable at Kp 2.33 / lat 34.
- [x] **Aurora panel border highlights in Kp color when visible** — ternary preserved verbatim; at LA it renders `var(--line)` as designed.
- [x] **Solar wind & magnetic field panel** (speed km/s, Bt nT, Bz nT with red-when-below--5 rule, density) — verified live: 437 km/s / 7.0 nT / -2.0 nT rendered, MATCH against raw summary responses (lines 12-13). Density renders "—" by design: v1 never sources it (its own code comment says so) — preserved, not "fixed".
- [x] **NOAA storm scales R/S/G** (current "0" block, level-colored, text label) — verified live: R0/S0/G0 "none", MATCH against raw noaa-scales.json (line 14).
- [x] **Optimistic render from cache, then refresh** — preserved: the v1 model blob (`suite.cache.spaceweather`) still renders immediately when present, then the fetches run.
- [x] **Offline fallback with "offline · last data &lt;time&gt;"** — verified: caches aged 24 h + network blocked -> full dashboard rendered from stale cache with "offline · last data Jul 14, 3 PM" (line 20); offline-stale.png.
- [x] **No-cache error card with Try again** — code path preserved (`catch` -> error card, `#retry` via addEventListener). Reached only with no usable cache; the stale path was the exercised one.
- [x] **10-min auto-refresh timer + reload on tab visibility** — preserved verbatim.
- [x] **Theme toggle persisting `suite.theme`** — via core `Suite.theme`; harness probe: light -> dark, aria-pressed=true (line 21).
- [x] **Footer credit incl. the honest "rough estimate" caveat** — unchanged.

## changes beyond the recipe

- **The MIGRATION row-27 flag ("~1 MB aurora grid — cache") is a planning artifact, not a v1 feature.** v1's shipped spaceweather.html never fetches `ovation_aurora_latest.json` — the grid appears only in CATALOG.md §1.5 as a listed *option* ("cache it" was advice for whoever used it). Confirmed by grepping the whole v1 repo: the only "ovation" hit is that CATALOG line. v1's aurora answer is a local Kp-vs-latitude table (KP_LAT), no grid involved. So there is no ~1 MB entry to cache and no quota risk: total localStorage after a full live load is ~6.4 KB (interaction.txt line 17). Nothing was removed, and no grid feature was invented (parity rules: no features added).
- **Policy-mandated TTL caching (API-AND-RELAY.md §2):** v1 fetched all four SWPC products on every load and cached only the derived model blob as an offline fallback. v2 routes each fetch through `Suite.fetchJSON` with `cacheKey: "spaceweather.<kp|scales|windspeed|windmag>"` and a 10-min TTL. Proven: the second load made **0 requests to services.swpc.noaa.gov** and rendered identically from cache (line 18).
- **The v1 blob (`suite.cache.spaceweather`, `{t, v: model}`) is kept** and rewritten after every fresh (non-stale) load — a v1 user's existing cache still gives the optimistic first paint and last-resort offline fallback, and key parity holds. Write verified by read-back: 431 bytes, model kp matches the live render (line 16).
- **Stale rendering** now comes from the per-endpoint stale envelopes (any stale part triggers the v1 offline line "offline · last data &lt;time&gt;", stamped with the oldest envelope time); the blob remains the fallback when an endpoint has no cache at all (v1's original catch path, unchanged).
- **ZIP lookup left uncached**, matching weather.html and air.html: one-off user-triggered geocode, not a polled source.
- `.back` tool-local override (muted at rest, accent on hover), `.theme-btn { margin-left: auto }`, and footer override (margin-top 2.5rem, .82rem, padding-top 1rem) — v1 diverged from core chrome exactly as air.html did.
- The five severity variables (`--quiet --unsettled --minor --storm --severe`) stay tool-local, declared in all four theme contexts byte-identically to v1.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string | same (core `Suite.theme`) |
| `suite.location` | JSON `{lat, lon, label}` | same (`Suite.location`) |
| `suite.cache.spaceweather` | JSON `{t, v: model}` | same envelope, same key, still written on every fresh load |
| `suite.cache.spaceweather.kp/.scales/.windspeed/.windmag` | — | new: policy-mandated per-endpoint `{t, v}` envelopes (`Suite.fetchJSON`) |

localstorage.json: `keysOnlyInV1` empty; `keysOnlyInV2` = the four per-endpoint cache keys, all under the tool's own `suite.cache.spaceweather.` namespace — the enforced good-citizen caching (API-AND-RELAY.md §2), flagged as a policy-mandated change. (Envelope `t` values in the snapshot differ from v1's because the stale-path step deliberately ages them by -24 h before the snapshot is taken.)

## escape allowlist requests

All remote scalar text is `Suite.esc()`'d (verdict/sub, G-label, kpWhen, scale letter/level/text, error message), and v2 additionally wraps the numeric readouts v1 left bare (`esc(kp.toFixed(2))`, `esc(num(wind.*))`, `esc(model.kpHistory.length)`). Remaining unwrapped interpolations into `innerHTML`, all provably safe:

- `${av.emoji}` — one of three emoji string literals from the tool's own `auroraVerdict` return objects.
- `${kpGauge(kp)}` and `${sparkline(model.kpHistory)}` — SVG markup that must not be escaped; built exclusively from arithmetic on numbers (`kp` and history values pass v1's `typeof r.Kp === "number"` filter) plus `kpColor()` output. Their internal template interpolations are `toFixed`/numeric coordinates and `kpColor(...)`.
- `${kpColor(kp)}` (x2, style attributes) — returns one of five `var(--…)` string literals.
- `${av.verdict.startsWith("Aurora may") ? kpColor(kp) : "var(--line)"}` (aurora border style) — both branches local literals.
- `${wind.bz != null && wind.bz < -5 ? "var(--storm)" : "inherit"}` (Bz style) — both branches local literals.
- `${col}` in `scaleCell` — value from the local `cols` literal map with local fallback `var(--muted)`; remote data only selects the entry.
- `${scaleCell("R", …)}`, `${scaleCell("S", …)}`, `${scaleCell("G", …)}` — HTML assembled immediately above with every remote field esc'd.
- The `${msg ? … : ""}` wrapper in `renderFirstRun` — inner value is `${esc(msg)}`; outer is a local template wrapper.

## a11y applied

- `Suite.liveRegion()` on `#main` (every fetched panel renders into it) and `#updated` (freshness/offline announcements).
- Theme button `aria-label` + `aria-pressed` via core `Suite.theme.init()`; harness probe green.
- `aria-hidden="true"` added on the decorative aurora emoji `<div class="emoji">` (the verdict text carries the meaning) — the only markup addition.
- Gauge and sparkline SVGs already `aria-hidden="true"` in v1 — kept.
- ZIP input keeps its v1 `<label for="zip">`; Enter submits (v1 behavior kept). All controls are real `<button>`s with text; no icon-only buttons besides the core-labeled theme button; no overlays, so no Esc path needed.
- Focus-visible outlines and reduced-motion guard from core; v1's explicit `.skel { animation: none }` reduced-motion rule kept. The v1 `.field input:focus { outline: none }` rule is kept for visual parity — the accent border-color change remains the focus indicator, as in v1 and air.html.

## endpoints

- `https://services.swpc.noaa.gov` — all four data sources: `/products/noaa-planetary-k-index.json`, `/products/noaa-scales.json`, `/products/summary/solar-wind-speed.json`, `/products/summary/solar-wind-mag-field.json`. In CATALOG.md ("NOAA SWPC space weather … verify (widely used)") — this run is a live CORS-from-`file://` confirmation; the CATALOG verification date could be touched. Note v1 loads **no imagery** — gauge and sparkline are inline SVG, so no img-src hosts.
- `https://api.zippopotam.us` — ZIP -> coordinates on the first-run card. In CATALOG.md (verified).
- `ovation_aurora_latest.json` (the ~1 MB grid named in CATALOG §1.5 and MIGRATION row 27) is **not an endpoint of this tool** — see "changes beyond the recipe".
- `cacheTtlMin: 10` — weather-class source per API-AND-RELAY.md §2; matches v1's own 10-min auto-refresh timer exactly, so the enforced cache never makes the tool staler than v1 was, and SWPC's product update cadences (1-min summaries, minutely scales, 3-hr Kp bins) lose at most one refresh cycle of freshness.

## concerns for the reviewer

- **The burn-down row's "~1 MB aurora grid — cache" flag doesn't match shipped v1 code** (details above). If the orchestrator *wants* the ovation grid added as a v2 feature (e.g. a real oval-position answer instead of the KP_LAT approximation), that's a deliberate feature decision beyond this migration's parity mandate — happy to do it as a follow-up, but it needs UI design (v1 has no surface that consumes the grid).
- **Interaction console noise:** the stale-path reload logs four `Failed to load resource: net::ERR_FAILED` lines (the four deliberately blocked SWPC fetches). The harness classifies `net::ERR` as non-hard; exit code 0. No other console output.
- **Live-fetch volume:** one request per SWPC product on v2 plus the same four on v1 (`v1Interact`), one zippopotam call, and a deliberate second v2 load that proved **0** network hits — within etiquette.
- **Kp=0 fallback:** if SWPC ever returns a Kp array with no numeric rows, v1 (and v2, identically) renders Kp 0.00 "Quiet" rather than an error. Live data is currently numeric objects (verified this run), so this dormant v1 quirk is preserved, not triggered.
- **Fresh-within-TTL serve** is the one observable behavior change vs v1 (reopening within 10 min shows "updated N min ago" instead of refetching) — the enforced good-citizen policy, flagged as required.
- **computed-style-diff:** only `-webkit-font-smoothing` (pre-approved), `.theme-btn float: right` from core (inert — the button is a flex item inside `.topbar`, so float doesn't affect layout; screenshots pixel-match), and `.field input outline-offset: 2px` from the core focus-visible rule (invisible — the kept v1 `outline: none` focus rule wins on outline itself; the harness captures the page with the ZIP field auto-focused).
- `v2-after-interaction.png` is dark-mode because the harness's theme-toggle probe runs before that shot; it doubles as a dark-theme capture of the fully rendered stale state.

## Phase 4 a11y audit

Re-verification of the QUALITY.md §2 per-tool checklist (agent a11y-3, 2026-07-16). Runtime
checks against tools/spaceweather.html from file:// in both themes, all four SWPC feeds +
zippopotam route-fulfilled with fixtures (Kp 4.33 → the "Active"/--unsettled band, R1/S0/G2
scales); raw measurements in [a11y-phase4.txt](a11y-phase4.txt).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only buttons named | pass | zero symbol-only buttons/links; gauge/sparkline SVGs are `aria-hidden` with adjacent text |
| 2 | aria-live on async containers | pass | `#main` + `#updated` are `Suite.liveRegion` |
| 3 | Keyboard paths | pass | ZIP auto-focus + Enter renders the full station keyboard-only; no overlays |
| 4 | Input labels | pass | `<label for="zip">` |
| 5 | Contrast, both palettes | **fixed** | the tool's severity-ramp vars color TEXT (Kp value 2.8rem/800, G-label 1rem/700, scale letters 1.5rem/800). Light values failed on the card: --quiet #4caf50 2.7:1, --unsettled #cbb733 **2.0:1**, --minor #e08b2f 2.6:1, --storm #d34a3d 4.36:1, --severe #8e63c0 4.47:1. Light ramp darkened to #39833c/#827521/#a66723/#cd483b/#8b61bc (all ≥ 4.5:1); dark ramp unchanged (measured 4.9–9.1:1). First-run error note → theme-split `--errnote` |
| 6 | Focus visibility | pass | core `:focus-visible` outline confirmed via real-Tab probe |

`tests/interactions/spaceweather.mjs` needs no change — it resolves expected colors from the CSS
variables at runtime. Suite-wide flag (not fixed locally): `--muted` on `--bg` = 4.36:1.

No behavior change; re-verified with `node verify-tool.mjs spaceweather` — exit 0, evidence files in this directory regenerated 2026-07-16.

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.btn`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
