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
