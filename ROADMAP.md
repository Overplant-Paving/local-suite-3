# ROADMAP.md — phased execution plan

**Developer: Claude (Fable 5 or later), operating agentically in Claude Code.** Phases are ordered
by dependency and risk isolation, not by human effort — there are no time estimates because none
are meaningful. Each phase defines entry conditions, the work, and **hard exit gates**: a phase is
not done until every gate passes with evidence (command output, screenshots, live-fetch results),
and no gate is skippable by judgment call. Specs live in [ARCHITECTURE.md](ARCHITECTURE.md); the
per-tool playbook and burn-down table live in [MIGRATION.md](MIGRATION.md); the quality bar is
[QUALITY.md](QUALITY.md) — read all three before executing any phase.

Standing rules for the executing agent:

1. **Nothing ships unverified.** "It should work" is not a state. Every tool gets opened, exercised,
   and screenshot-compared before its box is ticked.
2. **Parallelize the independent; serialize the risky.** Tool migrations fan out to subagents in
   batches; core/`build.py` changes are single-threaded and land before anything that depends on them.
3. **The gates are the authority.** If `build.py --check` and this roadmap disagree, fix the
   disagreement before proceeding — never route around a failing gate.
4. **v1 is the reference implementation.** Every migrated tool is diffed against its v1 original
   (`v1-import` tag) for behavior and design parity.
5. **Update the burn-down table and this status block in the same commit as the work.**

## Current status

- [x] Analysis of v1 complete (architecture + quality/risk audits, July 2026)
- [x] Planning document set written
- [x] Version-control hazard fixed (home-dir `.git` removed; v1 suite committed as `7088cab` on `main` in `../Local Suite`)
- [x] Phase 0 — Foundation (2026-07-15 — evidence: `tests/evidence/phase0/gates.txt`)
- [x] Phase 1 — Core machinery, proven on pilots (2026-07-15 — 3 pilots at Definition of Done; CSP verdict: full hashes, all 3 browsers, recorded in ARCHITECTURE D6 addendum; evidence: `tests/evidence/{focus,weather,index,phase1}/`)
- [ ] Phase 2 — Full migration: 71/71 migrated 2026-07-16, all gates green, smoke 72/72
  (`tests/evidence/batchC/gates.txt`, `tests/evidence/batchD/gates.txt`; Batch D byte-exact
  hashes proven v1==source==dist per tool). **One exit item open:** the v1 read-only-archive
  README commit in `../Local Suite` — the session's permission settings deny writes there;
  needs the user (text drafted, see HANDOFF.md). Tick this box when it lands.
