# notes.html migration report (Batch A)

Verified: `cd tests && node verify-tool.mjs notes` → exit 0, evidence in this directory.

## v1 feature walk-through

- [x] **Welcome note seeded on first run** — `interaction.txt` line 1: initial list `["Welcome"]`; both screenshots show the rendered Welcome note.
- [x] **Create note (+ New note)** — interact clicks `#newNote`, types title + markdown body; list shows the new note (interaction line 7).
- [x] **Debounced autosave (600 ms) + saved/editing indicator** — after typing and a 900 ms wait the indicator reads `saved ✓` and `localStorage["suite.notes"]` holds 757 chars (lines 3, 6).
- [x] **Persistence across reload** — page reloaded; note list still contains "Migration test note", editor content strictly equals the typed 174-char body (lines 7–9). This is the core feature, exercised end-to-end.
- [x] **Title from first line when title blank** — covered by code parity (`firstLineTitle` unchanged); explicit title path verified via the title input round-trip (line 9).
- [x] **Live markdown preview** — headings, bold, italic, inline code, ul, blockquote, safe link (`target=_blank rel=noopener`), fenced code all present in preview HTML (line 5). Plain digits `123 456` survive un-mangled, proving the U+E000 inline-code sentinel round-trip still works.
- [x] **Word/char count** — `31 words · 174 chars` (line 4).
- [x] **Note list sorted by last-updated, active highlight, per-note word count** — after reload the fresher test note lists first (line 7); `.on` highlight visible in v2-after-interaction.png.
- [x] **Delete note with confirm()** — confirm dialog fired with v1's exact wording and the note left the list (lines 13, 18).
- [x] **export .md (current note)** — download captured to `exported-note.md`, suggested name `Migration test note.md`, content byte-equal to the editor body (line 10).
- [x] **export all (JSON)** — download captured to `exported-all.json`, suggested name `notes-2026-07-15.json`, 2 notes (line 11).
- [x] **import JSON** — `import-fixture.json` fed through `#importFile`; alert "Imported 1 note." and the note appeared in the list (lines 12, 18).
- [x] **Preview toggle (👁)** — display flips block → none → block (lines 15–16).
- [x] **Ctrl/Cmd+S immediate save** — indicator `saved ✓` after Ctrl+S (line 17).
- [x] **Theme toggle** — light → dark, `aria-pressed=true` (line 19); dark screenshots match v1.
- [x] **"storage full" warning on quota failure** — preserved via a read-back check in `save()` (see "changes beyond the recipe"); not exercised live (would require filling the quota) — flagged under concerns.
- [x] **beforeunload flush** — listener kept verbatim; reload-persistence test passes through it.

Note: v1 line 444 has a comment mentioning "Ctrl/Cmd+B new note" but **no code implements it** — comment/code mismatch in v1. Not added (no features added); the stale half of the comment was dropped.

## changes beyond the recipe

- **`save()` quota-failure detection**: v1 wrapped `localStorage.setItem` in try/catch and flagged "⚠ storage full". `Suite.store.set` swallows quota errors, so v2 reads the key back and compares against the expected JSON; mismatch (or a throwing read) triggers the same flag. Same user-visible behavior, no exception path removed.
- **`esc` aliased to `Suite.esc`**: v1's local `esc()` performed the identical five replacements; the alias keeps `renderMd`/`inlineMd` code byte-identical below it.
- **U+E000 sentinels preserved as raw characters** (lines with `codes.push` / `codes[+i]`): v1 protects inline-code spans with literal U+E000 private-use chars that are invisible in most editors; v2 keeps the raw chars byte-identical to v1 and adds a comment naming the codepoint so future editors don't "clean them up".
- **Header chrome override**: v1 styles `.back`/`.theme-btn` as pill buttons inside a flex header (not core's plain link + floated button), so the tool keeps the combined `.back, .theme-btn, .tbtn` rule plus `float: none` and a `text-decoration: none` hover override against core's `.back:hover` underline. Computed-style diff confirms parity.
- **Footer override**: v1's footer is a compact centered bar on `--card` (not core's 3-rem-margin default) — tool-local footer rule kept with `margin-top: 0` added to cancel core's default.
- **`FileReader` `reader.onload` → `addEventListener("load", …)`** per the .onX conversion rule (plus all `.onclick` conversions).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.notes` | JSON array of `{id, title, body, updated}` | identical (same key, same JSON.stringify shape — evidence: `localstorage.json`, both 757 chars after identical interactions, `keysOnlyInV1`/`keysOnlyInV2` both empty) |
| `suite.theme` | bare string `"light"`/`"dark"` | identical (written bare by `Suite.store.set`) |

No other keys are read or written.

## escape allowlist requests

- `preview.innerHTML = renderMd(editor.value)` — the only innerHTML interpolation. `renderMd`/`inlineMd` escape ALL user text through `esc` (= `Suite.esc`) **before** applying markup; inline-code contents are escaped then protected by U+E000 sentinels that `esc()` output can never contain; link URLs are pre-escaped and gated to `https?:`/`mailto:`. Input is local user text only (no remote data — tool is offline). Verified: preview output in `interaction.txt` line 5 shows escaped-safe HTML.

## a11y applied

- `aria-label="Delete note \"<title>\""` on the icon-only × delete buttons (was title-only).
- Keyboard path for note selection: list items get `tabIndex = 0` + Enter/Space handler (v1 was click-only); verified in `interaction.txt` line 14 ("keyboard-selected note title: Welcome").
- Delete button revealed on keyboard focus: `.note-list li:focus-within .del, .del:focus-visible { opacity: 1 }` (v1 revealed on hover only).
- `Suite.liveRegion` on the `#saved` autosave indicator (announces "editing… / saved ✓ / storage full" after user actions). The word-count span was deliberately left non-live (updates every keystroke — would be noisy).
- `aria-label` on `#noteTitle` ("Note title"), `#editor` ("Note text"), and the hidden `#importFile`.
- `aria-pressed` state on the preview toggle button (init `true`, flipped in the handler; verified lines 15–16).
- Theme button label/`aria-pressed` from core `Suite.theme.init()` (line 19).
- No overlays exist, so no Esc path needed; the only dialogs are native `confirm`/`alert` (keyboard-accessible by the browser).

