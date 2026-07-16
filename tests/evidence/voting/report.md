# voting.html — migration report (Phase 2, Batch A)

Verified with `node verify-tool.mjs voting` (exit 0) — evidence in this directory.

## v1 feature walk-through

- [x] **Next-federal-election countdown** — renders at load: `interaction.txt` line 1 shows
  "111 DAYS TO ELECTION DAY · Midterm general election · Tuesday, November 3, 2026", which is
  correct arithmetic for 2026-07-15 (Tue after first Mon of Nov, even year). Same values in the
  v1/v2 screenshots.
- [x] **Deadline-variance banner** (warn palette) — visible in all four screenshots; the
  `--warn`/`--warn-soft` accent variables are kept tool-local in all four theme contexts;
  `.banner` computed styles diff clean.
- [x] **State picker dropdown (51 entries + "— choose —")** — `selectOption("#stateSelect","CA")`
  rendered the pinned card (interaction.txt lines 3–7).
- [x] **Pinned state card** — h2 "★ California", office link `https://www.sos.ca.gov/elections`,
  `Register via vote.gov →` link `https://vote.gov/register/ca`, "Check my status" canivote link,
  and the fine-print with the host name — all observed in interaction.txt and
  `v2-after-interaction.png` (Texas).
- [x] **Table row highlight for the pinned state** — `tr.hl` row "California CA" after picking CA;
  "Texas TX" highlighted in `v2-after-interaction.png`.
- [x] **Unpin via "— choose —"** — removes the key (`suite.voting.state` = null after unpin,
  matching v1's `removeItem`) and clears the card (0 `.pinned` nodes) — interaction.txt line 8.
- [x] **Filter box** — typing "dak" filters to 2 rows (North Dakota, South Dakota); matches on
  name or abbreviation as in v1 (same `includes` logic, verbatim).
- [x] **Pin buttons in the table** — with filter "texas", clicking the row's pin button selects TX:
  dropdown flips to TX, button text becomes "pinned", key stores "TX" (line 10).
- [x] **Persistence** — after `page.reload()`, dropdown shows TX, pinned card "★ Texas", row
  highlighted (line 11).
- [x] **First-run hint from `suite.location` label** — probed outside the harness with
  `suite.location = {"lat":30.27,"lon":-97.74,"label":"Austin, TX"}` and no pin key, on both
  versions: v1 and v2 both select TX, render the card, and write **no** key (stays null until an
  explicit choice). Output identical:
  `v1: select="TX" ... stored-key=null` / `v2: select="TX" ... stored-key=null`.
- [x] **All 51 rows / curated data verbatim** — table row count logged as 51; the `STATES` array
  was diffed against v1 and is **byte-identical** (53 lines, `diff` clean). No deadline text,
  URL, or national-card copy was touched — banner, national cards, and footer text survive
  verbatim per the full-file diff.
- [x] **Three national resource cards** (vote.gov, EAC, Can I Vote) — verbatim markup; visible in
  screenshots; `.ncard`/`.btnlink` computed styles diff clean.
- [x] **Theme toggle** — harness probe: light → dark, `aria-pressed=true` (now provided by
  `Suite.theme`); dark screenshots match v1.

## changes beyond the recipe

- `.topbar .theme-btn { float: none; }` — core's `.theme-btn` carries `float: right`; this tool's
  header is a flex row where float is inert, but the override keeps the *computed* value at v1
  parity so the style diff stays clean.
- `.search { width: auto; box-shadow: none; }` — core's `.search` is full-width with a shadow;
  v1 voting's filter box is inline and flat. Restores v1's computed styles (verified: `.search`
  diff shows only the pre-approved font-smoothing property).
- `footer { padding-top: 1.2rem; }` — v1 uses 1.2rem where core's shared footer provides 1.1rem
  (the documented per-tool override case).
- v1's local `escapeHtml()` helper replaced by `Suite.esc()` at every call site (same character
  map; the helper was a per-file duplicate of the core function).