- [ ] Phase 3 — PWA machinery done 2026-07-16 (sw.js + webmanifest + icons emitted, pwa-sync
  fatal gate, file:// parity + offline matrix + update path + Firefox no-op all verified —
  `tests/evidence/phase3/`). **GitHub half done 2026-07-16:**
  repo `Overplant-Paving/local-suite-2` (public), Pages workflow publishing `dist/` —
  live at <https://overplant-paving.github.io/local-suite-2/>, fresh-profile verified
  (72 links, SW precached, click-through, zero errors — `tests/evidence/phase3/pages-live-verify.txt`).
  Remaining: one headed Chrome/Edge install-prompt check (needs a human's browser).
- [ ] Phase 4 — Suite-wide audit DONE 2026-07-16 (settings.html at DoD; escaping audit: 5 EA
  files + extras, 3 real fixes; a11y audit: all 73 files, 6 agents, ~60 tools fixed, core
  ruling D10; games parked as designed hub card; gates zero-warning green, smoke 73/73 —
  `tests/evidence/phase4/`). **Tag `v2.0` HELD on the two user items** (v1 archive README,
  Phase 3 GitHub half) — see `tests/evidence/phase4/release-checklist.md`. Tick with the tag.

## Overview

| Phase | Goal | Hard exit gate |
|---|---|---|
| 0 | Repo + skeleton | `--check` green on empty manifest; toplevel verifies; v1 imported as reference tag |
| 1 | Core + generator proven end-to-end | 3 pilots pass the full per-tool Definition of Done, incl. CSP verdict across 3 browsers |
| 2 | All 71 tools migrated | 71/71 pass Definition of Done; zero placeholder URLs; parity evidence archived |
| 3 | PWA + GitHub sharing | repo on GitHub, Pages link works from a fresh profile; installed PWA verified offline; file:// byte-identical |
| 4 | Suite-wide audit | every QUALITY.md checklist passes with evidence; smoke suite green on all 72 files; tag `v2.0` |

---

## Phase 0 — Foundation

**Goal:** a correct repository and a skeleton that builds.

Context: the original hazard (empty `.git` stubs resolving to an accidental home-directory repo)
was fixed on 2026-07-15 — v1 now lives in a real repo at `../Local Suite` (`main`, commit
`7088cab`). This phase sets up **this** folder.

Work:
1. `git init -b main` in `Local Suite 2`. **Gate:** `git rev-parse --show-toplevel` prints this
   folder. Add `.gitignore` (OS junk, `tests/node_modules/`).
2. Import v1 as the reference baseline: `git fetch ../Local\ Suite main` → tag it `v1-import`.
   Every migration diff in Phase 2 is reviewed against this tag.
3. Commit the planning docs.
4. Skeleton: `build.py` (arg parsing, all gate stubs failing loudly as "not implemented" rather
   than passing vacuously), `core/suite.css` + `core/suite.js` (empty), `manifest/tools.json`
   (`schemaVersion: 2`, empty `tools`), `tools/`, `dist/`, `tests/`.

**Exit gates:** toplevel correct · `v1-import` tag resolves and contains all 175 v1 files ·
`python build.py --check` runs and reports its own unimplemented gates explicitly · all committed.

---

## Phase 1 — Core machinery, proven on pilots

**Goal:** every piece of shared machinery implemented and proven on three real tools **before**
the 71-tool fan-out. This phase is deliberately serialized — it is the foundation everything else
builds on, and quality here multiplies across every later file.

Work:
1. **`core/suite.css`** — extract from the byte-identical v1 theme block (canonical:
   `weather.html:8–70` at `v1-import`) + reset + font stack + shared chrome + focus-visible +
   `prefers-reduced-motion`. Verify extraction correctness by diffing rendered computed styles of
   a pilot against its v1 original in both themes, not by eyeballing.
2. **`core/suite.js`** — the complete `Suite` namespace per ARCHITECTURE.md §3. Every public
   function gets exercised by at least one pilot; no dead API surface ships.
3. **`build.py`** — complete: inlining, hub marker injection, every `--check` gate implemented
   (no stubs remain), `--new`, `--serve`. The escaping heuristic and all fatal gates get negative
   tests: deliberately broken fixture inputs that must fail the check (see QUALITY.md §3).
4. **Pilots** (full [MIGRATION.md](MIGRATION.md) recipe + Definition of Done each):
   - `focus.html` — offline, storage-heavy; **includes adding its missing export/import** (the
     known data-loss risk; fixed at first touch, not deferred).
   - `weather.html` — canonical fetcher; proves `Suite.fetchJSON` against live NWS, including the
     stale-cache offline path (verified by exercising it, e.g. blocking the network).
   - `index.html` — the hub; proves manifest-driven generation with a 3-entry manifest.
5. **CSP verdict** — the generated hash-based CSP tested on all three pilots in Chrome, Edge, and
   Firefox **from `file://`**. Record the verdict (full hashes / per-file fallback) as an
   addendum to ADR D6 in ARCHITECTURE.md. This decision blocks Phase 2's template.

**Exit gates:** 3 pilots pass the per-tool Definition of Done (QUALITY.md §4) with parity evidence ·
`--check` fully implemented with negative tests passing · CSP verdict recorded · `Suite` API 100%
exercised by pilots.

---

## Phase 2 — Full migration, parallel batches

**Goal:** all 71 tools through the recipe at pilot quality. Batches group by risk class so that a
shared defect surfaces in the first batch of its class, not the last; **within a batch, tools are
independent and migrate in parallel** (fan out to subagents; one tool = one subagent task = one
reviewed commit).

- **Batch A — zero-network (21 tools).** Simplest class; validates the recipe at scale before the
  fetch-dependent classes. Full interaction verification per tool (offline tools have no "it
  fetched, good enough" shortcut — exercise the actual feature: generate the password, run the
  timer, draw the QR).
- **Batch B — CORS-open fetchers (33 tools).** Every fetch converges on `Suite.fetchJSON`. Per
  tool: one **live** fetch verified + the stale-cache offline path verified. `cacheTtlMin`
  declared per source class (API-AND-RELAY.md §2).
- **Batch C — keyed, CORS-blocked, rate-limited (12 tools).** `Suite.key()` for apod, nutrition,
  congress, gas, parks, markets (live-verified with demo keys where a demo tier exists; with a
  real key where the user has one; otherwise the no-key UX path is what gets verified — it must
  be a designed state, not an error state). The 4 formerly-broken tools get their simple fixes
  (API-AND-RELAY.md §5): jobs + inflation embed monthly BLS numbers via `--refresh-data`;
  airport + custom transit get link-out cards (**embedded data and link-out cards are first-class
  UI states, verified like any feature**). BART key externalized (v1 `transit.html:163` →
  `suite.key.bart`).
  Rate-limited feeds (launches, markets, nearby, apod) get TTL + backoff, verified by simulating
  a 429.
- **Batch D — large-embedded-data specials (3 tools: password, word, passes).** The 62 KB EFF
  wordlist line, the embedded dictionary, and the SGP4 math must survive the build **byte-exact**
  (assert by extracting and hashing the data segments pre/post build, not by spot-checking).

**Exit gates:** 71/71 rows ticked in the burn-down table, each with Definition of Done evidence ·
zero `.example` URLs anywhere in dist (`--check` greps for it) · `--check` green · every commit
diffed against `v1-import` · v1 folder declared read-only archive (note added to its README/hub).

---

## Phase 3 — PWA + GitHub sharing

**Goal:** the repo goes on GitHub, Pages serves it, and the served mode is installable.
Spec: [PWA.md](PWA.md), [API-AND-RELAY.md](API-AND-RELAY.md).

Work:
1. `build.py` emits `dist/sw.js` (precache from manifest, content-hash cache name) +
   `dist/manifest.webmanifest`. Icons produced in `core/icons/` per the suite design language.
2. Protocol-gated registration wired in `Suite`. **Gate:** dist output opened from `file://` is
   **byte-identical** to the pre-PWA build except for the registration block itself (assert by
   diff, not assumption).
3. Install verified on Chrome and Edge: standalone launch, per-tool deep link, and the ~21
   zero-network tools exercised with the network fully disabled after install.
4. **Push to GitHub, enable Pages on `dist/`** (needs the user's GitHub account once — flag when
   reached). Optionally add the one-line scheduled Action that re-runs `--refresh-data` monthly
   for the BLS numbers.
5. **Sharing story verified:** open the Pages link in a fresh browser profile — everything works,
   install prompt appears, zero setup.

**Exit gates:** offline matrix (PWA.md §4) verified row by row · shared-link path verified from a
fresh profile · zero file:// regressions (diff evidence) · SW update path verified (build →
reload → new content within one reload).

