# qr.html migration report (Phase 2, Batch A)

Migrated `../Local Suite/qr.html` → `tools/qr.html`. Verified with
`node verify-tool.mjs qr` (exit 0); all evidence in this directory.

## v1 feature walk-through

Each feature exercised via `tests/interactions/qr.mjs`; observed values in `interaction.txt`.

- [x] **Text/URL preset (default)** — default payload `https://www.eff.org/` encodes on load:
  meta "Version 2 · 25×25 modules · EC M · mask 2", canvas 264×264 px with **20,992 dark pixels**
  (non-blank, real module data).
- [x] **Live re-encode on input** — typed new text; meta changed to "Version 3 · 29×29 · EC M ·
  mask 2", dark-pixel count changed to 27,968.
- [x] **Error-correction picker L/M/Q/H** — clicked Q: version grew to 4 (33×33), meta reflects
  "EC Q". Returned to M afterward.
- [x] **Module-size slider (2–20 px)** — set to 12: label span shows "12", canvas grew to
  492×492 px, 77,040 dark pixels.
- [x] **Capacity error path** — 1200-char payload (beyond version-10 byte capacity) shows
  "Too much data — shorten the text or lower the error-correction level." and meta "—".
- [x] **WiFi preset** — tab switch shows the group; empty SSID → "Enter something to encode.";
  SSID + password (with `;` needing WIFI-escape) + hidden checkbox encodes: "Version 4 · 33×33 ·
  EC M", 35,392 dark pixels.
- [x] **WiFi security segmented WPA/WEP/None** — selecting None disables the password field
  (observed `disabled=true`); reselecting WPA re-enables it.
- [x] **Phone preset** — `+1 (555) 123-4567` (formatting stripped to `tel:` URI by the tool)
  encodes: "Version 2 · 25×25 · EC M · mask 1".
- [x] **Email preset** — address + subject (with `&`, URI-encoded by the tool) encodes:
  "Version 4 · 33×33 · EC M · mask 2".
- [x] **Download PNG** — click produced a real browser download, suggested filename
  `qr-code.png`.
- [x] **Add to sheet + toast** — toast text "Added to sheet" observed; two adds → count label
  "(2)", 2 items in `#sheetList` and 2 mirrored in `#printArea`.
- [x] **Sheet item remove (✕)** — removing one leaves 1 item.
- [x] **Clear sheet** — 0 items, empty-hint paragraph visible again.
- [x] **Print sheet (print CSS)** — print-media emulation with a populated sheet captured in
  `v2-print-sheet.png`: only `#printArea` visible, 3-column grid, remove buttons hidden.
  (`#printSheet` guard logic and `window.print()` call are verbatim v1; the click itself is not
  driven in headless because `window.print()` blocks/no-ops there — the print stylesheet, which
  is the feature, is proven by the emulated-media screenshot.)
- [x] **Theme toggle** — harness probe: light → dark, `aria-pressed=true`, persisted to
  `suite.theme`.
- [x] **QR encoder** (GF(256) tables, Reed–Solomon, EC tables v1–10, alignment patterns, masks
  0–7, BCH format/version bits, penalty scoring) — copied **verbatim**, byte-for-byte identical
  to v1 lines 240–467; diffable directly against `v1-import`.

## changes beyond the recipe

- `.card` tool rule gained `display: block; gap: normal;` — core `suite.css` makes `.card` a
  flex column (gap .55rem) but v1 qr cards are plain blocks; without the override the form
  card's internal spacing would change. `.preview` still sets its own flex column exactly as v1.
- Footer override kept tool-local where v1 differs from core: `margin-top: 2.5rem;
  font-size: .82rem; padding-top: 1rem` (core has 3rem / .85rem / 1.1rem).
- `--bad` (error red) extracted into the four-context tool-accent block, same pattern as
  `tools/focus.html` — values identical to v1's palette blocks.
- Canvas got `role="img"` alongside its existing `aria-label` (a11y).
- The invalid `for="fEnc"` on the WiFi "Security" label (pointed at a `<div>`, not a form
  control) was replaced with `id="lblEnc"` + `aria-labelledby` on the group (a11y, see below).

## localStorage keys

| | v1 | v2 |
|---|---|---|
| `suite.theme` | bare string, via inline toggle script | bare string, via `Suite.theme` (`Suite.store` writes strings bare) |

That is the tool's only key (the sheet is deliberately in-memory in v1 — preserved).
`localstorage.json`: `keysOnlyInV1: []`, `keysOnlyInV2: []`.

## escape allowlist requests

