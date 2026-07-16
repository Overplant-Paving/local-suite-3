# sound.html migration report (Batch A)

Verified: `node verify-tool.mjs sound` — exit 0, console clean. Evidence in this directory.
Audio is inaudible in the harness, so verification is state-based: UI state, AudioContext state,
the live node graph (`nodes`), and gain values read via `page.evaluate` (top-level `let/const`
bindings in the tool script are global lexical bindings, reachable from evaluate).

## v1 feature walk-through

- [x] **Master play/pause button** — clicking a card auto-starts playback: button flips to pause
  (interaction.txt line 4); after the sleep timer expires it flips back to play (line 14).
- [x] **Six synthesized sounds (white/pink/brown/rain/ocean/fan)** — all 6 cards render
  (line 2); DSP code (noiseBuffer, Paul Kellet pink filter, brown integrator, rain droplet
  scheduler, ocean LFO swells, fan wobble) survives **verbatim** — v1 lines 147-320 vs v2 is
  identical for the whole audio engine.
- [x] **Clicking a card toggles it and auto-plays** — white card click: class `snd on`,
  state text "on", `playing=true`, `ctx.state="running"`, `nodes=["white"]` (lines 3-4).
- [x] **Mixing several sounds** — pink added while white runs: `nodes=["white","pink"]` (line 5).
- [x] **Switching noise types** — white toggled off: `nodes=["pink"]`, card class back to `snd`,
  state `off` (line 6).
- [x] **Master volume slider** — arrow keys 70->65: `masterGain.gain.value` settles at 0.65
  (line 9) and persists as `"master":0.65` (line 15).
