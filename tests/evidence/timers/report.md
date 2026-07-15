# timers.html — migration report (Batch A)

Evidence: this directory. Harness run: `node verify-tool.mjs timers` → exit 0, console clean.
Time was driven with `page.clock.install()` + `fastForward` in both `interact` and `v1Interact`.

## v1 feature walk-through

Every v1 feature, each verified on the v2 source (interaction.txt line refs):

- [x] **Tab switching Timers ⇄ Stopwatch** — clicked both tabs; correct section shown/hidden
  (interaction.txt L1; final state back on Timers).
- [x] **Stopwatch start/stop** — Start → button reads "Stop", Lap enables; Stop → "Start",
  Lap disables (L2, L6).
- [x] **Stopwatch display with centiseconds** — after 3.0s fast-forward shows `00:03.00`;
  after further 2.5s shows `00:05.56` (fake clock + a few real ms between harness actions) (L3–L4).
- [x] **Laps: split + total, newest first, fastest/slowest tags** — two laps logged:
  `Lap 2 fastest 00:02.53 / 00:05.57`, `Lap 1 slowest 00:03.03 / 00:03.03` (L5).
- [x] **Stopwatch reset** — display back to `00:00.00`, lap table emptied, buttons disabled (L7).
- [x] **Add named timer via form (h/m/s)** — "Egg test" 5 s added, starts immediately,
  countdown `00:05`, empty-state hides (L8).
- [x] **Enter key adds a timer** — v1 had Enter on the name field; verified via the seconds
  field (extended to all four inputs, see a11y) (L19).
- [x] **Zero-duration guard** — v1 `alert("Set a duration first.")` code path preserved verbatim
  (verified by code diff; not exercised in the harness because `alert` blocks headless runs).
- [x] **Preset chips** — "Tea · 03:00" clicked → second card running at `03:00` (L15).
- [x] **Countdown ticking + progress bar** — after 2 s fast-forward card shows `00:03`;
  progress bar width repainted in place per frame (L10; v2-after-interaction.png).
- [x] **Pause / Resume with persisted remain** — Pause writes `remain=2891ms, endAt=null`
  to `suite.timers.v1`; Resume restores a live `endAt` (L11–L12).
- [x] **Run to completion → ringing state** — card shows `Time!`, `.ringing` class present
  (alarm border + pulse animation visible in v2-after-interaction.png), persisted
  `ringing=true` (L12–L13). The WebAudio chime itself is inaudible in the harness; the
  `playChime` path runs inside the tick loop with the state change (code identical to v1).
- [x] **Tab title shows soonest / 🔔 Time!** — `document.title` = `🔔 Time! · Timers` while
  ringing (L12, L16).
- [x] **Dismiss / Restart on a ringing timer** — Dismiss resets to `00:05` with Start/Reset
  buttons; Restart path exercised via card Start + fast-forward to re-ring (L14, L16).
- [x] **Remove (✕)** — second card removed; storage updated to the remaining timer (L18).
- [x] **Persistence across reload** — after `page.reload()` both timers re-render from
  `suite.timers.v1`: `["Egg test","Tea"]`, ringing state and running countdown (`02:54`)
  intact (L17) — v1's headline claim.
- [x] **Theme toggle** — light → dark, `aria-pressed` true (L20; harness probe).
- [x] **Distinct chime per timer** — `chime: timers.length` index assignment preserved
  verbatim (code diff; audio not observable in harness).

## changes beyond the recipe

- `load()` rewritten from `JSON.parse(localStorage.getItem(KEY)) || []` (in try/catch) to
  `Suite.store.get(KEY)` + `Array.isArray` guard — same behavior incl. corrupt-value fallback.
