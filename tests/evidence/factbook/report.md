# factbook.html — migration report (Batch B slot)

## THE HEADLINE FINDING — v1 factbook is a ZERO-NETWORK tool

The batch metadata (v1 hub entry `src:["restcountries","US Census"]`, CATALOG.md §7.5, the
burn-down's `cors` class) describes the *planned* tool. The **shipped v1 implementation makes no
network request of any kind**: the country dataset (~190 countries: ISO2, name, capital, region,
currency, languages, approx. population) and the US state dataset (50 states: capital, admission
year, nickname, 2020 Census population) are embedded pipe-delimited constants, and flags are
emoji composed from the ISO2 code via `String.fromCodePoint` — no restcountries.com, no
api.census.gov, no flagcdn.com, no `<img>` at all. Verified by reading the full v1 file and
grepping it for `fetch(|restcountries|flagcdn|census` (only prose matches in the footer/comments).
The v1 file's own tagline says so: "a calm reference that works with or without a connection",
and the footer credits "an embedded reference set". This is the same planning-artifact class as
spaceweather's grid flag (burn-down #27).

Per the parity rules (no features added, no behavior removed) the tool was migrated **faithfully
as offline**. Consequences, all deviating from the instructed metadata and needing the
orchestrator's sign-off:

- `network: "offline"` (not `"cors-open"`) — the batch B addendum's "unless your tool-specific
  notes say otherwise" clause; the notes said *verify*, and this is the verified result.
- `endpoints: []` — nothing for CSP `connect-src`/`img-src`; a missing host can't break dist
  because no host is contacted.
- `cacheTtlMin: null` (not the instructed 10080) — there is no fetch to cache; a TTL would be a
  fiction. The 7-day reference-data class would apply *if* restcountries were ever wired in.
- No `Suite.fetchJSON` conversion, no stale-card UX — none exists in v1 to preserve. The
  offline path was still proven the only honest way available: all http(s) aborted, reload,
  full functionality (see below).
- `flags: ["ea"]` kept as instructed for the Phase 4 escape re-audit.

If the orchestrator *wants* the live restcountries/Census upgrade the CATALOG describes, that is
a feature addition outside this migration's charter — flagging, not doing.

## v1 feature walk-through

- [x] Default US country card on boot — verified: interaction.txt line 1–3 logs
      h2="United States", Capital=Washington, D.C., Population=335,000,000, USD, flag
      U+1F1FA U+1F1F8 with aria-label "Flag of United States".
- [x] Country search with live suggestion dropdown (name substring or exact ISO2) — verified:
      typing "japan" opens `.suggest` with 1 item "🇯🇵 Japan" (logged).
- [x] Keyboard navigation in suggestions (ArrowDown/ArrowUp highlight, Enter picks; Enter with
      no highlight picks first) — verified: ArrowDown+Enter rendered the Japan card
      (Capital=Tokyo, Population=124,000,000, JPY Japanese yen, Japanese, Asia — logged).
- [x] Suggestion click picks a country — verified with Kenya during the offline stage
      (Capital=Nairobi, KES Kenyan shilling — logged).
- [x] Click outside the searchbox closes the dropdown — code preserved verbatim
      (document-level click handler); dropdown also observed closed after pick (logged).
- [x] "No match" disabled row for a fruitless search — code preserved verbatim.
- [x] Flag emoji from ISO2 (fallback 🏳️ for bad codes) — logic byte-identical; codepoints logged.
      (Windows Chrome draws regional-indicator pairs as letters, e.g. "US" — identical in the v1
      screenshots, so parity holds.)
- [x] Tabs Countries / US States switch panels — verified: after clicking #tabState,
      countryPanel display="none" (logged); tab active styling flips.
- [x] State grid of all 50 chips with populations — verified: 50 chips logged unfiltered.
- [x] State search filters the grid; exact name/abbr match renders the state card — verified:
      "texas" filtered the grid to one chip and rendered Texas (TX), "Lone Star State",
      Capital=Austin, Population=29,145,505 (2020 census), Admitted 1845 (all logged).
- [x] State chip click renders the card and scrolls to top — verified: Ohio chip click rendered
      Columbus / 11,799,448 / 1803 / Buckeye State (logged).
- [x] Works fully offline — verified: all http(s) requests aborted via route interception,
      page reloaded, boot card rendered and a fresh Kenya lookup succeeded (screenshot
      offline-stale.png; log lines 17–21).
- [x] Theme toggle persists to suite.theme — harness probe: light -> dark, aria-pressed=true.
- [x] Footer provenance note — present verbatim.

## changes beyond the recipe

- `.card` tool-local override adds `display:block; flex-direction:row; gap:normal` — core's
  `.card` is a flex column; v1 factbook cards are plain blocks (same fix as convert/currency/
  color/dates/emergency/illness). Also keeps v1's padding/margin-top.
- `.search` tool-local `padding:.75rem 1rem` (v1 is a touch taller than core's `.7rem`).
- `footer` tool-local `margin-top:2.6rem; font-size:.83rem; padding-top:1rem` (v1 differs from
  core's 3rem/.85rem/1.1rem).
- `.topbar .theme-btn { float:none }` — core floats the button; v1's sits in the flex topbar
  (same fix as currency).
- v1's local `esc()` (div/textContent trick — escapes `& < >` but **not quotes**) replaced by
  `const esc = Suite.esc` (escapes `& < > " '`). Strictly safer: v1 used `esc()` inside a
  double-quoted attribute (`data-name="..."` on state chips) where an embedded `"` would have
  broken out. No dataset value contains quotes, so rendering is unchanged; `dataset.name`
  round-trips through entity decoding, so chip lookup still matches.
- Tab buttons got a small `paintTabs()` helper to also maintain `aria-pressed` (v1 toggled only
  classes); class behavior identical.

## localStorage keys

| key | v1 | v2 |
|---|---|---|
| `suite.theme` | written by the theme toggle | same (via core `Suite.theme`) |

No other key is read or written by either version. Parity snapshot: `keysOnlyInV1` and
`keysOnlyInV2` both empty.

## escape allowlist requests

All data is embedded local constants (no remote data exists in this tool), and v1's escaping
discipline was kept anyway (every string field goes through `esc` = `Suite.esc`). The
interpolations *not* wrapped in `Suite.esc(` — all string concatenation, not template literals,
so the `--check` heuristic should not fire — are:

- `flagEmoji(c.code)` (renderCountry, updateSuggest) — returns either the literal `"🏳️"` or two
  regional-indicator codepoints from `String.fromCodePoint`; cannot contain HTML metacharacters.
- `fmtNum(c.pop)`, `fmtNum(s.pop)` (country card, state card, state chips) — `"—"` or
  `Number.prototype.toLocaleString("en-US")` of a `parseInt` result; digits and commas only.
- `'"'+i+'"'` … `'<button data-i="'+i+'">'` (updateSuggest) — `i` is the `Array.map` index, an
  integer.

Note for the Phase 4 EA pass: QUALITY.md §1.3 says "1 esc call in v1", but the v1 file as shipped
defines `esc()` and uses it at ~20 call sites covering every string interpolation. The audit
count appears stale against the shipped v1; the real v1 gap was the quote-blind `esc()`
implementation in attribute context, which this migration closes via `Suite.esc`.

## a11y applied

- `aria-label="Search a country"` on `#q`, `aria-label="Search a US state"` on `#qs`
  (placeholder-only inputs in v1).
- `Suite.liveRegion()` on `#countryCard` and `#stateCard` (result containers updated after user
  actions).
- Escape now closes the suggestion overlay (checklist: "Esc closes overlays"; v1 only closed on
  outside-click). Exercised in the interaction log.
- `aria-pressed` on the two tab buttons, kept in sync on switch.
- Keyboard paths already existed in v1 and are preserved: suggestion arrows/Enter, real
  `<button>` state chips, Enter-picks-first-suggestion.
- Theme button `aria-label` + `aria-pressed` come from core `Suite.theme.init()`.
- Flag `role="img"` + `aria-label` was already in v1 (its one strong a11y feature) — kept.

## endpoints

None. The tool contacts no external host (verified by code read + full-abort offline run).
CATALOG.md §7.5 describes restcountries.com + api.census.gov for this tool and the rate table
lists both hosts — that section describes the unbuilt plan, not the shipped tool; the
orchestrator may want to annotate CATALOG rather than have `--check`'s CATALOG cross-check
expect these hosts on factbook's (empty) endpoint list.

## concerns for the reviewer

1. **Manifest deviates from the instructions on purpose** (`network`, `endpoints`,
   `cacheTtlMin` — see headline section). If the orchestrator instead wants the tool upgraded to
   live restcountries/Census data per CATALOG §7.5, that's new feature work beyond
   migration parity and should be scheduled deliberately (it would also need the stale-card UX,
   TTL 10080, and CSP hosts this report intentionally omits).
2. The country populations are a static "approx. 2023" snapshot and state data is the 2020
   Census — they will age. v1 accepted this (footer says so); nothing changed.
3. `drawStateGrid` re-renders all 50 chips and re-binds listeners on every keystroke — v1
   behavior, kept as-is (fast enough at n=50).
4. Emoji flags render as letter pairs on Windows (no color flag glyphs in Segoe UI Emoji for
   region sequences in Chrome) — identical in v1; not a regression, but worth knowing when
   comparing against the CATALOG's "flags" promise.
5. MIGRATION.md's burn-down row for factbook (Net column `cors`) will be wrong once this lands
   as offline — orchestrator updates the table in the migration commit (I may not touch
   MIGRATION.md).

## Phase 4 escaping audit (line-by-line)

Audited 2026-07-16 against `tools/factbook.html` (zero-network tool: both datasets are embedded
constants; there is no remote provenance anywhere). `esc` is `Suite.esc` (escapes `& < > " '`,
so it is attribute-safe in double- and single-quoted contexts).

### Complete dynamic-markup site inventory

Sinks present: `innerHTML` only (7 assignments). No `outerHTML`, `insertAdjacentHTML`,
`document.write`, and no `href`/`src`/`style`/`title` attribute built from data — the only
`setAttribute` calls write `aria-pressed` from `String(boolean)`. User input (`#q`, `#qs`
values) is never interpolated into markup: it is used only for array filtering and `.value`
assignment (`pick()`).

| # | location (line) | sink | interpolated expression | provenance | verdict |
|---|---|---|---|---|---|
| 1 | renderCountry (~324) | `countryCard.innerHTML`, `aria-label="..."` attr | `esc(c.name)` | embedded constant | esc'd correctly (quote-safe) |
| 2 | renderCountry (~324) | text | `flagEmoji(c.code)` | embedded constant | provably safe (see proof below) |
| 3 | renderCountry (~325) | text (`<h2>`) | `esc(c.name)` | embedded constant | esc'd correctly |
| 4 | renderCountry (~326) | text (`.official`) | `esc(c.region)`, `esc(c.code)` | embedded constant | esc'd correctly |
| 5 | renderCountry (~329) | text (Capital fact) | `esc(c.capital)` | embedded constant | esc'd correctly |
| 6 | renderCountry (~330) | text (Population fact) | `fmtNum(c.pop)` | `parseInt` of embedded constant | provably safe: `"—"` or `toLocaleString("en-US")` (digits/commas only) |
| 7 | renderCountry (~331–333) | text (facts) | `esc(c.currency)`, `esc(c.languages)`, `esc(c.region)` | embedded constant | esc'd correctly |
| 8 | updateSuggest (~342) | `suggestEl.innerHTML = ""` | none | — | constant |
| 9 | updateSuggest (~346) | `suggestEl.innerHTML` ("No match" row) | none | — | constant |
| 10 | updateSuggest (~348) | `data-i="..."` attr | `i` | `Array.prototype.map` index | provably safe (integer) |
| 11 | updateSuggest (~348) | text (button label) | `flagEmoji(c.code)`, `esc(c.name)` | embedded constant | provably safe / esc'd correctly |
| 12 | renderStateCard (~442–448) | `stateCard.innerHTML`, text | `esc(s.name)`, `esc(s.abbr)`, `esc(s.nickname)` (x2), `esc(s.capital)`, `esc(s.admitted)` | embedded constant | esc'd correctly |
| 13 | renderStateCard (~446) | text (Population fact) | `fmtNum(s.pop)` | `parseInt` of embedded constant | provably safe |
| 14 | drawStateGrid (~457) | `stateGrid.innerHTML`, `data-name="..."` attr | `esc(s.name)` | embedded constant | esc'd correctly — `Suite.esc` escapes `"`, closing v1's quote-blind gap; `dataset.name` entity-decodes back to the raw string, so the chip-click lookup still matches (probe-proven) |
| 15 | drawStateGrid (~457) | text (chip label + pop) | `esc(s.name)`, `fmtNum(s.pop)` | embedded constant | esc'd correctly / provably safe |
| 16 | qs input handler (~471) | `stateCard.innerHTML = ""` | none | — | constant |

`flagEmoji` proof: for any 2-char input the output codepoints are `0x1F1E6 + charCodeAt(i) - 65`
with `charCodeAt` in `[0, 0xFFFF]`, i.e. every output codepoint lies in `[U+1F1A5, U+2F1A4]` —
always astral-plane, never an ASCII metacharacter; non-2-char input returns the constant
white-flag emoji. Confirmed empirically with the hostile code `"<` (rendered U+1F1C7 U+1F1E1).

### Fixes made

None required — zero UNSAFE sites. Every interpolation is `Suite.esc()`-wrapped, a map-index
integer, `fmtNum` output, or `flagEmoji` output. No behavior changed in the tool; the tool file
was not modified by this audit.

### Adversarial probe (added to tests/interactions/factbook.mjs)

The tool has no network data source to route-fulfil, so the probe injects hostile rows into the
embedded `COUNTRIES`/`STATES` arrays in-page (top-level lexical bindings, reachable from
`page.evaluate`) and drives the REAL render paths: `updateSuggest -> pick -> renderCountry` and
`drawStateGrid -> chip click -> renderStateCard`. Payloads cover `<img onerror>`, `<svg onload>`,
`"><script>`, `"><iframe src=javascript:>`, single-quote/double-quote attribute breakouts,
`javascript:` strings in URL-ish fields, and a hostile 2-char ISO2 code through `flagEmoji`.

Evidence (interaction.txt lines 22–27): suggest dropdown 0 injected elements, payload as literal
text; country card `__xss=undefined`, 0 `script/img/svg/iframe/a` elements, name literal in
`<h2>`, flag `aria-label` attribute intact, hostile-ISO2 flag astral-only, NaN pop renders "—";
state chip attributes exactly `[class, data-name]` with 0 `on*` attributes and `dataset.name`
round-tripping to the raw string (chip-click lookup then found the hostile row — the card
rendered from it); state card `__xss=undefined`, 0 injected elements, nickname literal, 0
`javascript:` hrefs in the whole document. The probe throws (failing the harness) on any
violation. Post-interaction screenshot `v2-after-interaction.png` shows the hostile state card
rendered as inert text.

### Harness

`node verify-tool.mjs factbook` — exit 0, console clean (no errors). Note: at audit start
`tests/verify-tool.mjs` itself had a syntax error (line 98's string literal contained a raw
newline instead of `\n`), which made the harness fail to parse for every tool; reported to the
orchestrator, fixed centrally, then the real harness was re-run green.

### Allowlist status

`tests/escape-allowlist.json` contains NO factbook entries — correct, and none are needed: all
dynamic sites use string concatenation with `esc()`/provably-safe values, so the `--check`
template-literal heuristic has nothing to flag. The three unescaped expression classes the
migration report pre-declared (`flagEmoji(code)`, `fmtNum(pop)`, the `data-i` map index) are
confirmed safe by construction and by the probe. No previously-allowlisted expression exists,
so none needed revision.

## Phase 4 a11y audit

Re-verified 2026-07-16 against QUALITY.md §2 (Phase 4 audit addendum). Full runtime log in
`a11y-phase4.txt` (harness: `tests/a11y-phase4-batch.mjs`; the tool is zero-network).

| # | Checklist item | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | icon-only controls named | n-a | no icon-only buttons or links; the flag emoji is `role=img` with `aria-label="Flag of <country>"` |
| 2 | aria-live on async containers | pass | runtime `aria-live=polite` on #countryCard, #stateCard (grid filter feeds the announced card) |
| 3 | keyboard path | pass | country lookup keyboard-only (type → ArrowDown → Enter); Esc closes the suggest overlay; states tab, state search, and `.schip` grid picks (real `<button>`s) all Tab+Enter operable; no positive tabindex |
| 4 | input labels | pass | #q and #qs both carry `aria-label` |
| 5 | contrast, both palettes | fixed | see below — 2 tool-local failures fixed, 1 suite flag |
| 6 | focus visibility | pass | 8/8 tabbed elements show the core 2px accent outline |

Contrast measurements:
- FIXED (real bug): `.schip` set no `color`, so the `<button>` text stayed UA-default black —
  20.67:1 light but **1.29:1 in dark** (black on the #1d2026 card). Now `color: var(--ink)`.
- FIXED: `.tab.on` was `#fff` on `var(--accent)` — **2.36:1 dark**. Now `color: var(--bg)`
  (5.26:1 light / 7.60:1 dark).
- SUITE FLAG (not fixed locally): `--muted` on `--bg` = **4.36:1 light** (footer). Dark passes.
- Passing spot-checks: `.pop` muted-on-card 4.76, `.v.big` accent 5.74/6.91 (large text).

Fixes made: the two CSS changes above (tools/factbook.html only; embedded datasets untouched).
Harness after fix: `node verify-tool.mjs factbook` → exit 0 (offline reload + escape probes inert).
