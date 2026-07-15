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

## Project state (as of 2026-07-15)

- Planning docs complete; no code exists yet. **Next action: Phase 0 of ROADMAP.md.**
- v1 is committed in `../Local Suite` on `main` (commit `7088cab`, 175 files).
- Distribution model: this repo goes on GitHub; Pages serves `dist/`; sharing = the link or the
  files. CORS-blocked sources: BLS numbers embedded at build; airport/custom-transit link out.
- `relay/worker.js` is an optional power-user template only — nothing depends on it.
- Things that need the user (flag, don't block): GitHub account for the Pages setup (Phase 3);
  any real API keys for live-verifying keyed tools (demo tiers otherwise).
