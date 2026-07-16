# alerts.html migration report (Batch B)

## v1 feature walk-through

- [x] **First-run card ("Where should this board watch?")** — rendered on load with no
  `suite.location` (v1/v2 screenshots, both themes, show it); ZIP field auto-focused (code kept
  verbatim; `zip.focus()` unchanged).
- [x] **ZIP lookup via zippopotam.us** — live-verified: ZIP 90012 -> `suite.location`
  `{"lat":34.0614,"lon":-118.2385,"label":"Los Angeles, CA 90012"}` (interaction.txt lines 15-16).
  v1 label format (`City, ST 90012`) preserved.
- [x] **ZIP validation** — "123" -> "Enter a 5-digit ZIP code." (interaction.txt line 14).
- [x] **Enter submits the ZIP field** — location set via Enter keypress, not the button
  (interaction.txt line 15); v1 behavior kept.
- [x] **"Use my location" geolocation path** — code kept verbatim (handler converted to
  addEventListener); not live-driven (headless has no geolocation permission), verified by
  inspection: same success/error messages, same `+toFixed(4)` rounding, same label format.
- [x] **Live active-alerts fetch (api.weather.gov `?point=`)** — live-verified for seeded LA:
  1 active alert, "Extreme Heat Warning", severity Severe, banner "1 active alert · Most serious:
  Severe · Los Angeles, CA" (interaction.txt lines 3-7). Note: LA did NOT show the all-clear state
  during this run — there was a genuine heat warning — so the alert board itself is live-proven.
- [x] **All-clear banner** — not reachable live (see above); the zero-features branch of
  `renderAlerts` is byte-identical to v1, and the synthetic-render step confirms `renderAlerts`
  is the single entry point for both states. Verified by inspection.
- [x] **Severity sort (rank desc, then effective desc) + severity color scale** — driven
  deterministically with a synthetic 5-feature set (Minor/Extreme/Moderate/Severe/unknown-value):
  rendered order Extreme, Severe, Moderate, Minor, Unknown (interaction.txt line 9); banner picked
  the top severity ("Most serious: Extreme", line 10). Unknown fallback (`severity: "Bogus"` ->
  Unknown badge) also covered.
- [x] **Expandable alert cards (details/summary)** — first live card expanded by clicking its
  summary; "What to do" instruction block rendered (interaction.txt line 7).
- [x] **Card contents** — badge, event, "Until <time>" / certainty / urgency meta, headline,
  instruction, description, Area/Effective/Expires/Issued-by `kv` grid: all present in the live
  render (interaction.txt line 4, screenshots).
- [x] **Cached render + offline fallback** — cache aged 24 h + network blocked -> board still
  renders the alert with "offline · last data Jul 14, 12:27 PM" (interaction.txt lines 19-21,
  offline-stale.png). Not a blank page; stale data clearly labeled with its time.
- [x] **Error card with retry** — reachable only with no usable cache; code path preserved
  verbatim (retry converted to addEventListener). The offline run exercised the *fallback* branch;
  the error branch is the `catch` of the same try and renders the identical v1 markup.
- [x] **"change" location button** — returns to the first-run card, label flips to "not set"
  (interaction.txt line 13).
- [x] **Notification toggle** — clicked live: permission stayed "default"->denied in headless, so
  the toggle correctly did NOT latch on and wrote no key (interaction.txt line 12) — same v1
  behavior. Grant path verified by inspection (identical logic, store calls swapped).
- [x] **New-alert notifications (`maybeNotify`)** — `suite.alerts.seen` written after each fresh
  fetch (localstorage.json: identical id list in v1 and v2). Notification dispatch loop verbatim.
- [x] **5-minute auto-refresh + refresh on tab focus** — `setInterval(load, 5*60*1000)` and the
  `visibilitychange` listener kept verbatim.
- [x] **updated stamp ("updated just now" / rel time)** — live: "updated just now"
  (interaction.txt lines 3, 17, 22).
- [x] **Theme toggle** — light -> dark, `aria-pressed=true` (interaction.txt line 23; core-provided).

## changes beyond the recipe

- **Cache now goes through `Suite.fetchJSON`** (policy-mandated, API-AND-RELAY.md §2): v1 fetched
  on every load and used the cache only as an offline fallback; v2 declares `ttl = 5 min`, so
  reloads within 5 minutes serve the cache without a request (good-citizen change). Rendering is
  otherwise identical, and stale data is labeled exactly as v1 labeled it.
- **The v1 cache envelope's `key` field is preserved.** v1 stored `{t, key, v}` at
  `suite.cache.alerts`, where `key` is the location the payload belongs to. `Suite.fetchJSON`
  writes `{t, v}`, so the tool re-attaches `key` after every fresh fetch, and `load()` drops the
  cache (via `Suite.store.set(CACHE_KEY, null)`) when the stored key doesn't match the current
  location — so a location change can never render or stale-serve another location's alerts
  (same guarantee v1 had). Verified: envelope after live load has
  `key: "34.052,-118.244"` (interaction.txt line 8), and the ZIP change triggered a fresh fetch.
