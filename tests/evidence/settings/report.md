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