---

## Phase 4 — Suite-wide audit → v2.0

**Goal:** every checklist in [QUALITY.md](QUALITY.md) passes with evidence across all 72 files.
This is an audit phase, not a cleanup phase — most items were done at migration time; this phase
**proves** it and catches drift.

Work, in order:
1. **`settings.html`** — new tool, built to the same Definition of Done: suite-wide backup/restore
   (round-trip verified: export → wipe a scratch profile → import → all `suite.*` keys identical),
   key manager, relay config + live test, theme/location, storage viewer, cache purge.
2. **CSP suite-wide** — per the Phase 1 verdict, emitted for all files; `--check` proves hashes
   match on every file.
3. **Accessibility audit** — the full QUALITY.md §2 checklist per tool, executed and recorded
   (icon-button labels, `Suite.liveRegion` on every async region, keyboard paths, contrast in both
   palettes). Migration-time a11y work gets re-verified here, not trusted.
4. **Escaping audit** — line-by-line review of the 5 flagged files (factbook, art, dictionary,
   word, wiki) plus a suite-wide re-run of the interpolation heuristic; every flag resolved as
   fixed or "verified clean" with the reasoning recorded in the burn-down table.
5. **Games** — `games` category added to manifest/hub; meteor-patrol either brought to suite
   quality (missing sprites completed via the forge pipeline, theme integrated) or explicitly
   parked with a "work in progress" card in the hub — a deliberate state, not a loose end.
6. **Smoke suite** — `tests/smoke.mjs` (Playwright) run against **all 72 dist files**: zero
   console errors, chrome renders, theme toggle flips, offline card renders under fetch-block.
   This is mandatory, not optional (QUALITY.md §3).
7. Release checklist (QUALITY.md §5) executed; tag **`v2.0`**.

**Exit gates:** smoke suite green 72/72 · all QUALITY.md checklists pass with recorded evidence ·
release checklist executed · tag pushed.

---

## After v2.0 (backlog, unscheduled)

- New tools from CATALOG.md's unbuilt ideas — each a `--new` scaffold + the same Definition of Done.
- Second game; games get the suite theme treatment.
- Periodic CATALOG endpoint re-verification sweep (verification dates are part of the contract;
  the USGS legacy water API sunset ~Q1 2027 is already flagged).
