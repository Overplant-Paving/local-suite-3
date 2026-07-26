# settings.html — evidence report (Phase 4 item 1: born in v2, no v1 original)

## spec walk-through (substitutes the v1 feature walk-through)

Every feature from the ROADMAP Phase 4 item-1 spec, each verified — HOW is the harness run
(`node verify-tool.mjs settings`, exit 0; log lines cited from `interaction.txt`):

- [x] **Suite-wide backup** — "Create backup" snapshots every `suite.*` key into a
  `local-suite.backup.v2` JSON envelope (format, ISO timestamp, key count, raw values).
  Verified: envelope parsed from the UI textarea; all 9 seeded keys present and
  **byte-identical to live localStorage** ("envelope.data verbatim … all byte-identical",
  interaction.txt:12); real download event observed with filename
  `local-suite-backup-2026-07-16.json` (:14); exported JSON archived as `backup-export.json`.
- [x] **Round trip: export → wipe a scratch profile → import → all suite.* keys identical** —
  the headline, no shortcut. Seed spanned every value class: a fake API key, a location, two
  `suite.cache.*` envelopes, the theme, a bare v1-style string (`"F"`), multi-byte unicode,
  and **non-canonical JSON spacing that a parse→re-stringify would destroy**. After wipe +
  reload + paste-restore: **9/9 keys byte-identical, 0 mismatched, 0 extra** — per-key
  verdicts logged (interaction.txt:23–32). Caveat logged honestly: after the wipe the
  harness's own addInitScript re-seeds `suite.theme=light` on reload (:15–17); its restored
  value is byte-identical to the seeded one, so coverage is not reduced.
- [x] **Restore writes only suite.* keys, verbatim** — tamper payload with `evil.key`,
  `localStorageBomb`, and a non-string `suite.bad.nonstring: 42`: all three skipped (null in
  storage), only `suite.tamper.ok` written; UI reports "1 restored · 3 skipped" (:33–34).
  Guards also exercised: empty textarea, invalid JSON, wrong `format` (:19–21).
  Writes go through `Suite.store.set` and are **read back** — a quota/denied write can never
  be miscounted as restored.
- [x] **Key manager** — one row per registry name (nasa, congress, eia, nps, finnhub, ebird,
  usda, bart). Set (Enter submits), masked-by-default (`type=password`), reveal toggle
  (aria-pressed + label flips Show/Hide, value visible), clear → **demo fallback via
  `Suite.key(name).isDemo`**: nasa shows the DEMO_KEY nudge after clear (:43), bart shows its
  published public key (:44), eia shows the honest no-demo state (:45). Empty-save guard (:42).
- [x] **Relay config + live test** — shows/sets/clears `suite.relay.url`; save message and the
  test both surface the rewritten `?url=` probe. Success pipeline verified by
  **route-fulfilment**: the intercepted request URL decodes to exactly
  `https://example.org/probe` (:51–53, `relay-success.png`). Failure/blocked state verified by
  **route-abort**: the designed explanation renders — names the dist CSP, says blocked *by
  design* (CSP not weakened), and that the URL stays saved (:54–55, `relay-blocked.png`).
- [x] **Theme** — segmented Light/Dark/Follow-system over the `suite.theme` convention:
  dark sets key+attribute, system **removes** the key and attribute, light restores (:57–60);
  the corner `Suite.theme` toggle stays in sync via a repaint listener (visible in
  `v2-after-interaction.png`: the harness's own toggle probe flipped to dark and the segmented
  control followed).
- [x] **Location** — shows/edits/clears `suite.location` via `Suite.location` mechanics;
  range validation (−90…90 / −180…180) rejects bad input; save via Enter writes the exact
  `{lat, lon, label}` JSON; clear removes the key (:61–64).
- [x] **Storage viewer** — table of every `suite.*` key with UTF-8 byte size (`Blob.size` —
  the 40 B multi-byte row proves bytes, not chars, :9), truncated preview via `textContent`,
  and per-key delete with `aria-label="Delete <key>"` (:65–66). Viewer key set asserted equal
  to live localStorage (:6–7); empty state + summary line verified on the wiped profile (:18).
- [x] **Cache purge** — deletes exactly `suite.cache.*` with count feedback: seeded 2, purged
  2, 6/6 non-cache keys intact, idempotent second purge reports none left (:67–71).
- [x] **file://↔hosted bridge (PWA.md §5)** — stated in the backup card copy verbatim
  ("the sanctioned bridge between the double-click (file://) copy and a hosted copy…").