## endpoints

None. Zero network; nothing in the file references any external host. `endpoints: []`.

## concerns for the reviewer

- **Quota-failure path not exercised live.** The read-back reimplementation of "⚠ storage full" is code-reviewed logic, not evidence-backed — filling localStorage quota in the harness was judged out of scope. Worth a manual look at `save()`.
- **v1's `save()` had `return` after the flag** (aborting nothing else); v2's read-back version has no early return — behaviorally equivalent since nothing follows, but the shape differs from v1.
- **Private-mode edge:** if localStorage is entirely unavailable, `Suite.store`'s memory backend keeps the session working while the read-back check shows "⚠ storage full". v1 would have thrown on load and shown nothing. v2 is strictly more usable but the indicator text ("storage full") is imprecise for that case.
- **`inlineMd` italic regex quirk inherited verbatim:** `/(^|[^*])\*([^*]+)\*/g` behaves identically to v1, including its known cross-`**` interactions. Not fixed (parity over polish).
- **The U+E000 sentinels are invisible** in most editors/diff viewers — a future reformat could silently strip them and break inline code + mangle all digits in preview. A comment now marks them, but the reviewer should confirm their survival in the committed diff (bytes `EE 80 80`, twice, around lines 185 and 196).
- v1's stale "Ctrl/Cmd+B new note" comment was dropped rather than implemented — confirm this reading (the keybinding never existed in v1 code, so nothing was removed).

## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`). Re-verified with `node verify-tool.mjs notes` → exit 0.

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | note-row `×` has `aria-label='Delete note "<title>"'`; 👁 preview button has visible text + `aria-pressed`; hidden import input has aria-label |
| 2 | aria-live | pass | `#saved` (autosave state) liveRegion — runtime confirmed. Preview mirrors typing (not live by design); list/word-count are keystroke-synchronous |
| 3 | Keyboard path | pass | keyboard-only: typed markdown → preview h1 rendered, autosave announced "saved ✓"; + New note via Enter; note switching via Enter on the tabbable `li` (tabindex 0 + Enter/Space handlers, delete button revealed on `:focus-within`); Ctrl+S flushes save. Delete confirm is a native dialog |
| 4 | Inputs labeled | pass | title/editor/import-file aria-labels |
| 5 | Contrast | **fixed** | see below |
| 6 | Focus visibility | pass | core 2px accent outline on toolbar buttons/links; title input gets border+bg change on focus |

Contrast — **fixed: `--warn`** — `.saved.dirty` referenced `var(--warn, #b0752a)` but the
tool never defined `--warn`, so the fallback rode both themes: **3.81 light / 4.21 dark** on
the card. Defined the 3-layer tool accent (light #9c6620, dark #d19a4e, matching the suite's
warn family) → **4.77 / 6.56**. Other passes: `.tbtn` 14.61/12.96, `.side-top button` and
active note name on accent-soft 4.95/6.30, editor 13.39/14.25, `.preview code` 12.58/11.44,
footer-on-card 4.76/6.19. (Welcome note renders no blockquote, so that muted-on-bg pair is
covered by the suite flag.)
**SUITE-WIDE flags**: light muted on `--accent-soft` 4.11 (`.wc` word counts, `×` at rest on
the selected row) and muted-on-bg 4.36 (editor-bar count); dark passes.

Fix made: tool-local `--warn` definition (all four theme contexts). No behavior change;
`suite.notes` format untouched.

## Phase 4 accent-ink sweep (D10)

No filled-accent controls with #fff/white ink — no-op.