- **Cache payload shape**: `Suite.fetchJSON` stores the full GeoJSON response where v1 stored the
  filtered features array. `featuresOf()` accepts both, so a v1 user's existing cache still
  renders. The key name is byte-identical (`suite.cache.alerts`).
- **`maybeNotify` fires only on real network responses** (`!r.fromCache`), not on TTL-served
  cache hits — cache hits by definition carry no new alert ids, so behavior is equivalent.
- **`paintNotifyBtn` guard**: v1 evaluated `Notification.permission` even when
  `"Notification" in window` was false (a latent ReferenceError on unsupported browsers, where the
  button is hidden anyway); v2 short-circuits on `supported`. No behavior change where the button
  is visible.
- **ZIP lookup left uncached**, matching tools/weather.html (the canonical fetcher migration):
  it is a one-shot, user-initiated geocode; caching it per-ZIP would create unbounded
  `suite.cache.*` keys not declared in the manifest.
- **`suite.alerts.notify` read normalized through `String()`**: v1 stored bare `"0"`/`"1"`, which
  `Suite.store.get` JSON-parses to a number; writes remain bare strings, byte-identical to v1.
- **`suite.alerts.seen` read guarded with `Array.isArray`** (v1's `getJSON` returned the default
  on parse failure; `Suite.store.get` returns the raw string — the guard restores v1's tolerance).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare `"light"/"dark"` | identical (core) |
| `suite.location` | `{lat, lon, label}` JSON | identical (`Suite.location`) |
| `suite.cache.alerts` | `{t, key, v: features[]}` | `{t, v: geojson, key}` — same key name, `key` field preserved, reader accepts both shapes |
| `suite.alerts.notify` | bare `"0"/"1"` | identical bare strings |
| `suite.alerts.seen` | JSON array of alert ids | identical |

Parity run: `keysOnlyInV1: []`, `keysOnlyInV2: []` (localstorage.json); `suite.alerts.seen`
values byte-identical across versions.

## escape allowlist requests

All remote-data interpolations are wrapped in `Suite.esc()` (and the synthetic-render test proves
markup in an alert `event` is inert). Expressions interpolated into `innerHTML` **without**
`Suite.esc(` that are provably safe:

- `top.col`, `sev.col` (x4) — values come from the local `SEV` constant table; every value is a
  literal `var(--...)` string, never remote data (`sevOf` falls back to `SEV.Unknown` for
  unrecognized severities).
- `sorted.length` (x2) — array length, always a number.
- `sorted.length === 1 ? "1 active alert" : sorted.length + " active alerts"` — literals + number.
- `meta.map(m => "<span>" + m + "</span>").join("")` — every element pushed into `meta` is built
  from `esc(...)` output plus literal text ("Until " prefix).
- `p.headline ? ...esc(p.headline)... : ""` / `instr ? ... : ""` / `p.areaDesc ? ... : ""` /
  `eff ? ... : ""` / `end ? ... : ""` (x2) / `p.senderName ? ... : ""` — ternary wrappers whose
  branch templates escape every remote value; the outer expression yields only escaped-or-literal
  HTML.
- `msg ? <div class="notice"...>${esc(msg)}</div> : ""` (renderFirstRun) — `msg` is escaped
  inside; additionally `msg` is only ever a locally-authored string in the current code.
- `banner` / `cards` (final `mainEl.innerHTML = banner + ...${cards}...`) — concatenations of the
  fragments above.

## a11y applied

- `#notifyBtn` is a state toggle -> `aria-pressed` added (markup default `"false"`, kept in sync
  by `paintNotifyBtn`); verified in interaction.txt line 12. Button already has visible text +
  title.
- `#main` and `#updated` -> `Suite.liveRegion()` (async fetch results announced).
- `#locMsg` (first-run status line: "Looking up...", errors) -> `Suite.liveRegion()`.
- Decorative chevron -> `aria-hidden="true"`.
- ZIP input keeps its explicit `<label for="zip">`; Enter submits (live-verified).
- `#changeLoc`, `#zipGo`, `#geoGo`, `#retry` are real `<button>`s (keyboard path free); alert
  cards are native `<details>/<summary>` (keyboard-expandable); no overlays, so no Esc handling
  needed.
- Theme button labeling/`aria-pressed` from core `Suite.theme.init()`.

## endpoints

- `https://api.weather.gov` — `/alerts/active?point={lat},{lon}` (live-verified this run; in
  CATALOG.md §1.2 and the CORS table).
- `https://api.zippopotam.us` — `/us/{zip}` (live-verified this run; in the CATALOG.md CORS
  table). **Note:** the batch metadata listed only api.weather.gov; source verification found the
  ZIP-lookup host too, and it must be in the manifest or CSP `connect-src` will break the
  change-location flow in dist. Both hosts already appear in CATALOG.md — no CATALOG update
  needed.
- `cacheTtlMin: 5` — justification: the board's whole purpose is time-critical watches/warnings;
  v1's own designed refresh cadence is 5 minutes (footer text + `setInterval`), and
  API-AND-RELAY.md §2 puts fast-moving safety data (quakes) at 5 min vs. general weather at 10.
  5 min matches the tool's contract with the user ("Alerts refresh every 5 minutes while this tab
  is open") while still suppressing redundant requests between refreshes.

## concerns for the reviewer

- **LA had a real active alert during verification** (Extreme Heat Warning, severity Severe), so
  the live path shows the populated board, not the all-clear state. The all-clear branch was not
  observed live; it is the `!features.length` branch of `renderAlerts`, byte-identical to v1 (the
  tool note anticipated exactly this situation, in reverse). If you want it observed, re-run
  against a quiet location — but severity sort got *better* coverage than expected (1 real alert
  + 5 synthetic).
- **Live severity sort had only one real alert**, so ordering with real data couldn't be
  observed; the synthetic render (same code path, same function) covered 5 severities including
  the Unknown fallback. I consider this sufficient; flagging for transparency.
- **Cache value shape changed** (full GeoJSON response vs. filtered features array) — key name
  and envelope fields preserved, both shapes readable. A v1->v2 user loses nothing; a v2->v1
  rollback would make v1 read `cached.v` as an object and render zero alerts from cache until its
  next fetch (seconds later). Judged acceptable; mentionable in MIGRATION notes if rollback
  matters.
- **Notification grant path not exercised live** — headless Chromium auto-denies permission
  prompts. The denied path (no latch, no key write) was verified live and behaves exactly like v1
  in the same browser; the granted path is a straight store/flag swap verified by inspection.
- The `console.error: Failed to load resource: net::ERR_FAILED` in interaction.txt is the
  deliberately blocked fetch from the stale-path test (harness-exempt pattern); the console is
  otherwise clean.
## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`). NWS/zippopotam stubbed in the audit run so all five severity
badges render deterministically; `node verify-tool.mjs alerts` re-run afterwards → exit 0
**with a live NWS fetch** (real Extreme Heat Warning rendered).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | 🔔 notify toggle has text + `aria-pressed`; chevron is `aria-hidden` (summary carries the text) |
| 2 | aria-live | pass | `#main` (the board) and `#updated` liveRegion; first-run form's `#locMsg` also live (grep + runtime) |
| 3 | Keyboard path | pass | keyboard-only from first-run: ZIP field auto-focused, typed 10001 + Enter → board rendered ("5 active alerts"); alert expanded/collapsed via Enter on native `details/summary`; "change" link-button via Enter returns to the form. No custom overlays |
| 4 | Inputs labeled | pass | `#zip` has `label[for]` (form is dynamic — verified in source and in the keyboard run) |
| 5 | Contrast | **fixed** | see below |
| 6 | Focus visibility | pass | core 2px accent outline (summary, buttons, input) |

Contrast — **fixed: the severity badge scale** (tool-local). White badge text failed on
light `--moderate` **2.91**, `--minor` **2.42**, `--unknown` **3.87**, and on **all five**
dark severity colors (**1.85–3.23**, the dark scale is deliberately light because it doubles
as text on the card). Two-part fix keeping the 3-layer pattern:
- light: deepened `--moderate` #d98324→#a35f08, `--minor` #c9a227→#85690a, `--unknown`
  #7a8290→#626a78 (Extreme/Severe already passed);
- dark: badge/count ink flips to near-black via new `--sev-ink` (#fff light / #15171b dark)
  — the severity colors themselves stay light so "Most serious: <severity>" text keeps
  passing on the card (5.05–9.7 dark).
Post-fix badges: light **4.97–5.86**, dark **5.55–9.7**; banner count large-text ≥5.55 both
themes; "Most serious" strong ≥5.05 both. Instruction box 12.61/11.81, kv/meta muted-on-card
4.76/6.19.
**SUITE-WIDE flags**: light muted-on-bg 4.36 — includes this tool's `.back` link (v1 styles
it muted rather than accent), the location bar, and the updated stamp; dark #fff-on-accent
2.36 (notify toggle when on).

Fixes made: severity variables (all four theme contexts) + `--sev-ink` on `.sev-badge` /
`.banner .count`. Rendering logic, cache envelope (`suite.cache.alerts`), notify keys untouched.

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.btn`, `.notify-toggle.on`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