- [x] **Per-sound volume slider** (click doesn't toggle the card — stopPropagation kept) —
  pink 60->55: `vols.pink=0.55`, running node gain retargeted, persisted `"pink":0.55`
  (lines 10, 15); card stayed on.
- [x] **Sleep timer with fade-out** — "15 min" click: status "Stopping in 15:00", button `.on`
  (line 11); `page.clock` +10:00 -> "Stopping in 5:00" (line 12); +5:30 -> "Timer finished —
  sounds faded out." + moon emoji, playing=false, `nodes=[]`, "Off" button reselected
  (lines 13-14). The 20 s linear fade branch runs on the real audio clock (not assertable in a
  mocked-clock run — see concerns).
- [x] **"Off" default option marked on load** — visible in v1/v2 screenshots, both themes.
- [x] **State persistence (`suite.sound`)** — vols + active + master round-trip; stored JSON
  byte-identical to v1's for the same actions (localstorage.json).
- [x] **Resume on visibilitychange** — listener kept verbatim (code inspection; not exercisable
  deterministically in the harness).
- [x] **Theme toggle** — light->dark, `aria-pressed=true` (line 16, now via `Suite.theme`).

## changes beyond the recipe

- v1 styles `.back` as a pill button sharing a rule with `.theme-btn` (core's `.back` is a plain
  link, core's `.theme-btn` floats right). Kept the v1 `.back, .theme-btn` rule as a tool-local
  override, plus `float: none` and hover `text-decoration: none`/`border-color` to neutralize the
  core defaults. Computed-style diff confirms exact parity.
- Tool-local `footer { margin-top: 2.5rem; font-size: .84rem; text-align: center; }` — the three
  properties where v1 differs from core's footer baseline.
- `masterBtn.onclick=` and timer-option `b.onclick=` converted to `addEventListener` (no inline
  attribute handlers existed in v1 markup).
- `loadState` guards `typeof raw === "object"` before use, since `Suite.store.get` returns raw
  strings for unparseable values where v1's try/catch fell through to defaults — same effective
  behavior (defaults win on corrupt data).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.sound` | `{vols:{...}, active:{...}, master}` JSON via raw localStorage | same shape via `Suite.store` (objects are JSON.stringified — byte-identical, proven in localstorage.json) |
| `suite.theme` | bare string via raw localStorage | bare string via `Suite.store` (strings written bare) |

`keysOnlyInV1` / `keysOnlyInV2`: both empty.

## escape allowlist requests

None for the build heuristic (it flags template-literal interpolation; this file has none into
`innerHTML`). For the reviewer's awareness, the one `innerHTML` write uses string concatenation,
kept verbatim from v1:

- `st.innerHTML = "Stopping in <b>" + mm + ":" + String(ss).padStart(2, "0") + "</b>" + (fading ? " · fading out…" : "")`
  — `mm`/`ss` are `Math.floor`/`%` of a local countdown; provably numeric, never user- or
  remote-influenced.

## a11y applied

- Sound cards were click-only `<div>`s — added `role="button"`, `tabindex="0"`,
  `aria-pressed` (kept in sync on toggle), `aria-label` (sound name), and an Enter/Space keydown
  path (verified: brown toggled on/off via keyboard, interaction.txt lines 7-8).
- Per-card volume sliders: `aria-label="<name> volume"`; added a keydown `stopPropagation` so
  arrow keys adjust volume without the card's key handler seeing them (mirrors v1's click
  stopPropagation; verified line 10).
- Master volume range input: `aria-labelledby` pointing at the visible "Master volume" label
  (id added to the existing `.mlabel` div).
- Master play button: kept v1's `aria-label="Play or pause"`, added `aria-pressed` state.
- `#timerStatus` wrapped in `Suite.liveRegion()` — countdown/finish announcements are polite.
- Decorative emoji (card emoji, speaker slider glyph) marked `aria-hidden="true"`.
- Theme button label/`aria-pressed` from core `Suite.theme.init()`.

## endpoints

None. Zero-network tool; all audio synthesized via Web Audio API. `endpoints: []`.

## concerns for the reviewer

- **v1 quirk preserved:** after the sleep timer fades out and stops, `masterGain` is left ramped
  to ~0.0001. Pressing play again plays near-silently until the master slider or a timer option
  is touched (both reset the gain). Identical in v1 — not fixed, per "no behavior added/removed".
- The 20-second fade itself schedules on the AudioContext clock, which `page.clock` does not
  mock; the harness proves the fade branch is *entered* only indirectly (finish path text says
  "faded out"). The fade ramp code is verbatim v1, so risk is nil, but it was not audibly or
  numerically observed.
- `ctx.state` logged as `"running"` immediately after the first card click — Playwright clicks
  count as user activation in headless Chrome. On a real machine with no prior gesture the
  context can start `"suspended"`; v1's `syncPlayback` `resume()` call and the on-page tip
  ("tap play once") cover that, unchanged.
- Sound cards keep `role="button"` + `aria-pressed` rather than being replaced with real
  `<button>` elements, to preserve v1's DOM/CSS exactly (a `<button>` would change computed
  styles and the card layout). Semantics-equivalent for AT.

## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | `▶/⏸` master button has `aria-label="Play or pause"` + `aria-pressed`; sound-card emojis are `aria-hidden` with the name as the card's aria-label |
| 2 | aria-live | pass | `#timerStatus` liveRegion (runtime confirmed) — the one async region (countdown/fade state). Card on/off state is announced via `aria-pressed` on the card itself |
| 3 | Keyboard path | pass | keyboard-only: master play via Enter (`aria-pressed` → true, glyph → ⏸); master volume ArrowLeft; sound card toggled via Enter (cards are `role=button` tabindex 0, `aria-pressed` tracked); per-sound slider arrows adjust volume **without** toggling the card (keydown stopPropagation verified); sleep timer via Enter → "Stopping in 30:00" announced |
| 4 | Inputs labeled | pass | master volume `aria-labelledby`; per-sound sliders `aria-label="<name> volume"` |
| 5 | Contrast | pass locally / suite flags | see below |
| 6 | Focus visibility | pass | core 2px accent outline on buttons, cards, and range inputs |

Contrast: `.snd.on .state` on accent-soft **4.95/6.69**, timer countdown `b` 5.74/6.91,
idle timer buttons 13.39/14.25, master label 4.76/6.19 (on card).
**SUITE-WIDE flags (no sound-local color fails)**: light muted-on-bg 4.36 (tagline, hint)
and muted on accent-soft 4.11 (active-card description); dark #fff-on-accent 2.36 — here the
`▶` glyph (needs 3.0 as UI) and the active sleep-timer pill. Same core-palette pair as every
tool's primary buttons.

No changes made to sound.html — **pass as was**.

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.master .play`, `.timer .opts button.on`.
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
