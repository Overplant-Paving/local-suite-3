# illness.html — migration report (Batch B, CORS-open fetcher)

Tool: **Illness Activity Tracker** — COVID wastewater trend + weekly flu/RSV/COVID hospital
admissions for a chosen US state. Two live data.cdc.gov Socrata sources.

## v1 feature walk-through

Every v1 feature verified on v2 (evidence in `interaction.txt`, screenshots, `localstorage.json`):

- [x] **State picker** — all 51 options (50 states + DC + PR) built from `STATES`; verified selecting
  CA (default) then TX re-fetches and re-renders both panels (`interaction.txt` lines 6–8).
- [x] **State seeded from `suite.state`** — verified `suite.state=CA` initial, `=TX` after picking TX.
- [x] **State derived from `suite.location` label** when no `suite.state` — cleared `suite.state`, set
  label "Boston, MA", reload → picker selects **MA** (not CA fallback, not stored TX) (line 9).
- [x] **CA default** when neither key nor a parseable label exists — CA renders on first run.
- [x] **"saved on this device" note** — rendered (line 1).
- [x] **Wastewater panel (NWSS `2ew6-ywp6`)** — live 615 CA rows; mean-percentile-per-`date_end`
  aggregation, level band (20/50/80 cutoffs → "High" at 79th), ±2 delta trend ("→ roughly steady"),
  purple area chart (615 pts), legend, "Latest sample week ending …" stamp (lines 2, 4).
- [x] **Hospital admissions panel (NHSN `ua7e-t2fy`)** — live 153 CA rows; 3-up grid (COVID 152, Flu
  102, RSV 19), last-non-null value, "▲/▼/→ N vs prior wk" delta, sparkline, week-ending stamp (3, 5).
- [x] **Level/virus color coding** — bignum by band, admission labels per virus; v1-dark vs v2-dark
  pixel-identical.
- [x] **SVG line chart** (`lineChart`) — first/last x-labels, baseline, fill, dot; "Not enough data"
  fallback preserved.
- [x] **Per-state caching** — `suite.cache.illness.ww.<ST>` / `.adm.<ST>`; cache-first then refresh.
- [x] **Error cards** — network-blocked MA (uncached) shows "…unavailable right now (Failed to fetch)."
  + CDC link-out + `.errcard` red border (line 10).
- [x] **Note + footer** — disclaimer w/ cdc.gov link, CDC Socrata footer — verbatim.

## changes beyond the recipe

- **Caching TTL formalized.** v1 cached with no expiry (render cache, always refetch). v2 uses
  `Suite.fetchJSON` with `ttl = 1440*60000` per API-AND-RELAY §2 (now policy). Render behavior
  identical: fresh-enough cache (<24h) renders without a hit; older cache renders first then refreshes.
  **TTL justification:** both series are *weekly* surveillance data refreshed ~weekly by CDC; 24h
  (`cacheTtlMin: 1440`) sits well under that cadence and matches the "daily stats" class.
- **Stamp suffix → three states.** v1 only appended `" (cached)"` for the initial pre-network render.
  v2: fresh → none, within-TTL cache → `" (cached)"`, `r.stale` (network failed) →
  `" (offline — cached)"` — satisfies "never pretend stale is fresh". Verified stale path shows
  "data 25 hr ago (offline — cached)" both cards (`offline-stale.png`, lines 14–15).
- Removed v1 per-file `fetchJSON`/`cacheGet`/`cacheSet`/`safeParse` and the unused `esc(el,txt)` helper.

## localStorage keys (v1 vs v2)

Identical key sets — `keysOnlyInV1: []`, `keysOnlyInV2: []`.

| Key | v1 | v2 | Notes |
|---|---|---|---|
| `suite.state` | raw string | `Suite.store.set` (bare) | byte-identical value |
| `suite.location` | read-only JSON | `Suite.store.get` | shared; never written here |
| `suite.cache.illness.ww.<ST>` | `{t,v}` | `{t,v}` via fetchJSON | same key/envelope |
| `suite.cache.illness.adm.<ST>` | `{t,v}` | `{t,v}` via fetchJSON | same key/envelope |
| `suite.theme` | raw string | `Suite.theme` | core-managed |

