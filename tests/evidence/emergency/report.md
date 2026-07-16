# emergency.html — migration report (Batch A, zero-network)

Evidence produced by `node verify-tool.mjs emergency` (exit 0). Screenshots: `v1-/v2-{light,dark}.png`,
`v1-/v2-print.png`, `v2-after-interaction.png`. Records: `interaction.txt`, `computed-style-diff.txt`,
`localstorage.json`, `content-parity.txt`.

## v1 feature walk-through

- [x] **911 banner with `tel:911` link** — renders; `interaction.txt` line 2 logs all three
  `tel:` hrefs and their visible text (`tel:911 -> "911"`).
- [x] **Hotline cards (Poison Control `tel:18002221222`, 988 `tel:988`, 311 non-tel)** — same
  log line; visible in all screenshots.
- [x] **Jump nav between sections** — clicked `#cpr` (section top landed 16px from viewport top,
  hash set) and `#card` (fieldset scrolled into view, hash set). `interaction.txt` lines 3, 7.
- [x] **CPR metronome (WebAudio, ~110 BPM)** — exercised under `page.clock`: start flips button
  to "■ Stop" + `.stop` class; 12 beat pulses observed in 6 s of fake clock, measured average
  interval => **111 BPM** (fake-clock ms rounding of the 545.45 ms interval; within the tool's
  stated 100–120); stop restores "▶ Start 110 BPM" and clears the pulse. Lines 4–6.
- [x] **Beat dot pulses (`.on` class)** — counted via MutationObserver (that's what the 12 pulses
  are); dot confirmed off after stop.
- [x] **First-aid content (CPR / Choking / Bleeding / Burns / Stroke / Heart attack)** —
  SAFETY-CRITICAL: `content-parity.txt` proves textContent of every content area
  (header, tag line, 911 banner, hotlines, nav, all six topic sections, card legend, footer)
  is **byte-for-byte identical** to v1: 5859 chars vs 5859 chars, `identical: true`.
- [x] **Family Emergency Card: Save** — filled 3 fields, clicked Save, `savedMsg` shows
  "Saved to this device ✓", stored JSON read back and logged (lines 8–9).
- [x] **Autosave on change/blur** — filled `f_hosp`, blurred; key updated without clicking Save (line 10).
- [x] **Print card (saves then prints)** — `window.print` stubbed; clicking the button called it
  exactly once and saved first (line 11). Print CSS verified by `v1-print.png` vs `v2-print.png`
  (identical: chrome hidden, black-border card layout).
- [x] **Clear with confirm()** — Cancel path keeps fields + key; OK path empties fields, removes
  `suite.emergency.card`, flashes "Cleared" (lines 12–13).
- [x] **Load on open** — `loadCard()` runs at boot (same as v1); the refill+save before the final
  snapshot round-trips through it implicitly, and the stored value matches v1's byte-for-byte
  (`localstorage.json`).
- [x] **Theme toggle persists `suite.theme`** — harness probe: light -> dark, `aria-pressed=true`.
- [x] **`@media print` block** — kept verbatim; proven by the print screenshots.

## changes beyond the recipe

- `fieldset.card` gained tool-local `display: block; flex-direction: row; gap: normal;` — core's
  shared `.card` class sets `display:flex; flex-direction:column; gap:.55rem`, which v1 (no global
  `.card` rule) never applied to this fieldset. Without the override the card grew ~33px taller.
  Computed-style diff is now clean.
- `.topbar .theme-btn { float: none; }` — core floats `.theme-btn` right; v1's sits in the flex
  `.topbar` with no float. (Float is inert inside flex anyway; override keeps computed styles equal.)
- Tool-local footer override (`margin-top: 2.5rem; font-size: .82rem; padding-top: 1rem`) — v1's
  footer is tighter than the core default (3rem / .85rem / 1.1rem).
- `saveCard()`: v1 wrapped `localStorage.setItem` in try/catch and flashed "Couldn't save (storage
  full?)" on failure. `Suite.store.set` never throws, so v2 reads the value back and compares
  (`JSON.stringify`) to decide which message to flash — the failure message survives for the
  quota-exceeded case. (With Suite's in-memory fallback backend the readback also succeeds, so the
  failure message only appears when real localStorage rejects the write — same trigger as v1.)
- `clearBtn` uses raw `localStorage.removeItem(CARD_KEY)` in try/catch with a comment:
  `Suite.store` exposes no `remove()`, and v1 deletes the key (rather than blanking it), which the
  localStorage-parity check requires.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string ("dark"/"light") | identical (Suite.store writes strings bare) |
| `suite.emergency.card` | `JSON.stringify({name,addr,ice1,ice2,doc,hosp,ins,blood,allergy,meds,notes})` | identical bytes — see `localstorage.json` (same 194-char value both sides); `keysOnlyInV1`/`keysOnlyInV2` both empty |

