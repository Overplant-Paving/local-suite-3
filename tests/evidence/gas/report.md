# gas.html — migration report (Batch C, keyed: EIA, no demo tier)

Completer-agent run: prior agent's draft at `handoff/batchC-drafts/gas.html` was diffed
line-by-line against v1, found **complete and correct** (no truncation, no missing v1
features), moved to `tools/gas.html` unchanged. All fixes during verification were in the
interaction module, not the tool.

## live-verification posture (read first)

EIA has **no demo tier** and no real key exists in this environment; per batchC-common the
designed no-key state is verified instead and **no live api.eia.gov request was made** —
inventing a key is forbidden. Every EIA request in the evidence run is route-fulfilled with
deterministic payloads in the real EIA v2 shape (`response.data[]`, string `value`s,
`product-name`/`units` fields, desc `period` sort — the shape v1's parser was written
against; sample archived as `route-payload-sample.json`). All rendered numbers are checked
against independently computed expectations in `interaction.txt`.

## v1 feature walk-through

- [x] **No-key designed state** — keycard with explanation, signup link
      (`https://www.eia.gov/opendata/register.php`), paste field. Verified: harness capture
      shots v1/v2 light+dark are exactly this state; `nokey-state.png`; interaction.txt:5-7.
- [x] **Empty-key guard** — "Paste your key first." with `.msg.err`. interaction.txt:8.
- [x] **Save key** — writes `suite.key.eia` (bare string, byte-identical to v1), hides
      keycard, shows main + all-regions cards, triggers load. interaction.txt:9.
- [x] **Hero price + meta** — `$3.100 / gal`, area label, product name, "Week of Jul 13,
      2026", week-over-week `▼ 0.052` (up=red/down=green v1 semantics via --pos/--neg).
      interaction.txt:10-11, matches generator expectations.
- [x] **Compare cards** — 1 week ago / ~1 year ago / signed+colored 1-year change; all three
      match computed expectations. interaction.txt:12-13.
- [x] **52-week SVG trend chart** — 5 grid lines, $ y-labels, month x-labels, area fill,
      trend line (stroke = live --accent), end dot. interaction.txt:14.
- [x] **All-regions card** — 6 regions, latest price each, fuel sub-label; all match
      expectations. interaction.txt:15-21.
- [x] **Cache envelope** — v1 processed shape `{t, v:[{period,value,units,name}]}`, rows
      sorted asc, under the v1 keys `suite.cache.gas.<area>.<product>`. interaction.txt:22-23.
- [x] **Region selector** — reloads main card only (R20 verified). interaction.txt:24.
- [x] **Fuel selector** — reloads main + all regions (diesel verified, 6 new cache keys).
      interaction.txt:25.
- [x] **Refresh button** — busts the 6 current-product caches, refetches (cache `t`
      renewed). interaction.txt:26.
- [x] **Theme-flip chart redraw** — v1 redrew inside its toggle handler; v2 keeps it as a
      second #themeBtn listener after `Suite.theme`'s. Stroke #2f6f6a -> #6fb5ae observed.
      interaction.txt:27.
- [x] **Key-rejected UX** — HTTP 403 -> "That key was rejected by EIA." + rekey link ->
      keycard returns. interaction.txt:28-29, `key-rejected.png`.
- [x] **Generic network error** — no cache + network down -> "Couldn't reach EIA (Failed to
      fetch). It caches weekly — try Refresh in a bit." interaction.txt:30.
- [x] **Empty data state** — 200 with empty `data[]` -> "No data returned for this
      region/fuel combination." interaction.txt:31.
- [x] **Freshness window** (serve from cache when fresh AND `rows >= length/2`) — v1 rule
      kept verbatim in `fetchSeries`; exercised by the post-refresh renders and the region
      switch (4-row region cache insufficient for the 60-row main request -> refetch).

## changes beyond the recipe

- **TTL 3 d -> 1440 min** (manifest `cacheTtlMin`, API-AND-RELAY.md §2 daily-stats class) —
  policy-mandated; the v1 `rows >= length*0.5` sufficiency condition is preserved.
- **Stale-serve on network failure** + "Offline — cached from &lt;time&gt;." notes on both cards
  (Batch B policy; v1 rendered the error card instead of serving stale). A small
  `#natlMsg` div was added to the all-regions card to host its stale note — the only markup
  addition. Key-rejection errors are never masked by the stale fallback (`isKeyErr` guard).
- **Key access via `Suite.key("eia")`** (Batch C) instead of raw `store.get`; the v1
  paste-a-key card mechanics are kept, writing the same `suite.key.eia` key.
- **Cache-shape bridging**: `Suite.fetchJSON` caches the raw response under the v1 key; the
  tool normalizes both shapes on read (`normRows`) and writes the v1 processed envelope back,
  so a v1 user's existing cache keeps working and v1 can read a v2-written cache.
- Enter key on the key input saves (a11y; v1 was click-only).

## localStorage keys (v1 vs v2)

Identical sets, verified by the harness (`localstorage.json`, `keysOnlyInV1`/`V2` both
empty; 14 keys each): `suite.theme`, `suite.key.eia`,
`suite.cache.gas.{NUS,R10,R20,R30,R40,R50}.{EPMR,EPD2D}`. Values byte-compatible
(key stored bare, cache as the v1 JSON envelope).

## escape allowlist requests