Cache `.v` payloads compare byte-equal in the snapshot (only `.t` timestamps differ by run time).

## escape allowlist requests

**none.** No remote data reaches `innerHTML`. All API values go via `textContent`/`createElement`.
The only `innerHTML` writes are static literals (skeletons, `= ""`, the legend swatch
`'<i style="background:var(--covid)"></i>'`). The chart is built with `createElementNS`.

## a11y applied

- `<label for="stateSel">` — v1 used a bare `<span>`; now an associated label (visually identical).
- `Suite.liveRegion()` on `#wwBody` + `#admBody` — async containers announce `aria-live="polite"`.
- Chart SVGs get `aria-label`; v1 had `role="img"` with no label (kept role, added label).
- Theme button `aria-label`+`aria-pressed` from core (toggle light→dark verified, line 16). No
  mouse-only paths / overlays / icon-only buttons; select + back-link natively operable.

## endpoints

- **Host:** `https://data.cdc.gov` — in CATALOG.md (line 273 narrative, line 531 table). Single host.
- **Datasets (confirmed live 2026-07-15 via `/api/views/<id>.json`):**
  - `2ew6-ywp6` = "NWSS Public SARS-CoV-2 Wastewater Metric Data" — 615 CA rows.
  - `ua7e-t2fy` = "Weekly Hospital Respiratory Data (HRD) Metrics by Jurisdiction, NHSN" — 153 CA rows.
  - **CATALOG note:** the NWSS narrative cites `g653-rqe2` as an *example*; the tool uses `2ew6-ywp6`
    (state-level percentile — `g653-rqe2` is raw concentration by sewershed, wrong shape). Same host,
    no CSP/gate impact. Both IDs are byte-identical to v1. Addendum only requires the host in CATALOG,
    which is satisfied; CATALOG could optionally add the two IDs.
- No image hosts (inline SVG charts).

## concerns for the reviewer

- **Dataset-ID drift.** CATALOG itself warns IDs rotate. Both resolved live today; if CDC retires
  either, the tool degrades to its error card + link-out (verified), not a blank page. IDs unchanged
  from v1, so no regression from this migration — but a maintenance touch-point.
- **Post-dated data (week ending Jul 3/4 2026).** Genuine live API max dates on this machine's clock
  (system date 2026-07-15); wastewater latest is Sep 2025 (lags more), admissions Jul 2026. Not a bug.
- **Console `net::ERR_FAILED` ×4** are the deliberate network-block phases (MA no-cache test + stale
  test). Harness filters `net::ERR`; `verify-tool.mjs` exited 0. No real console errors.
- **CA cache reuse across phases** is intentional cache-key-per-state behavior; the stale phase ages
  that cache past TTL to force the offline render. All phases exercised end-to-end, no shortcuts.

## Phase 4 a11y audit (2026-07-16)

Re-verification of the QUALITY.md §2 checklist, executed against the running tool from
`file://` with `tests/phase4-a11y-net.mjs` — all network route-fulfilled from shape-matched
payloads behind a catch-all abort (zero live requests during the audit). Machine log:
`phase4-a11y.json` in this directory. Verdict: **fixed**.

| checklist item | verdict | evidence |
|---|---|---|
| 1. icon-only controls have accessible names | pass | none present |
| 2. async result regions carry aria-live | pass | `#wwBody` -> `aria-live=polite`; `#admBody` -> `aria-live=polite` |
| 3. keyboard path for every mouse path | pass | primary flow driven keyboard-only (log below); no positive tabindex; no traps |
| 4. inputs labelled | pass | `select#stateSel[select-one]` (label[for]) |
| 5. contrast AA, both palettes | fixed | measured table below; remaining failures are suite-palette pairs (flagged, not fixable locally) |
| 6. visible focus indicator | pass | Tab-focus on `a.`: `solid 2px rgb(47, 111, 106)` vs blurred `none 3px rgb(47, 111, 106)` |