- [x] **"Includes your saved API keys"** — stated in both the card copy and the post-export
  message ("It includes your saved API keys — treat it like a password", :10).

## changes beyond the recipe

New tool — the recipe's strip-list has nothing to strip; built directly on core
(`suite.css` link + `suite.js` script with `data-suite-inline`, `Suite.theme.init()` first,
3-layer tool-accent variables `--ok`/`--err` like focus/gas). Deliberate deviations, all
argued in-file:

- **Raw localStorage READS** (`rawGet`, `suiteKeys`) instead of `Suite.store.get`: enumeration
  isn't in the store API, and byte-verbatim export must not round-trip values through
  JSON.parse→stringify (the `suite.roundtrip.spacing` seed exists to prove why). All WRITES
  and deletes go through `Suite.store` (bare-string contract = verbatim, namespace enforced).
  Comment block in the source explains this.
- The relay test uses plain `fetch` with a 10 s AbortController, not `Suite.fetchJSON`: a
  relay probe response need not be JSON, must never be cached, and its failure is a designed
  UI state, not a stale-cache case.

## localStorage keys

No v1 counterpart. The tool **owns no keys of its own** — it reads/writes the whole `suite.*`
namespace by design (manifest storage: `suite.* (reads/writes all suite keys by design)`).
Keys it can write, always at the user's explicit action: any `suite.*` key from a restore
(verbatim), `suite.key.<name>` (registry names only), `suite.relay.url`, `suite.theme`,
`suite.location` — and it deletes any `suite.*` key (viewer), `suite.cache.*` (purge),
`suite.theme` (follow-system), and the key/relay/location keys via their Clear buttons.
`localstorage.json` shows the harness end-state (post-purge survivors).

## escape allowlist requests

none — zero `innerHTML` in the tool; all dynamic DOM is `createElement`/`textContent`
(including the storage-value previews, which render arbitrary stored bytes safely).

## a11y applied (QUALITY.md §2)

- `Suite.liveRegion()` on all seven async/result areas: backupMsg, restoreMsg, keysMsg,
  relayMsg, themeMsg, locMsg, storageMsg (asserted in-run, interaction.txt:72).
- Every input/textarea has a `<label for>` or `aria-label` — asserted in-run: zero unlabeled
  (:73). Icon-only buttons all labeled (:74): reveal buttons `Show/Hide <name> API key` with
  `aria-pressed`, delete buttons `Delete <key>`; Save/Clear buttons carry per-key labels too.
- Enter submits everywhere a text-entry+button pair exists: key inputs, relay URL, all three
  location fields (exercised: nasa key and location saved via Enter).
- Keyboard path for every mouse path (all controls are real `<button>`s/inputs; core
  `:focus-visible` outline applies). No overlays exist, so no Esc path is needed (:75).
- Theme segmented control is a `role="group"` with `aria-labelledby` and `aria-pressed`
  states; the storage table uses `th scope="col"` with an sr-only Actions header.

## endpoints

**Superseded 2026-07-25 by `keysetup/report.md`** — guided key setup added a live per-key check, so
the manifest entry is now `network:"keyed"` with nine provider hosts, and the tool makes one
request per Test/Save-and-check click and none otherwise. Everything below still describes the
relay path and remains accurate for it.

None (manifest `network:"offline"`, `endpoints:[]`). The only fetch the tool can ever make is
the user-initiated relay test to the user's own configured base URL — which the dist CSP
intentionally blocks for arbitrary hosts; the tool's failure state explains exactly that and
the copy says the suite does not weaken the policy. In the harness run, no request left the
machine (success route-fulfilled, failure route-aborted).

## concerns for the reviewer

- **Manifest tension, flagged not hidden:** `network:"offline"` + `endpoints:[]` is
  orchestrator-ruled, yet the relay test is a real fetch. Consequence: from dist the test can
  only ever demonstrate the designed *blocked* explanation (connect-src won't include the
  relay host). The UI copy states this before the user ever clicks Test. If smoke's
  network-tool offline check keys off the manifest, settings is classed offline — correct,
  since the page renders fully with no network.
- **Suite.store's memory fallback is invisible here:** when localStorage itself is denied,
  `Suite.store` falls back to an in-page Map, but this tool's enumeration/export can't see
  that Map (no core API exposes it). Handled honestly: the summary line then reads
  "localStorage is unavailable in this browser mode — settings won't persist" rather than
  showing a misleading empty-but-working state. A future `Suite.store.keys()` would close
  this gap; not added — core changes are out of scope for a tool migration.
