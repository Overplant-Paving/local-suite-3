# Local Suite 3 — development instructions

Local Suite 3 is the released continuation of the verified v2 single-file suite. It contains 73
manifest tools plus a generated hub. The source is in `tools/`; committed, self-contained output is
in `dist/`.

## Read first

1. [README.md](README.md) — product contract and current release.
2. [ROADMAP.md](ROADMAP.md) — current status and backlog.
3. [ARCHITECTURE.md](ARCHITECTURE.md) — technical decisions and invariants.
4. [MIGRATION.md](MIGRATION.md), [API-AND-RELAY.md](API-AND-RELAY.md), [PWA.md](PWA.md), and
   [QUALITY.md](QUALITY.md) as the work requires.

`HANDOFF.md` is an archived v2 migration handoff. It is retained as provenance, not current state.
The historical sibling `../Local Suite` repository and `v1-import` object are not present in this
checkout; do not claim otherwise. Existing migration evidence remains under `tests/evidence/`.

## Standing rules

- Nothing ships unverified. Archive command output, screenshots, and live-fetch records under
  `tests/evidence/`.
- `python3 build.py --check` is authoritative. Never route around a failing gate.
- Never edit `dist/` by hand. Edit `tools/`, `core/`, `manifest/`, or `build.py`, then rebuild.
- Keep every built tool self-contained and double-clickable under `file://`.
- Preserve keyless-first data access, local `suite.*` storage, explicit freshness/offline states,
  generated CSP, and the no-framework/no-runtime-dependency contract.
- Serialize changes to `core/` and `build.py`; independently scoped tool work may run in parallel.
- Keep changes simple. Do not introduce an account, service, framework, or required relay.
- API keys are user-owned local data. Never commit, print, or place them in URLs when a provider
  supports header authentication.

## Current project state (v3.0.0, 2026-07-25)

- 71 v1 tools are preserved on the v2 architecture; Settings and Flight Tracker bring the manifest
  to 73 tools, plus the hub (74 generated HTML pages).
- V3 adds named multiple locations, cache-safe active switching and cross-tab behavior, an
  individual Flight Tracker, and a 29-resource National Parks Explorer.
- GitHub repository: https://github.com/Overplant-Paving/local-suite-3
- Hosted suite: https://overplant-paving.github.io/local-suite-3/
- Release evidence and the final checklist live under `tests/evidence/v3-release/`.
- The final headed Chromium gate verifies a real `beforeinstallprompt` event, zero manifest and
  installability errors, service-worker control, same-origin manifest icons under CSP, and the v3
  precache. Full build, PWA, update, and 74-page smoke gates remain mandatory for future releases.

## Distribution model

GitHub Pages publishes committed `dist/` files. The same files can be copied and opened directly.
The service worker is hosted-mode-only and never caches provider API responses. `relay/worker.js`
is an optional power-user template; no core tool depends on it.