- Unpin uses raw `localStorage.removeItem(PIN_KEY)` with a comment: `Suite.store` exposes only
  `get`/`set`, and v1 *removes* the key on unpin — setting `""` instead would leave a key a v1
  page never leaves. Verified: key is null after unpin (interaction.txt line 8).

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.voting.state` | bare string, e.g. `"TX"`; removed on unpin | identical (`Suite.store.set` writes strings bare; `removeItem` on unpin) |
| `suite.theme` | bare string via inline toggle | identical via `Suite.theme` |
| `suite.location` | read-only (first-run hint) | read-only, same semantics (probe above) |

Harness parity: `localstorage.json` — v1 `{suite.voting.state:"TX", suite.theme:"dark"}` ==
v2, `keysOnlyInV1: []`, `keysOnlyInV2: []`.

## escape allowlist requests

All remaining unwrapped interpolations are local constants or locally computed values (nothing
remote or user-influenced reaches `innerHTML`; the filter input only drives an `Array.filter`,
never markup):

| exact expression | where | reason |
|---|---|---|
| `${days === 0 ? "Today" : days}` | renderCountdown | `days` is a Number from local date arithmetic |
| `${days === 0 ? "is Election Day" : days === 1 ? "day to Election Day" : "days to Election Day"}` | renderCountdown | string literals only |
| `${dfmt}` | renderCountdown | `toLocaleDateString` of a locally computed Date; no markup characters |
| `${abbr.toLowerCase()}` | renderPinned (vote.gov href) | 2-letter code from the curated `STATES` constant |
| `${abbr === pinned ? "hl" : ""}` | renderTable (class attr) | string literals only |
| `${abbr}` | renderTable (td.st span) | curated 2-letter code |
| `${abbr}` | renderTable (`data-abbr` attr) | curated 2-letter code |
| `${abbr === pinned ? "pinned" : "pin"}` | renderTable (button text) | string literals only |

(Everything v1 escaped — names, URLs, hosts, election kind — is wrapped in `Suite.esc()`.)

## a11y applied

- Filter input: `aria-label="Filter the state table"` (was placeholder-only).
- Pin buttons: per-row `aria-label` — `Pin <State>` / `<State> is pinned` (visible text "pin" is
  ambiguous out of context for screen readers).
- `#pinned` container: `Suite.liveRegion()` so the card is announced when a state is chosen.
- Theme button `aria-label` + `aria-pressed` from core; `:focus-visible` outlines and
  reduced-motion guard from core.
- Already fine in v1 (kept): `<label for="stateSelect">`, all interactive elements are native
  button/a/select/input (keyboard paths intact); no overlays, so no Esc handling needed; the
  filter is live-as-you-type, so no Enter-submit pair exists.
- Countdown was left without a live region: it renders once at load, never after a user action.

## endpoints

None — `endpoints: []`. Zero fetches; the state-office / vote.gov / eac.gov / canivote.org
`href`s are outbound navigation (`target="_blank" rel="noopener"`), not requests the tool makes.

## concerns for the reviewer

- **Unpin writes outside `Suite.store`**: `localStorage.removeItem("suite.voting.state")` — the
  store API has no `remove`. If the orchestrator would rather add `Suite.store.remove()` to core
  later, this is the first call site to migrate; behavior today is exactly v1's.
- The pin-button `aria-label` is interpolated into the row template (wrapped in `Suite.esc`);
  it's the only markup v2 adds inside `innerHTML` that v1 didn't have.
- The first-run location hint was verified with a scratch probe, not the harness (the harness
  interaction starts from a clean profile without `suite.location`); output quoted above but the
  probe script itself lives in the session scratchpad, not in this evidence dir.
- Curated content (STATES array, deadline copy, national cards) diffed byte-identical to v1 —
  deliberately **not** refreshed for the 2026 cycle; that is the tool's own refresh process, out
  of scope for migration.

## Phase 4 a11y audit

QUALITY.md §2 re-verified against `tools/voting.html` from `file://`, light + dark
(raw log: `phase4-a11y-audit.txt`). **Verdict: fixed (1 contrast item).**

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| 1 | icon-only controls named | pass (n/a) | none; per-row pin buttons have text + aria-label ("Pin Texas" / "Texas is pinned") |
| 2 | async regions aria-live | pass | `#pinned` = polite — announces the pinned-state card on select/pin (the tool's update surface); countdown/table render once at load or synchronously with the filter box |
| 3 | keyboard paths | pass | keyboard-only drive: select type-ahead "Texas" pinned ★ Texas, typed "verm" in the filter → table filtered to 1 row, Tab to row pin button + Enter → ★ Vermont announced via the live region; no traps |
| 4 | input labels | pass | `#stateSelect` via `label[for]`; `#search` via aria-label |
| 5 | contrast both palettes | **fixed** | light `--warn` #b0752a→**#8a5a1e**: banner `<strong>` on `--warn-soft` was 3.04 → now **4.63**; dark untouched (6.2). All other pairs ≥4.63 (L) / ≥6.19 (D) |
| 6 | focus visibility | pass | 2px accent outline on every stop, both themes |

Harness: `node verify-tool.mjs voting` re-run after the fix — exit 0, console clean.
SUITE-WIDE flag: muted-on-`--bg` 4.36 light (footer).
