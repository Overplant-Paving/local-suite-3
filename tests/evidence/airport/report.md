# airport.html — migration report (Batch C, formerly-broken tool; remediation IS the migration)

Completed by a COMPLETER agent from the interrupted-session draft at
`handoff/batchC-drafts/airport.html` (draft assessed, fixed, moved to `tools/airport.html`;
draft file removed). Evidence: `cd tests && node verify-tool.mjs airport` — exit 0.

## v1 feature walk-through

Every v1 feature, each verified against `tests/evidence/airport/interaction.txt` unless noted:

- [x] **Theme toggle + suite.theme persistence** — harness probe: `light -> dark, aria-pressed=true`.
- [x] **METAR paste decoder (offline)** — verbatim v1 parser. Sample button decodes KSFO to
  VFR with full grid (wind 280° (W) 16 kt, vis 10 SM, sky few 1,500 / broken 20,000 ft,
  ceiling 20,000 ft, temp/dew, altimeter 30.01 inHg) — interaction.txt lines 1–2.
- [x] **Decode button + custom input** — LIFR METAR (1/4SM FG VV002) decodes to "Low IFR",
  gusts, fog, vertical-visibility ceiling 200 ft — lines 4–5.
- [x] **Clear button** — empties textarea and output — line 3.
- [x] **Decoder error state** — non-METAR input renders the v1 `.err` message — line 6.
- [x] **Add airport (button + Enter), uppercase coercion** — "ksfo" via Enter and "KJFK" via
  button both land uppercased in `suite.airports` — line 7.
- [x] **ICAO validation** — "12" rejected, storage unchanged (border-flash feedback) — line 30.
- [x] **Airport chips with remove (×)** — removing KJFK updates storage and the board — line 31.
- [x] **Board, no relay** — v1 rendered dead-end "No live data" cards (its relay placeholder
  failed silently). v2 replaces this with the DESIGNED LINK-OUT CARD (the remediation product):
  per-airport card with direct links to aviationweather.gov's METAR page, its TAF view
  (`&taf=true`), and nasstatus.faa.gov, plus the honest one-line explanation and a "paste it
  into the decoder" hint — lines 8–28, screenshots `linkout-card-light.png` /
  `linkout-card-dark.png` (task-required both-themes card shots).
- [x] **Relay live board** — preserved behind `Suite.relay`. Route-fulfilled verification:
  observed request `https://relay.test.invalid/w?url=https%3A%2F%2Faviationweather.gov%2F...`
  equals the v2 contract `<base>?url=<encoded upstream>` exactly (`contract fulfilled: true`,
  lines 32–34). Station card renders decoded METAR with flight-category class/badge, name,
  rows, observed time, raw METAR — lines 36–50, `relay-live.png`.
- [x] **Refresh board button** — forces a second relay fetch (ttl 0) — line 51.
- [x] **Cache + stale fallback** — v1 hand-rolled `suite.cache.airport.metars` {t,v}; v2 uses
  `Suite.fetchJSON` with the SAME cache key and v1's 8-min TTL. Aged cache 24 h + aborted
  network renders the stale board with "Relay unreachable — showing data cached 24 hr ago."
  — lines 52–54, `offline-stale.png`. A `toMap()` shim accepts BOTH v1's cached map shape and
  v2's cached raw-array shape, so an existing v1 user's cache keeps working.
- [x] **Relay save / remove controls** — save writes `suite.relay.url`, remove deletes it and
  the board returns to link-out mode — lines 55–57. Enter in the relay field submits (a11y add).
- [x] **Worker snippet `<details>`** — kept, rewritten for the v2 `?url=` contract with a host
  allowlist, and pointing at the fuller `relay/worker.js` template.