All remote strings interpolated into innerHTML are `Suite.esc()`d (`latest.name`,
`fmtDate(latest.period)`, chart month labels, error `e.message`, `fmtStamp` output, AREAS
labels). Requesting allowlist for the remaining unescaped interpolations, all provably
non-string:

- `fmtP(latest.value)`, `fmtP(prev.value)`, `fmtP(yearAgo.value)` — values are
  `parseFloat()` numbers (NaN filtered); `fmtP` emits `"$" + v.toFixed(3)`, digits only.
- `Math.abs(chg).toFixed(3)`, `Math.abs(yChg).toFixed(3)` and the `(yChg>=0?"+":"−")`
  sign — Number.toFixed output / literal ternary.
- `chg>=0?"up":"down"` (and the yChg class/style twins) — two-literal ternaries.
- In `drawChart`: every `x(i).toFixed(1)` / `y(v).toFixed(1)` / `v.toFixed(2)` coordinate
  and the `line`/`area` path strings built from them — numeric-only concatenations.
- In `drawChart`: `grid`, `muted`, `accent` — `getComputedStyle` values of the tool's own
  CSS variables.
- `cmp_${a}` id and loop bodies over `ALLAREAS`/`AREAS` — local constant table (its labels
  are esc()d anyway).

## a11y applied

- `aria-label="EIA API key"` on the key input (placeholder-only in v1); Enter submits.
- `Suite.liveRegion()` on `#dataArea`, `#compare`, `#keyMsg`, `#natlMsg`.
- Trend chart SVG: `role="img"` + `aria-label="52-week price trend chart"`.
- Selects keep v1's explicit `<label for>`; theme button gets core's aria-label/pressed.
- No icon-only buttons, no overlays; all actions are native button/select/link (keyboard-safe).

## endpoints

`https://api.eia.gov` only (manifest + CSP connect-src). Present in CATALOG.md (§5.2 and the
CORS table, "verify" status — see concerns). The signup link is navigation, not an endpoint.

## concerns for the reviewer

1. **No live EIA verification.** No key, no demo tier — the batch policy path. The payload
   shape mirrors v1's parser and EIA's documented v2 API, but the first real-key user is the
   first live test; CATALOG.md's EIA CORS status is still "verify". Worth one manual check
   when any real key is available (tripcost.html shares the `eia` key and has the same gap).
2. **Error-message fidelity vs v1**: v1 extracted `error` bodies from non-2xx responses;
   `Suite.fetchJSON` reduces those to `HTTP <status>`. Key rejection is still detected
   (the `/api_key|invalid|register|403|unauthor/i` test matches "HTTP 403") — only the
   message text is terser. Accepted as core-helper behavior; not worth a bespoke fetch path.
3. **NUS cache race (v1-identical)**: `loadAll` fires `loadMain` (60 rows) and
   `loadAllRegions` (4 rows) concurrently; for the selected area, last-writer-wins can leave
   a 4-row envelope until refresh/TTL expiry, so a stale-path render may show "~1 year ago"
   = oldest cached row (v1 falls back the same way; visible in `offline-stale.png`).
4. **Console errors in interaction.txt** are exclusively `net::ERR_FAILED` from the
   deliberate offline segments (harness-filtered as expected for network tools).
5. `report.md` was written via shell copy because of the session's PostToolUse Write hook on
   report.md (expected per HANDOFF.md).

## Phase 4 a11y audit

Re-verified 2026-07-16 against QUALITY.md §2 (Phase 4 audit addendum). Full runtime log in
`a11y-phase4.txt` (harness: `tests/a11y-phase4-batch.mjs` — api.eia.gov route-fulfilled with the
same deterministic EIA-v2-shape generator as interactions/gas.mjs; EIA has no demo tier and no
key was invented, so zero live requests).

| # | Checklist item | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | icon-only controls named | n-a | all controls worded |
| 2 | aria-live on async containers | pass | runtime `aria-live=polite` on #dataArea, #compare, #keyMsg, #natlMsg |
| 3 | keyboard path | pass | from the no-key designed state: paste key + Enter renders hero/regions/chart; fuel/region `<select>`s change via ArrowDown; Refresh via Tab+Enter; the trend SVG carries `role=img` + `aria-label="52-week price trend chart"`; no positive tabindex; no overlays |
| 4 | input labels | pass | #keyInput `aria-label`; #product and #area `<label for>` |
| 5 | contrast, both palettes | fixed | see below — 1 tool-local failure fixed, 1 suite flag |
| 6 | focus visibility | pass | 8/8 tabbed elements show the core 2px accent outline |

Contrast measurements:
- FIXED: `.btn` (keycard "Save key") was `#fff` on `var(--accent)` — **2.36:1 dark** (the pair
  is proven by the identical measured pairing across the batch; the keycard hides after the
  audit's key save, so this instance was fixed from the source reading + the shared measurement).
  Now `color: var(--bg)` (5.26:1 light / 7.60:1 dark). `.btn.ghost` overrides to ink — unchanged.
- SUITE FLAG (not fixed locally): `--muted` on `--bg` = **4.36:1 light** (footer). Dark passes.
- Passing spot-checks: price-change palette `--pos`/`--neg` (3-layer from migration) 5.77/4.93
  light, 5.31/7.86 dark; hero price accent 5.74/6.91 (large); chart axis text muted-on-card.

Fixes made: the `.btn` color swap above (tools/gas.html only).
Harness after fix: `node verify-tool.mjs gas` → exit 0 (route-fulfilled module: no-key state,
key mechanics, deterministic render pipeline, 403 rejection, theme redraw, stale path).
