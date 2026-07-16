# dataviewer — migration report (Batch A)

Verified by `node verify-tool.mjs dataviewer` (exit 0). Evidence in this directory:
`computed-style-diff.txt`, `interaction.txt`, `localstorage.json`, four theme screenshots,
`v2-after-interaction.png`, plus the two fixtures fed through the real file input
(`fixture.json`, `fixture.csv`).

## v1 feature walk-through

- [x] **Drop zone (drag & drop)** — markup/CSS and all five drag listeners (dragenter/dragover/
  dragleave/drop + window-level default-prevention) ported verbatim. Drop zone visible in both
  initial screenshots; the `.over` highlight class logic unchanged. (Playwright cannot synthesize
  OS file drags; the identical `readFile` path is proven via `setInputFiles` below.)
- [x] **"Choose a file" picker** — `#pick` click -> hidden `#file` input; exercised via
  `page.setInputFiles` for both fixtures. interaction.txt lines 1-5, 20-21.
- [x] **Sample JSON / sample CSV buttons** — sample JSON clicked in-run: `fmeta=object`,
  modes=Tree only, tree visible (interaction.txt line 19). Sample data strings byte-identical to v1.
- [x] **JSON -> tree view** — built for both the array fixture and the object sample; 6 twisties
  counted, string values quoted and type-colored (line 13).
- [x] **JSON array-of-objects -> table + tree modes** — fixture.json produced
  `3 records · array · 358 B`, modes `▦ Table[on] | ❯ Tree` (lines 2-3), mode switch exercised.
- [x] **CSV -> table with delimiter sniff** — `3 rows · 3 cols · comma-separated · 91 B` (line 20).
- [x] **CSV quoted fields with embedded delimiter** — "Fair Oaks, Ranch" renders as one cell
  (line 21).
- [x] **Column stats in headers** (filled/uniq, min/max for numeric) — visible in
  `v2-after-interaction.png` (`min 10,288 · max 155,984 · 3 uniq`).
- [x] **Numeric column detection** (`td.num`, right-aligned, colored) — `numeric cell class=num`
  (line 21) and visible in the after-interaction screenshot.
- [x] **Sort by column, asc/desc toggle with arrow** — click sorted score ascending (first row 7),
  second activation flips to descending (first row 99); lines 10-11.
- [x] **Filter box (matches any column)** — `bravo` -> 1 row + `1 row match` row info; clearing
  restores 3 rows (lines 8-9).
- [x] **Row-count / capped-rows readout** — `rowInfo` verified above; `MAX_ROWS = 5000` cap logic
  unchanged (not exercised — a 5000-row fixture would add no coverage of changed code).
- [x] **Tree collapse/expand per node with inline preview** — twisty click -> `collapsed=1`,
  preview `5 keys }` (line 14).
- [x] **Expand all / Collapse all** — `collapseAll: collapsed=5`, `expandAll: collapsed=0`
  (lines 16-17).
- [x] **✕ close resets to drop zone** — drop visible=true, filebar visible=false (line 18);
  `reset()` unchanged.
- [x] **Parse-error notice + JSON->CSV fallback** — `showError`/fallback logic ported verbatim
  (only `escapeHtml` -> `Suite.esc`, identical implementations).
- [x] **BOM stripping** — the three literal `U+FEFF` regex characters survived the port
  byte-for-byte (verified by counting `U+FEFF` occurrences in v1 vs v2: 3 = 3, no file-leading BOM).
- [x] **Theme toggle** — `light -> dark`, `aria-pressed=true` (line 22); persists to `suite.theme`.

Console: clean, no errors (line 23).

## changes beyond the recipe

- **`.back`/`.theme-btn` kept as tool-local CSS** (recipe says strip): v1 dataviewer styles the
  back link as a pill identical to the theme button, unlike the core plain-link `.back`. The v1
  rule is kept locally, plus `float: none` (core floats `.theme-btn`; the flex header places it
  here) and `text-decoration: none` on hover (core underlines `.back:hover`). Screenshots confirm
  pixel parity.
- **`.tools input.search` gains `box-shadow: none; width: auto;`** — the element carries the
  `.search` class, and core `.search` adds a shadow and width:100% that v1 dataviewer does not
  have. After this override the computed-style diff is empty except pre-approved font-smoothing.
- **`footer` local override** (`margin-top: 2.5rem; font-size: .84rem; text-align: center`) —
  v1 dataviewer differs from the core footer baseline in exactly these three declarations.
- **Local `escapeHtml()` helper removed** in favor of the byte-identical `Suite.esc()` (used in
  the one `innerHTML` interpolation, `showError`).
- **`setupModes` simplified**: v1 click handler toggled `.on` classes and then called
  `showTable()`/`showTree()`, which re-toggled the same classes; the redundant first toggle was
  dropped (the show functions now also paint `aria-pressed`). Behavior identical.
- **`FileReader.onload/.onerror` -> `addEventListener`** per the recipe rule for `.onX=`
  property assignments (all `onclick=` assignments likewise converted; there were no inline
  handler attributes in v1 dataviewer).