- [x] **Footer / data credits** — kept ("via your relay" dropped: the relay is now optional,
  not the tool's premise).

## changes beyond the recipe (all remediation-mandated, per batchC-common + task notes)

1. **`.example` placeholder removed** (fatal gate): v1's
   `https://your-worker.example.workers.dev/` placeholder is gone; the relay input placeholder
   is now `https://your-worker.workers.dev/`. `grep -c "example" tools/airport.html` = 0.
2. **Link-out card product** replaces the silent-failure default (see walk-through).
3. **Relay contract changed** from v1's `RELAY?ids=…&format=json` to the suite-wide
   `Suite.relay` contract `RELAY?url=<encoded upstream URL>` (relay/worker.js). Because a v1
   worker would return wrong data under the new contract, a leftover v1 `suite.relay` value is
   NOT silently migrated: the tool surfaces an explanatory note and prefills the input, and
   nothing is saved until the user clicks Save — verified lines 58–61 (`suite.relay.url` stays
   null).
4. **Board paint order**: v1 painted cache first then refreshed in the background; v2's
   `Suite.fetchJSON` resolves once (fresh, cached-fresh, or stale) and paints once. Same end
   states, one less intermediate flash.
5. Draft fixes made by this completer (the killed agent's draft was otherwise complete):
   restored v1's `.back` muted/accent-hover chrome and neutralized core's `.theme-btn` float
   (local overrides, same pattern as iss.html); restored v1's always-visible board mode line
   (draft hid it when no airports were saved); added `Suite.liveRegion` to `#boardMode`.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | yes | yes (core) |
| `suite.airports` | JSON array | identical format via Suite.store |
| `suite.cache.airport.metars` | `{t, v:{ICAO:{raw,name,obsTime}}}` (processed map) | `{t, v:[raw aviationweather array]}` via Suite.fetchJSON — same key, same envelope; `toMap()` reads both shapes |
| `suite.relay` | relay base URL (v1 contract) | READ-ONLY legacy detection; never written, never auto-migrated |
| `suite.relay.url` | — | v2 relay base (suite-wide `Suite.relay` key) |

Parity run: `keysOnlyInV1: []`, `keysOnlyInV2: []` (localstorage.json). The
`suite.relay` -> `suite.relay.url` rename is the deliberate, surfaced contract change above;
in the harness both versions end with the relay key cleared, so key sets compare equal.

## escape allowlist requests

none — all dynamic rendering (decoder output, chips, link-out cards, station cards, stamps)
uses `createElement`/`textContent`. The only `innerHTML` writes are `""` resets and one
static, interpolation-free "No airports saved yet" string.

## a11y applied

- `aria-label` on the METAR textarea, ICAO input, and relay input (v1 had no labels).
- `aria-label` on each chip's remove button ("Remove KSFO") — carried from v1, kept.
- Per-link `aria-label`s on the link-out card ("Current METAR for KSFO on aviationweather.gov" …).
- `Suite.liveRegion` on `#decodeOut`, `#board`, `#boardStamp`, `#boardMode`.
- Enter submits in the ICAO field (v1 had it) and now also in the relay field.
- Theme button aria-label + aria-pressed from core `Suite.theme.init()`.

## endpoints

`[]`. aviationweather.gov blocks browser scripts (the reason this tool is network "blocked");
the tool performs no first-party fetches. Link-out `<a href>` targets (aviationweather.gov,
nasstatus.faa.gov, workers.cloudflare.com) are navigation, not endpoints, per batchC-common.
A user-configured relay host is by definition unknown at build time — see concerns.

## concerns for the reviewer

1. **CSP connect-src tension for relay users (task-flagged; CSP NOT weakened).** With
   `endpoints: []`, dist's CSP will not allow any `connect-src`, so a relay fetch is blocked
   in the published build even after saving a relay URL. This is the correct default (the CSP
   guards everyone; relays are a power-user opt-in). The tool documents the escape hatches
   in its relay `<details>`: use the repo's `tools/airport.html` source (file://, no CSP), or
   add your relay host to this tool's manifest endpoints and rebuild. Reviewer may want a
   CATALOG.md note.
2. **Relay contract break is loud, not silent** (see change 3) — but a v1 user who ignores the
   note and re-saves their old worker URL will get relay errors until they update the worker.
   The error card tells them the relay is unreachable/wrong; acceptable, flagging anyway.
3. **Live aviationweather.gov data was NOT fetched** — nothing to fetch from a browser (that
   is the premise). Relay and stale paths were verified deterministically with route-fulfilled
   fixtures per batchC-common §CORS-BLOCKED; the fixture METAR is a real-format KSFO METAR.
4. `interaction.txt` shows one `net::ERR_FAILED` console error — that is the deliberate
   route-abort in the stale-path test (harness-tolerated class; exit code was 0).
5. Body height differs v1↔v2 by ~21 px in computed-style-diff (plus pre-approved
   `-webkit-font-smoothing`): the v2 link-out mode line and relay copy are longer and wrap to
   a second line. Content-length difference, not a style regression — all other 12 selectors
   diff clean in both themes.
6. The `stationCard` no-data branch ("No live data — open the official page…") is now
   reachable only via relay-mode errors (link-out mode uses `linkoutCard`); kept because v1
   had it and relay users still hit it.

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
  FAIL 4.1 (need 4.5) fg=#6b7280 bg=#efece4 11.5px/400 — span.chip "official sources"
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.4px/400 — footer "· Decoder runs on your machine."
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 13.4px/400 — p.note "and rebuild."
  pass 5.26 (need 4.5) fg=#f5f3ee bg=#2f6f6a 16px/400 — button#relaySave.primary "Save relay"
  pass 5.26 (need 4.5) fg=#2f6f6a bg=#f5f3ee 13.4px/400 — a "nasstatus.faa.gov"
  pass 5.4 (need 4.5) fg=#ffffff bg=#27793c 16px/400 — span.cat.vfr "Visual (VFR)"
  pass 5.74 (need 4.5) fg=#2f6f6a bg=#fffdf9 13.4px/400 — a "workers.cloudflare.com"
  pass 12.58 (need 4.5) fg=#23282e bg=#efece4 14.1px/400 — span.mono "KSFO"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 24px/700 — h1 "Airport & Flight-Weather Board"
  pass 13.39 (need 4.5) fg=#23282e bg=#f5f3ee 12.5px/400 — pre#workerSnippet.mono "export default {
  async fetch(r"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.61 (need 3) fg=#23282e bg=#fffdf9 20px/700 — span.id "KSFO"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: button [outline] -> button#loadBoardBtn.ghost [outline] -> a [outline] -> a [outline] -> a [outline] -> input#relayInput.relay [outline] -> button#relaySave.primary [outline] -> button#relayClear.ghost [outline] -> summary [outline] -> a [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> textarea#pasteBox.mono [outline] -> button#decodeBtn.primary [outline] -> button#sampleBtn.ghost [outline] -> button#clearBtn.ghost [outline] -> input#icaoInput.icao [outline] -> button#addBtn.primary [outline] -> button [outline] -> button#loadBoardBtn.ghost [outline] -> a [outline] -> a [outline] -> a [outline] -> input#relayInput.relay [outline]
```

### Contrast — dark
```
contrast pairs (12 unique fg/bg combos):
  pass 5.47 (need 4.5) fg=#9aa0a8 bg=#262a31 11.5px/400 — span.chip "official sources"
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 13.6px/400 — span "observed day 14 at 18:56 UTC"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.4px/400 — footer "· Decoder runs on your machine."
  pass 6.91 (need 4.5) fg=#6fb5ae bg=#1d2026 14.1px/400 — summary "Show a small Cloudflare Worker y"
  pass 7.6 (need 4.5) fg=#15171b bg=#6fb5ae 16px/400 — button#decodeBtn.primary "Decode"
  pass 7.6 (need 4.5) fg=#6fb5ae bg=#15171b 13.4px/400 — a "METAR ↗"
  pass 7.92 (need 4.5) fg=#15171b bg=#5cc078 16px/400 — span.cat.vfr "Visual (VFR)"
  pass 11.44 (need 4.5) fg=#e7e5e0 bg=#262a31 14.1px/400 — span.mono "KSFO"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 12.96 (need 3) fg=#e7e5e0 bg=#1d2026 20px/700 — span.id "KSFO"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 24px/700 — h1 "Airport & Flight-Weather Board"
  pass 14.25 (need 4.5) fg=#e7e5e0 bg=#15171b 17.3px/700 — h2 "Decode a METAR"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: button [outline] -> button#loadBoardBtn.ghost [outline] -> a [outline] -> a [outline] -> a [outline] -> input#relayInput.relay [outline] -> button#relaySave.primary [outline] -> button#relayClear.ghost [outline] -> summary [outline] -> a [outline] -> (body) -> a.back [outline] -> button#themeBtn.theme-btn [outline] -> textarea#pasteBox.mono [outline] -> button#decodeBtn.primary [outline] -> button#sampleBtn.ghost [outline] -> button#clearBtn.ghost [outline] -> input#icaoInput.icao [outline] -> button#addBtn.primary [outline] -> button [outline] -> button#loadBoardBtn.ghost [outline] -> a [outline] -> a [outline] -> a [outline] -> input#relayInput.relay [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached METAR paste box (TEXTAREA#pasteBox after 14 tab(s))
  Tab -> reached Decode button (BUTTON#decodeBtn after 1 tab(s))
  keyboard decode -> category "Visual (VFR)"
  Tab -> reached ICAO input (INPUT#icaoInput after 3 tab(s))
  Enter in ICAO input -> KJFK added, 2 link-out cards (keyboard add-airport path)
  Tab -> reached KJFK chip remove (BUTTON after 3 tab(s))
  Enter on chip x -> KJFK removed (keyboard removal)

### aria-live runtime check
  #decodeOut: aria-live=polite
  #board: aria-live=polite
  #boardMode: aria-live=polite
  #boardStamp: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
- `button.primary` text `#fff` -> `var(--bg)` (2.36:1 on the dark accent -> 7.60:1).
- Flight-category chips: light `--vfr` #2e8b45 -> #27793c (white text 4.29 -> 5.40); new `--catink` var (#fff light / #15171b dark) for `.station .cat` — white on the dark palette's pastels was 1.80-3.5.
- `.decoded .cat` now gets `color: var(--catink)` (plus minimal chip padding): the decoder's category chip had NO color rule and rendered inherited ink on the colored background (3.46:1 light / 1.80:1 dark) — an a11y gap inherited verbatim from v1 (v1 airport.html has the same missing rule).

### Notes
- All network aborted during the audit (aviationweather.gov is CORS-blocked anyway; the tool's default product is the offline decoder + link-out board).

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
- `node verify-tool.mjs airport` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