none — the tool builds all dynamic DOM via `createElement`/`textContent`; the only template
literal into a DOM sink is `metaEl.textContent = ` + a template literal, which is `textContent`,
not `innerHTML`.

## a11y applied

- Sheet remove buttons (icon-only "✕") get `aria-label="Remove from sheet"` (kept `title`).
- `Suite.liveRegion()` on `#meta` (encode result line), `#err` (capacity errors), and `#toast`
  (add/download feedback) — all update after user actions.
- Segmented controls `#fEnc` and `#ecPick` get `role="group"` + `aria-labelledby` pointing at
  their visible labels (`lblEnc`, `lblEc`); the previous `for="fEnc"` was an invalid label
  reference to a `<div>`.
- `role="img"` on the QR canvas (had `aria-label="QR code"` already).
- Theme button label + `aria-pressed` come from core `Suite.theme.init()`.
- Every input already had a `<label for>`; encoding is live-on-input so there is no
  submit-button pair for Enter; no overlays needing Esc (toast is non-interactive,
  `pointer-events: none`).

## endpoints

None. Zero-network tool; nothing fetched, nothing uploaded (the `mailto:`/`tel:`/`WIFI:` strings
are only encoded into pixels).

## concerns for the reviewer

- **Computed-style diff (14 values/theme, all inert):** besides pre-approved
  `-webkit-font-smoothing` (12), two remain: `.theme-btn float: none→right` — core sets
  `float: right`, but the button is a flex item inside `.top`, where float is ignored per spec;
  and `.card flex-direction: row→column` — core's value shines through, but the tool overrides
  `display` back to `block`, so flex-direction has no effect. Both are proven visually inert:
  `v1-light.png`/`v2-light.png`, `v1-dark.png`/`v2-dark.png` and the print pair are
  **byte-identical** (`cmp` verified).
- The harness's automatic `v1-print.png`/`v2-print.png` are taken at load with an empty sheet,
  so they show a nearly blank page (byte-identical between versions). The meaningful print
  evidence is `v2-print-sheet.png`, captured mid-interaction with 2 codes on the sheet.
- `#printSheet`'s `window.print()` was not clicked in headless (see walk-through); its guard
  path ("Sheet is empty" toast) and the print CSS are otherwise covered.
- The `LVL` constant in the encoder block is unused in v1 and kept verbatim (encoder survives
  byte-exact per the migration notes) — do not "clean it up" later.
- Manifest entry not added to `manifest/tools.json` (hard rule: orchestrator applies it from
  `manifest-entry.json`).

## Phase 4 a11y audit

Audited 2026-07-16 against the running tool from `file://` in both themes
(harness: `tests/a11y-phase4-set2.mjs`, raw output: `phase4-a11y-audit.txt`).

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | enumerated programmatically: theme-btn ("◐ theme", core aria-label) and sheet `✕` (`aria-label="Remove from sheet"`) — all named |
| 2 | aria-live on result regions | pass | `#meta`, `#err`, `#toast` all `Suite.liveRegion` (grep + runtime `aria-live="polite"` confirmed) |
| 3 | Keyboard path | pass | primary feature driven keyboard-only: typed payload into `#fText` → meta announced "Version 2 · 25×25 · EC M"; EC level via Enter; Add-to-sheet via Enter (toast "Added to sheet"); WiFi preset tab via Enter. No positive tabindex; no overlays needing Esc (toast is `pointer-events:none`) |
| 4 | Inputs labeled | pass | all 9 inputs have `label[for]` (fHidden: wrapping label) |
| 5 | Contrast, both palettes | pass locally / suite flags | see below — no qr-local color fails; two suite-palette pairs flagged |
| 6 | Focus visibility | pass | Tab-focused button shows core 2px accent outline (none when blurred); text inputs swap border to accent on focus |

Contrast measurements (fg, effective bg, ratio — threshold 4.5 normal / 3 large-UI):
- light: `.tab.on`/`.btn` #fff on #2f6f6a **5.83 pass** · `#meta` 4.76 · `#err`/`.x` #c0492d on card **4.88** · `.btn.ghost` 5.74
- dark: `#meta` 6.19 · `#err`/`.x` #e0705a on card **5.16** · `.btn.ghost` 6.91
- **SUITE-WIDE (not fixed locally)**: light `--muted` on `--bg` 4.36 (tagline, footer); dark `#fff` on `--accent` 2.36 (`.tab.on`, `.seg .on`, `.btn`). Both are core-palette pairs — see the audit's suite-wide flag.

No changes made to qr.html — **pass as was**.
