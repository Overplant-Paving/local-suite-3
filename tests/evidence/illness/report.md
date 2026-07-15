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