- **Keyboard sort focus restore**: after Enter/Space on a header, `renderTable()` rebuilds the
  `<thead>`, so the handler re-focuses the same column's fresh `<th>` (verified:
  `focus-restored=true`, interaction.txt line 11).

## localStorage keys

| | v1 | v2 |
|---|---|---|
| `suite.theme` | written by inline theme script | written by `Suite.theme` (bare string, byte-identical) |

No other keys in either version. Parity snapshot: `keysOnlyInV1: []`, `keysOnlyInV2: []`.

## escape allowlist requests

None. The single template interpolation into `innerHTML` (`showError`) is wrapped in
`Suite.esc()`. Everything else — table cells, headers, tree keys/values, file name, meta —
is built with `createElement`/`textContent` (v1 was already disciplined here; see concerns).

## a11y applied

- `Suite.liveRegion()` on `#notice` (parse errors), `#rowInfo` (filter results), `#fmeta`
  (file-loaded summary).
- `aria-label` on the filter input and the hidden file input (placeholder-only in v1).
- Sortable `<th>`: `tabindex="0"`, `scope="col"`, `aria-sort`
  (none/ascending/descending, verified in interaction.txt lines 10-11), Enter/Space activation
  with focus restored after re-render. Row-number corner `<th>` gets `scope="col"` only.
- Tree twisties: `role="button"`, `tabindex="0"`, `aria-expanded`, `aria-label`
  (Expand/Collapse), Enter/Space toggles (verified, lines 14-15); hidden twisties on empty
  containers get `tabindex="-1"`.
- Mode buttons (`▦ Table` / `❯ Tree`): `aria-pressed` tracks the active view.
- Theme button `aria-label` + `aria-pressed` from core.
- Keyboard paths: every mouse path has one — drop-zone click is duplicated by the "Choose a file"
  button; sort and twisty paths added above. No overlays, so no Esc handling needed.

## endpoints

None. Zero network: the file is read with `FileReader`; no fetch/XHR anywhere in the tool.

## concerns for the reviewer

1. **Escaping (per the migration brief watch-item): v1 was already clean, and v2 matches it.**
   All untrusted file content flows through `textContent`/`createTextNode`; the one `innerHTML`
   interpolation (`showError`, which includes `err.message` derived from file content) was escaped
   in v1 and now uses `Suite.esc()`. Verified adversarially: a `<script>alert(1)</script>` payload
   in the JSON fixture renders as inert text in both table and tree
   (`<script> elements inside #table=0`, `inside #tree=0`; interaction.txt lines 6-7, 12). Nothing
   was silently "fixed" — there was nothing to fix.
2. **Drag-and-drop not literally simulated** — Playwright cannot synthesize an OS file drag; the
   drop handler feeds the same `readFile()` exercised via the file input. The listeners are a
   verbatim port.
3. **`sortDir` initial-state nit (v1 behavior, preserved)**: after sorting one column then another,
   the new column always starts ascending — same as v1; no change.
4. **`nums` array in `computeStats` is collected but unused** — dead weight inherited from v1,
   kept verbatim per the no-silent-changes rule.
5. **The `.muted-inline` CSS class is defined but never used** — also inherited from v1, kept.
6. **Header pill styling override** deviates from the recipe strip-`.back`/`.theme-btn`
   instruction because v1 dataviewer chrome genuinely differs from the shared pattern; parity
   screenshots justify it (see "changes beyond the recipe").
## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`). Re-verified with `node verify-tool.mjs dataviewer` → exit 0.

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | tree twisties `▸/▾` carry `role=button` + `aria-label` Expand/Collapse + `aria-expanded`; `✕ close` and mode buttons have text |
| 2 | aria-live | pass | `#notice`, `#rowInfo`, `#fmeta` liveRegion (runtime confirmed). The table body itself is not live (rowInfo announces row counts on filter/sort — the right grain) |
| 3 | Keyboard path | pass | keyboard-only: sample CSV loaded via Enter; filter typed → "1 row match" announced; column sort via Enter on tabbable `th` (aria-sort flips, **focus restored to the header after re-render**); close + sample JSON via Enter; twisty collapse/expand via Enter (`aria-expanded` tracked). Drop zone itself is mouse-only but the equivalent keyboard path is the "Choose a file" button. No overlays |
| 4 | Inputs labeled | pass | `#search` and `#file` aria-labels |
| 5 | Contrast | **fixed** | see below |
| 6 | Focus visibility | pass | core 2px accent outline on buttons/th/twisties (all tabbable) |

Contrast — **fixed: light `--t-bool`** — JSON boolean tokens were #9a5cc0 on the card:
**4.43:1**. Deepened to #8a53ae → **5.26**. All other JSON-type inks pass: light `.k` 4.77,
`.s` 4.93, `.n` 5.74, `.nul` 4.50 (exactly at AA); dark 6.30–9.29. Table: th 14.61/12.96,
th stats 4.76/6.19, `td.num` 4.95/6.30.
**SUITE-WIDE flags**: light muted-on-bg 4.36 (tagline, filebar meta, row info) and muted on
`--accent-soft` 4.11 (row numbers under the hover tint); dark #fff-on-accent 2.36 (active
mode button).

Fix made: light `--t-bool` #9a5cc0→#8a53ae (both light contexts). No behavior change; no storage.