- **Round-trip wipe caveat:** the harness's `addInitScript` re-seeds `suite.theme` on the
  post-wipe reload (logged in-run). The wiped-profile screenshot therefore shows 1 key, not
  0. Restore still overwrites it from the backup and the byte-compare covers it; a truly
  empty profile differs only by that one key.
- **Per-key delete has no confirm step.** Matches v1 suite conventions (v1 tools clear state
  without confirmation) and the storage card copy warns what deletion means, but a reviewer
  may want a confirm for non-cache keys. Purge is scoped to `suite.cache.*` only, which is
  always safe.
- **Expected console line:** the route-aborted relay test logs one
  `Failed to load resource: net::ERR_FAILED` (visible in interaction.txt) — the designed
  failure path; the harness's hard-issue filter excludes `net::ERR` lines and exited 0.
- The harness `Write` hook flagged in HANDOFF.md fired only as a Browser-pane notice for this
  session; report.md was still written via scratchpad + shell copy per the standing gotcha.
- `zoom-storage-card-dark.png` is a supplementary element capture taken to rule out a
  rendering artifact that turned out to be full-page-screenshot downscaling moiré; the DOM
  cell contains exactly one labeled `×` button.

## Phase 4 a11y audit (2026-07-16)

Independent re-verification of the QUALITY.md §2 checklist, executed in the running tool
(Playwright/Chrome from file://, light + dark, keyboard-only drive of the primary feature,
contrast computed from getComputedStyle with ancestor alpha-compositing).

| # | Checklist item | Verdict | Evidence |
|---|---|---|---|
| 1 | icon-only controls have accessible names | pass | unnamed: (none) |
| 2 | async/result regions carry aria-live | pass | runtime check below |
| 3 | keyboard path for every mouse path | pass | keyboard-only drive log below; no positive tabindex ((none)); no traps |
| 4 | inputs labelled | pass | unlabelled: (none) (labelled: 14) |
| 5 | contrast, both palettes | fixed (see below); remaining FAILs are the suite-wide --muted flags | full pair tables below |
| 6 | visible focus indicator | pass | light: all stops show an indicator; dark: all stops show an indicator |

### Contrast — light
```
contrast pairs (10 unique fg/bg combos):
  FAIL 4.1 (need 4.5) fg=#6b7280 bg=#efece4 12px/400 — code "suite.cache.*"
  FAIL 4.36 (need 4.5) fg=#6b7280 bg=#f5f3ee 13.6px/400 — footer "No network of its own — the rela"
  pass 4.76 (need 4.5) fg=#6b7280 bg=#fffdf9 12.2px/400 — td.preview "light"
  pass 4.93 (need 4.5) fg=#3a7d44 bg=#fffdf9 12.8px/400 — div.kstatus.good "your key is saved on this machin"
  pass 5.26 (need 4.5) fg=#2f6f6a bg=#f5f3ee 14.4px/400 — a.back "← suite"
  pass 5.26 (need 4.5) fg=#f5f3ee bg=#2f6f6a 14.4px/600 — button#locSaveBtn.btn "Save location"
  pass 5.77 (need 4.5) fg=#b23b3b bg=#fffdf9 14.4px/600 — button#purgeBtn.btn.danger "Purge cached data"
  pass 12.58 (need 4.5) fg=#23282e bg=#efece4 11.4px/400 — code "suite.theme"
  pass 13.39 (need 3) fg=#23282e bg=#f5f3ee 27.2px/700 — h1 "Suite Settings"
  pass 14.61 (need 4.5) fg=#23282e bg=#fffdf9 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#exportBtn.btn [outline] -> textarea#backupText [accent-border] -> textarea#restoreText [accent-border] -> button#restoreBtn.btn [outline] -> button#restoreFileBtn.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline]
```

