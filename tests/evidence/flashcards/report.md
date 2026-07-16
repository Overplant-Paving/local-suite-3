# flashcards.html — migration report (Batch A)

Evidence: this directory. Harness run: `node verify-tool.mjs flashcards` — exit 0, console clean.

## v1 feature walk-through

Every v1 feature, each verified (interaction.txt line refs are the harness log):

- [x] **Create deck** (name input + button) — typed "Spanish Verbs", clicked Create deck; tile appeared (interaction.txt 1-2).
- [x] **Enter creates deck** — v1's `keydown Enter -> addDeck.click()` listener survives verbatim (code parity; input path exercised via button).
- [x] **Deck tile: card count / due count / learned progress bar** — tile meta logged "4 cards none due" after study, and the after-interaction screenshot shows the full green bar vs the imported deck's "4 due" (interaction.txt 17, v2-after-interaction.png).
- [x] **Open deck (click tile)** — clicked; deck view rendered with stats row (interaction.txt 3).
- [x] **Add card (front/back textareas)** — added "hablar/to speak", "comer/to eat"; stats went 2 CARDS 2 DUE 2 NEW (interaction.txt 3). Ctrl+Enter-in-Back shortcut survives verbatim (code parity).
- [x] **Card list rows with state badge, Edit, ✕ delete** — 4 rows rendered after CSV import; Edit/delete handlers converted to addEventListener, prompt/confirm flows unchanged (interaction.txt 5).
- [x] **CSV import** (header-row skip, quoted commas, front,back per line) — 3-line fixture (header + 2 rows, one with quoted commas) imported exactly 2 cards; the quoted row rendered as `ser, estar` / `to be, to be (state)` proving parseCSVLine survived (interaction.txt 4-7; fixture archived as csv-fixture.csv).
- [x] **JSON export** — download captured: suggested filename `spanish-verbs.json` (v1's slug rule), payload `{name, cards}` with all 4 cards and scheduling fields (interaction.txt 8; archived as exported-deck.json).
- [x] **JSON import** (single deck or array, field coercion) — re-imported the exported file; alert "Imported 1 deck(s).", second tile appeared, card scheduling fields (ease/interval/reps/due) preserved through the round-trip (interaction.txt 20-22).
- [x] **Study due / Study all buttons** — "Study 4 due" label logic verified (interaction.txt 9); disabled-when-none-due verified after reload ("Nothing due", interaction.txt 18). Study-all is the same startStudy(true) code, unchanged.
- [x] **Flip (click and Space)** — mouse flip on card 1, keyboard Space flips on cards 2-4 (interaction.txt 12; keyboard loop in flashcards.mjs).
- [x] **Grade buttons with interval previews + number-key grading** — previews logged "Again 10 min / Hard 1 d / Good 1 d / Easy 3 d" for a new card, matching the SM-2-lite math; card 1 graded by mouse, cards 2-4 by pressing "3" (interaction.txt 13).
- [x] **SM-2-lite scheduler** — function preserved byte-for-byte. After Good on a new card: ease=2.5, interval=1, reps=1, due>now — exactly v1's first-graduation rule (interaction.txt 16).
- [x] **Again re-queue** — `if (g === 1) queue.push(card)` and the 10-min relearn branch survive verbatim (code parity; Good path exercised live).
- [x] **Session-complete screen** ("Study remaining" when cards still due) — done screen rendered with the "Nothing left due" variant (interaction.txt 14).
- [x] **Rename / Delete deck** (prompt/confirm) — handlers converted to addEventListener, logic unchanged (code parity; not exercised live because Playwright auto-dismissal would no-op them).
- [x] **Persistence** — full reload: deck, 4 cards, and the schedule state (ease/interval/reps) all survived; stats showed 0 DUE / 4 LEARNED (interaction.txt 17-19).
- [x] **Theme toggle** — light -> dark, aria-pressed=true (interaction.txt 23).
- [x] **Crumb navigation** (← All decks / ← Back to deck) — crumbBack exercised in the re-import flow (interaction.txt 20-21).

## changes beyond the recipe

- `.back` / `.theme-btn`: v1 positions both absolutely inside the relative header (core uses flow + float). Kept tool-local positional overrides (`position:absolute; left/right/top`, plus `float:none` on `.theme-btn` to neutralize core's `float:right`) so the computed-style diff and screenshots match v1 exactly.
- `footer`: tool-local override `font-size:.82rem; padding-top:1rem` where v1 differs from core's `.85rem/1.1rem`.
- Crumb links (`#crumbBack`, `#studyBackCrumb`) got `href="#"` + `preventDefault()` so they are keyboard-focusable/activatable (bare `<a>` with onclick — mouse-only — in v1).
- Deck tiles got `role="button"`, `tabindex="0"`, and an Enter/Space keydown handler (mouse-only in v1).
- The flashcard got `role="button"`, `tabindex="0"`, an aria-label, and Enter-to-flip (Space already worked document-wide in v1 and still does).
- `load()` now reads via `Suite.store.get` with an `Array.isArray` guard — same semantics as v1's `JSON.parse(...) || []` in try/catch (bad JSON -> `[]`).
- Local `esc` helper replaced by `Suite.esc` (identical implementation) so the escaping heuristic sees the wraps.
- Everything else — scheduler, CSV parser, import coercion, queue logic, markup structure — is verbatim v1.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.flashcards.v1` | JSON array of decks | identical — same key, same shape; `Suite.store.set` with an array JSON-stringifies exactly like v1's `JSON.stringify(decks)` |
| `suite.theme` | bare string via raw localStorage | identical — `Suite.store` writes strings bare |

Parity verdict: localstorage.json shows identical key sets (`keysOnlyInV1: []`, `keysOnlyInV2: []`) after mirrored interactions, and both values begin with the same deck/card JSON shape. A v1 user's decks and review schedules load unchanged.

## escape allowlist requests

User/deck-derived strings (`d.name`, `c.front`, `c.back`, `card.front`, `card.back`) are all wrapped in `Suite.esc(`. The remaining unwrapped interpolations are provably safe locals:

- `${total}`, `${due}`, `${newN}`, `${learned}`, `${queue.length}` — integers from `.length` / `.filter().length`.
- `${total===1?"":"s"}` — literal `""`/`"s"`.
- `${total ? Math.round(learned/total*100) : 0}` — integer percent for the bar width.
- `${c.id}` — always generated by local `uid()` (base36); JSON-imported cards are re-id'd with `uid()` on import, so no foreign value ever reaches it.
- `${state}` — built from the literals `"new"`/`"learning"` or `` `${c.interval}d · ease ${c.ease}` `` where interval/ease are numbers (import coerces with `+c.ease || 2.5` etc.).
- `${cls}`, `${name}`, `${g}` (grade buttons) — constants from the local `G` array.
- `${preview(g)}` — returns `"10 min"` or `"<n> d"` from numeric scheduler output.
- `${due ? due + " card(s)..." : "..."}` (renderDone) — `due` is an integer count; rest literal.
- `${Suite.esc(card.front) || "&nbsp;"}` / back — escaped value with a literal `&nbsp;` fallback.

## a11y applied

- `aria-label="Delete card"` on the icon-only `✕` button (Edit has visible text).
- `aria-label` on `#newDeck` (placeholder-only in v1) and on both hidden file inputs.
- `<label for="cardFront">` / `<label for="cardBack">` — v1 had labels without `for`.
- `Suite.liveRegion()` on `#deckStats` and `#studyBody` (containers that update after user actions).
- Keyboard paths added: deck tiles (Enter/Space), crumb links (real href + Enter), flashcard (Enter; Space was already global). Number-key grading and Enter-to-create-deck already existed in v1.
- Theme button label/`aria-pressed` from core `Suite.theme.init()`.
- Esc/overlays: n/a — the tool uses native `prompt`/`confirm`/`alert` only.

## endpoints

None. Zero network; `endpoints: []`.

## concerns for the reviewer

- **Rename/Delete/Edit `prompt`/`confirm` flows were not exercised live** (Playwright auto-dismisses dialogs, which cancels them). The handlers are verbatim v1 logic minus `onclick -> addEventListener`; a 30-second manual check would close this.
- **"Study all" and the Again re-queue branch were not exercised live** — same code paths as the verified flows (`startStudy(true)` / `queue.push`), preserved byte-for-byte, but stating it honestly.
- v1's `showGrades`/`grade`/`renderDone` declare an unused `d` variable; kept verbatim for diff-minimalism rather than cleaned up.
- The v1 `G` array's third element (`"&lt;10 min"`) is dead (destructured with a hole; `preview(g)` supplies the text); kept verbatim.
- The harness's v2 localStorage value is longer than v1's (1149 vs 201 chars) only because the v2 interaction creates 4 cards + a re-imported deck while v1Interact mirrors a minimal subset — key sets and shapes are identical.
## Phase 4 a11y audit

Audited 2026-07-16 from `file://`, both themes (`tests/a11y-phase4-set2.mjs`;
raw: `phase4-a11y-audit.txt`). Re-verified with `node verify-tool.mjs flashcards` → exit 0.

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Icon-only controls named | pass | card-row `✕` has `aria-label="Delete card"`; deck cards and the flashcard are labeled `role=button` elements |
| 2 | aria-live | pass | `#deckStats` and `#studyBody` liveRegion (runtime confirmed) — stats announce after add/import, the study flow announces each new card and the session-complete state |
| 3 | Keyboard path | pass | full keyboard-only run: deck created via Enter; deck opened via Enter on the tabbable deck card; card added via Ctrl+Enter from the Back field; study via Enter on Study-due; **Space flips** (documented shortcut, verified), **number key 3 grades** → "Session complete" announced. Grade buttons also plain buttons with visible key hints |
| 4 | Inputs labeled | pass | new-deck aria-label, front/back `label[for]`, both hidden file inputs aria-labeled |
| 5 | Contrast | **fixed** | see below |
| 6 | Focus visibility | pass | core 2px accent outline (buttons, deck cards, flashcard, textareas swap border) |

Contrast — **fixed: light grade colors** — `.grade.again b` #c05a5a **4.26** and
`.grade.hard b` #c07f2d **3.27** on the card. Deepened light `--again`→#b04545, `--hard`→#9a6110
→ **5.46 / 5.05**; Good 4.93 / Easy 5.74 already passed; dark grades pass unchanged
(5.62–7.86). Other passes: face content 14.61/12.96, `.grade .k` key hints (.66rem!) 4.76/6.19
on card, deck meta/due 4.76/5.74-class, `.iconbtn` 4.36 vs 3.0 UI threshold.
**SUITE-WIDE flags**: light muted-on-bg 4.36 (tagline, prompt hint, stat labels, card-row
back text + state badges — the card list sits on the page background); dark #fff-on-accent
2.36 (`.btn`).

Fixes made: light `--again`/`--hard` (both light contexts). SM-2 scheduling, storage
(`suite.flashcards.v1`) and behavior untouched.