## escape allowlist requests

none — the tool has no `innerHTML` interpolation at all; the only dynamic text (`savedMsg`) uses
`textContent`.

## a11y applied

- `Suite.liveRegion()` on `#savedMsg` (`aria-live="polite"`) — Save/Clear/autosave feedback is announced.
- `aria-hidden="true"` on the six decorative emoji `.ic` spans in section headings and on the
  metronome `.beat` dot (visual pulse only). Attribute-only; textContent untouched (proven by
  `content-parity.txt`).
- `aria-label="First-aid topics"` on the jump `<nav>`.
- Theme button label/`aria-pressed` comes from core `Suite.theme.init()`.
- All card inputs already have wrapping `<label>` elements with visible text (v1); no icon-only
  buttons exist (metronome/print buttons have text labels). No overlays, so no Esc path needed.
  No search-box + button pair, so no Enter-submit wiring applies (autosave-on-change covers commit).

## endpoints

none — zero-network by design. `tel:` links are user-agent dial-out, not fetches.

## concerns for the reviewer

- The metronome BPM measured 111 rather than 110.0 because Playwright's fake clock rounds the
  545.4545 ms `setInterval` to whole ms; real-clock behavior is v1-identical code (the metronome
  block is a verbatim copy except `onclick` -> `addEventListener`).
- The saveCard readback-compare could in principle flash "Saved" when the write failed but an
  identical stale value already sat in the key — only possible when saving twice with quota
  exhausted in between; judged acceptable to keep `Suite.store` as the sole writer.
- WebAudio in the harness run: headless Chrome created the AudioContext without error (console
  clean); actual audibility of the tick was verified by code inspection only (oscillator graph is
  byte-identical to v1), not by ear.
- `printShots` was enabled even though the burn-down table doesn't flag emergency as a print-CSS
  tool — it has a real `@media print` block (the wallet/fridge card). Evidence, not a behavior change.

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/emergency.html` from `file://`, light + dark
(raw log: `phase4-a11y-audit.txt`). **Verdict: fixed (4 contrast items).**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass (n/a) | none; section icons are `aria-hidden` spans beside heading text |
| 2 | async regions aria-live | pass | `#savedMsg` = polite (save/import feedback — the tool's only async surface); verified live during the keyboard drive |
| 3 | keyboard paths | pass | keyboard-only drive: Enter started the CPR metronome ("■ Stop"), Enter stopped it; card fields typed via Tab; Enter on Save → "Saved to this device ✓" announced; store round-trip confirmed. Jump nav + `tel:` hotlines are native `<a>`; Clear uses native `confirm()` |
| 4 | input labels | pass | 11/11 fields via wrapping `<label class=fld>` |
| 5 | contrast both palettes | **fixed** | see below |
| 6 | focus visibility | pass | 2px accent outline on every stop, both themes |

Contrast fixes (tool-local; `--emerg` split because it served as both text and a background
under white — irreconcilable in dark with one value):
- `--emerg` (text uses: hotline numbers, callout `<b>`, borders): #c0392b→**#b53427** (L),
  #e0574a→**#ec7560** (D). Callout `<b>` on `--emerg-soft` was 4.44 (L) / 4.01 (D) → now
  **4.92 / 5.18**; 988 hotline on dark card was 4.38-for-large → now 5.66.
- new `--emerg-deep` (background uses: `.call911`, `.metro button.stop`): #b53427 (L) /
  **#a83a2a** (D). White 1rem text on the 911 banner was **3.73** (D) → now **6.36** (and
  6.03 L).
- `.metro .lbl` muted on accent-soft was 4.11 (L) → `--soft-muted` #59606c → **5.38**.

Harness: `node verify-tool.mjs emergency` re-run after the fix — exit 0, console clean
(print-media shot regenerated; print styles force black-on-white and are unaffected).
SUITE-WIDE flags: muted-on-`--bg` 4.36 light (footer); white-on-accent 2.36 dark
(`.metro button` start state, `.cardactions .primary`).

## Phase 4 accent-ink sweep (D10)

Converted `color:#fff` -> `color:var(--bg)` on filled-accent control rules: `.metro button`, `.cardactions button.primary` (also pinned explicit `color:#fff` on `.metro button.stop`, whose `--emerg-deep` fill is dark red in both themes and would otherwise inherit the new dark ink; white on #a83a2a = 6.3:1).
Runtime measurement (Playwright, file://, network route-aborted, probe of converted rule):
light fg=rgb(245,243,238) on bg=rgb(47,111,106) = 5.26:1; dark fg=rgb(21,23,27) on bg=rgb(111,181,174) = 7.60:1. No pageerrors on load in either theme.