### Contrast — dark
```
contrast pairs (10 unique fg/bg combos):
  pass 5.31 (need 4.5) fg=#e0736b bg=#1d2026 14.4px/600 — button#purgeBtn.btn.danger "Purge cached data"
  pass 5.47 (need 4.5) fg=#9aa0a8 bg=#262a31 12px/400 — code "suite.cache.*"
  pass 6.19 (need 4.5) fg=#9aa0a8 bg=#1d2026 14.1px/400 — p.note "One JSON snapshot of every"
  pass 6.81 (need 4.5) fg=#9aa0a8 bg=#15171b 13.6px/400 — footer "No network of its own — the rela"
  pass 7.6 (need 4.5) fg=#6fb5ae bg=#15171b 14.4px/400 — a.back "← suite"
  pass 7.6 (need 4.5) fg=#15171b bg=#6fb5ae 14.4px/600 — button#exportBtn.btn "Create backup"
  pass 7.86 (need 4.5) fg=#7dc487 bg=#1d2026 12.8px/400 — div.kstatus.good "your key is saved on this machin"
  pass 11.44 (need 4.5) fg=#e7e5e0 bg=#262a31 11.4px/400 — code "suite.cache.demo.one"
  pass 12.96 (need 4.5) fg=#e7e5e0 bg=#1d2026 13.6px/400 — button#themeBtn.theme-btn "◐ theme"
  pass 14.25 (need 3) fg=#e7e5e0 bg=#15171b 27.2px/700 — h1 "Suite Settings"
focus visibility (25-Tab walk): all stops show an indicator
  tab order: a.back [outline] -> button#themeBtn.theme-btn [outline] -> button#exportBtn.btn [outline] -> textarea#backupText [accent-border] -> textarea#restoreText [accent-border] -> button#restoreBtn.btn [outline] -> button#restoreFileBtn.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline] -> button.btn [outline] -> button.btn [outline] -> input [accent-border] -> button.btn [outline]
```

### Keyboard-only drive + live regions
```
### keyboard-only primary-feature drive
  Tab -> reached Export button (BUTTON#exportBtn after 3 tab(s))
  Enter on Export -> backup JSON in textarea, msg "Backup of 3 key(s) created (250 B). It includes your saved API keys — treat it like a password."
  Tab -> reached NASA key input (INPUT after 7 tab(s))
  typed key + Enter -> saved; msg "NASA key saved."
  Tab -> reached NASA reveal toggle (BUTTON after 1 tab(s))
  Enter on reveal -> aria-pressed=true
  Tab -> reached theme seg Dark (BUTTON after 36 tab(s))
  Enter on Dark -> data-theme=dark

### aria-live runtime check
  #backupMsg: aria-live=polite
  #restoreMsg: aria-live=polite
  #keysMsg: aria-live=polite
  #relayMsg: aria-live=polite
  #themeMsg: aria-live=polite
  #locMsg: aria-live=polite
  #storageMsg: aria-live=polite
```

### Fixes made (tool-local CSS, all four theme contexts)
- `.btn` and `.seg button[aria-pressed="true"]` text `#fff` -> `var(--bg)`: white on the dark-theme accent was 2.36:1; now 5.26:1 light / 7.60:1 dark. (This is the independent re-verification of the freshly-built settings.html: everything else on the QUALITY.md checklist passed as built.)

### Notes
- Focus note: text inputs/textareas suppress the core outline but flip their border to the accent on focus (`textarea:focus, input:focus { outline:none; border-color:var(--accent) }`) — the suite's own core `.search` pattern; counted as a visible indicator ([accent-border] in the walk).

### Suite-wide contrast flags (REPORTED, not fixed locally — core palette)

The light palette's `--muted` (#6b7280) misses WCAG AA 4.5:1 on two core surfaces
(it passes on `--card` at 4.76, and the dark palette passes everywhere, 5.5-6.8):

| pair | ratio | where it shows in this tool set |
|---|---|---|
| `--muted` on `--bg` #f5f3ee | **4.36** | core `footer` rule; tool taglines/hints/stamps on the page background (every tool) |
| `--muted` on `--chip` #efece4 | **4.10** | core `.chip`; tool-local chip-bg recreations (jobs #dataStamp, markets .caveat, settings/transit/passes `code`, airport chips, hub chips) |
| `--muted` on `--accent-soft` #e3efed | **4.11** | parks `.code` chip inside picker rows |

Root cause is the palette value, not any one tool: per the audit addendum these are
suite-wide failures — fixing them tool-by-tool would fork the palette across 71 files.
Suggested one-line core remedy (NOT applied): darken light `--muted` to ~#5f6670
(-> 5.23 on --bg, 4.91 on --chip, 5.71 on --card). Decision belongs to core.

### Harness re-runs
- `node verify-tool.mjs settings` re-run after the modification: exit 0, evidence refreshed (2026-07-16). Computed-style diffs vs v1 now include the documented a11y color deltas.
