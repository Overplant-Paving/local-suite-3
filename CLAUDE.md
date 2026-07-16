# Local Suite 2 — instructions for Claude

You are the developer of this project. It is the v2 rebuild of the Local Suite: ~71 single-file
HTML tools + hub, currently living in `../Local Suite` (a git repo — treat it as a read-only
reference; never modify it).

## Read first, in this order

1. [README.md](README.md) — what this is, the philosophy, the preserve list
2. [ROADMAP.md](ROADMAP.md) — the phases, the standing rules, **the current-status checklist**
3. [ARCHITECTURE.md](ARCHITECTURE.md) — technical spec + decisions D1–D9 (don't relitigate them)
4. The other docs as the work needs them: [MIGRATION.md](MIGRATION.md),
   [API-AND-RELAY.md](API-AND-RELAY.md), [PWA.md](PWA.md), [QUALITY.md](QUALITY.md)

## Standing rules (summary — full version tops ROADMAP.md)

- Nothing ships unverified: every claim of "done" is backed by evidence (gate output,
  screenshots, live-fetch records) archived under `tests/evidence/`.
- `python build.py --check` is the authority. Never route around a failing gate.
- Never edit `dist/` by hand — it's generated. Edit `tools/`, `core/`, `manifest/`.
- v1 (`../Local Suite`, tag `v1-import` once created) is the reference implementation; diff
  migrations against it.
- Parallelize independent tool migrations to subagents; serialize `core/` and `build.py` changes.
- Update ROADMAP's status block and MIGRATION's burn-down table in the same commit as the work.
- Keep it simple. The user has explicitly rejected elaborate machinery for small problems.
  No new infrastructure, services, or accounts — everything lives in this one repo.

## Project state (as of 2026-07-16, end of session 2)

- **All four phases' technical work is DONE.** 71/71 v1 tools migrated + settings.html
  (Batches A-D + Phase 4, per-tool evidence under `tests/evidence/`); PWA machinery built
  and verified (`tests/evidence/phase3/`); Phase 4 audits complete — escaping (3 real
  fixes), a11y (all 73 files; core ruling ARCHITECTURE D10), games parked as a designed
  hub WIP card. Gates zero-warning green; smoke 73/73 (`tests/evidence/phase4/gates.txt`);
  release checklist executed (`tests/evidence/phase4/release-checklist.md`).
- **Tag `v2.0` is HELD on two user-side items:** (1) the v1 read-only-archive README
  commit in `../Local Suite` (session permissions deny writes there; text drafted in
  HANDOFF.md); (2) one headed Chrome/Edge install-prompt
  check (the rest of Phase 3's GitHub half is DONE: public repo Overplant-Paving/local-suite-2,
  Pages live + fresh-profile verified — https://overplant-paving.github.io/local-suite-2/). Deferred verifications (upstream outages /
  shared demo-pool budgets) are listed in the release checklist; none block the tag.
- v1 is committed in `../Local Suite` on `main` (commit `7088cab`, 175 files), imported here
  as the `v1-import` tag.
- Distribution model: this repo goes on GitHub; Pages serves `dist/`; sharing = the link or the
  files. CORS-blocked sources: BLS numbers embedded at build; airport/custom-transit link out.
- `relay/worker.js` is an optional power-user template only — nothing depends on it.
- Things that need the user (flag, don't block): GitHub account for the Pages setup (Phase 3);
  any real API keys for live-verifying keyed tools (demo tiers otherwise).