- Footer tool-local override `font-size: .82rem; padding-top: 1rem;` where v1 differs from core.
- `.back` / `.theme-btn` keep only their v1 positional declarations (`position:absolute` + offsets)
  tool-locally; visual styling comes from core (v1 values are identical to core's).
- Enter-to-add extended from the name field (v1) to the three number inputs — keyboard-path
  a11y (QUALITY.md §2); no other behavior change.
- `aria-pressed` maintained on the two view tabs (attribute only).
- Nothing removed; all logic otherwise line-for-line v1.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.timers.v1` | JSON array of timer records | identical (written via `Suite.store.set`, which serializes arrays with `JSON.stringify` exactly as v1 did) |
| `suite.theme` | bare string | identical (core `Suite.theme`) |

localstorage.json: `keysOnlyInV1: []`, `keysOnlyInV2: []` — parity confirmed after equivalent
interactions on both versions. Note v1 and v2 both persist the transient `_lastRing` field inside
records when a save happens while ringing; v1 behavior, preserved.

## escape allowlist requests

All are v1 code carried over; no remote data exists in this tool (offline, zero endpoints).
Exact interpolated expressions:

- `` `${main}<span class="ms">.${pad(c)}</span>` `` in `swFmt` (reaches innerHTML via
  `swRender`/`renderLaps`): `main` is built from `pad()` of local numeric time parts; `pad(c)`
  is a zero-padded number.
- `` `<tr class="${cls}"><td>Lap ${l.n}${tag}</td><td>${swFmt(l.split)}</td><td>${swFmt(l.total)}</td></tr>` ``
  in `renderLaps`: `cls` ∈ {"", "best", "worst"} (literals); `tag` is one of three hardcoded
  markup literals; `l.n` is a counter; `swFmt(...)` as above.
- `` `<table><thead>…</thead><tbody>${rows}</tbody></table>` `` in `renderLaps`: `rows` is the
  join of the rows above.

Timer cards, presets, and names are built with `createElement`/`textContent` (as in v1), so the
user-typed timer name is never interpolated into HTML.

## a11y applied

- `aria-label` on all four creation inputs ("Timer name", "Hours", "Minutes", "Seconds") —
  placeholders alone are not labels.
- Icon-only ✕ button: `aria-label="Remove timer <name>"` (set via `setAttribute`, name is plain
  text) in addition to v1's `title="Remove"`. Verified in-run: `Remove timer Egg test` (L9).
- Enter submits from every field of the text-entry+button group (v1: name field only).
- View tabs carry `aria-pressed` synced with the active state.
- Theme button label + `aria-pressed` from core `Suite.theme.init()`.
- Keyboard path: every control is a native `<button>`/`<input>`; no overlays, so no Esc handling
  needed.
- **Live regions deliberately not applied**: the checklist targets async fetch-result containers;
  this tool has none. Its updating containers (`#timerGrid`, `#swDisplay`) repaint every frame /
  second — `aria-live` there would flood screen readers. See concerns.

## endpoints

None. Offline tool; the chime is synthesized with WebAudio. `endpoints: []`.

## concerns for the reviewer

1. **No screen-reader announcement when a timer finishes.** v1 had none either (parity kept), and
   a naive `aria-live` on the grid would announce every second. If wanted, a v2.x improvement
   would be a small visually-hidden assertive live region written once when a timer starts
   ringing — behavior addition, so I did not add it unilaterally.
2. **`alert()` for the zero-duration guard** is kept from v1 (blocking modal; fine offline, but
   inelegant). Not exercised in the harness because a native dialog would hang headless runs;
   the code path is unchanged from v1.
3. **Stopwatch lap timings in evidence drift ~30–60 ms** from the fast-forward amounts
   (e.g. 00:02.53 for a 2.5 s jump) — real wall-clock milliseconds elapse between harness actions
   on top of the fake clock. Expected harness artifact, not a tool defect.
4. `_lastRing` (transient chime-throttle field) gets persisted inside `suite.timers.v1` when any
   save happens while a timer rings; it is deleted on load. Identical in v1 — preserved for
   byte-level state parity, though it is mildly untidy.
5. The escaping-heuristic entries above will need to be added to `tests/escape-allowlist.json`
   (orchestrator-owned file) when this tool goes through `build.py --check`.