### Keyboard-only drive of the primary feature (page.keyboard only)

- KEYBOARD: state select ArrowDown -> CO -> both panels reloaded (route-fulfilled)

### Contrast measurements (computed from getComputedStyle, ancestor-composited backgrounds)

Light palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#6b7280` | `#f5f3ee` | 4.36 | 4.5 | **FAIL (suite palette)** |
| .bignum | `#b35c15` | `#fffdf9` | 4.64 | 3 | pass |
| #wwBody .trend | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .adm:nth-child(1) .lbl | `#7a48ea` | `#fffdf9` | 5.24 | 4.5 | pass |
| .adm:nth-child(2) .lbl | `#b35c15` | `#fffdf9` | 4.64 | 4.5 | pass |
| .adm:nth-child(3) .lbl | `#3a7d97` | `#fffdf9` | 4.53 | 4.5 | pass |
| .adm .val | `#23282e` | `#fffdf9` | 14.61 | 3 | pass |
| .adm .meta | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .note | `#5a6068` | `#e3efed` | 5.39 | 4.5 | pass |
| #wwBody .stamp | `#6b7280` | `#fffdf9` | 4.76 | 4.5 | pass |
| .legend | `#23282e` | `#fffdf9` | 14.61 | 4.5 | pass |

Dark palette:

| target | fg | bg | ratio | needs | verdict |
|---|---|---|---|---|---|
| header .tag | `#9aa0a8` | `#15171b` | 6.81 | 4.5 | pass |
| .bignum | `#e0995a` | `#1d2026` | 6.90 | 3 | pass |
| #wwBody .trend | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .adm:nth-child(1) .lbl | `#a586f2` | `#1d2026` | 5.67 | 4.5 | pass |
| .adm:nth-child(2) .lbl | `#e0995a` | `#1d2026` | 6.90 | 4.5 | pass |
| .adm:nth-child(3) .lbl | `#6aa9bf` | `#1d2026` | 6.25 | 4.5 | pass |
| .adm .val | `#e7e5e0` | `#1d2026` | 12.96 | 3 | pass |
| .adm .meta | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .note | `#9aa0a8` | `#1b2425` | 5.99 | 4.5 | pass |
| #wwBody .stamp | `#9aa0a8` | `#1d2026` | 6.19 | 4.5 | pass |
| .legend | `#e7e5e0` | `#1d2026` | 12.96 | 4.5 | pass |

### Fixes made (tool-local CSS/vars; no behavior changes beyond the one noted)

- Light `--covid` `#8a5cf6` -> `#7a48ea` and `--flu` `#d9772e` -> `#b35c15`: the small `.adm .lbl` tile labels measured 4.18:1 / 3.12:1 on the card; now 5.2:1 / 4.7:1 (chart lines shift a shade darker with them; `--rsv` already passed at 4.53:1). Dark palette untouched.
- `--note-ink` var: the surveillance `.note` on the accent-soft wash was muted-on-soft 4.11:1 in light; now `#5a6068` (5.4:1); dark keeps the muted gray (5.99:1, passed).

### Suite-wide contrast failures — flagged, NOT fixed locally (core palette)

- Light `--muted` `#6b7280` on `--bg` `#f5f3ee` = **4.36:1** (needs 4.5) — affects: `header .tag`.
- Same pair passes in dark (6.8:1). A ~one-step darker light `--muted` (e.g. `#61686f`, 4.9:1 on `--bg`) would clear every instance suite-wide; decision belongs to the orchestrator, not this tool.

### Verification

- `node verify-tool.mjs illness` -> exit 0 (live CDC Socrata fetches, state switch, offline-stale path green).
