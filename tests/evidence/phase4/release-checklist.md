# Release checklist (QUALITY.md §5) — executed 2026-07-16

- [x] `python build.py` — clean build (73 files: 71 v1 tools + settings + hub; PWA artifacts)
- [x] `python build.py --check` — green, all 10 gates incl. negative tests, ZERO advisory
      warnings (`gates.txt` in this directory)
- [x] smoke suite green across all dist files — **73/73** (`gates.txt`)
- [x] zero unresolved escaping-heuristic flags — every flag either report-documented or
      orchestrator-reviewed in `handoff/orchestration/escape-reasons.json`
- [x] dist committed; staleness gate green (source↔dist match, incl. pwa-sync)
- [x] CATALOG.md verification dates touched for every endpoint that changed this cycle
      (NPS, USDA, LL2, BART, CelesTrak, ssd-api regression, Overpass outage, DEMO_KEY note)
- [x] `suite.meta.schemaVersion` — NOT bumped: no existing key changed shape; additions
      (suite.launches.backoffUntil, suite.cache.markets.throttle, suite.transit.agencyLink,
      suite.relay.url convention) are new keys, all declared in the manifest, all readable
      by fresh installs. Ruling recorded here.
- [x] ROADMAP.md status block and MIGRATION.md burn-down current (same commit)
- [ ] **tag `v2.0` — HELD.** Blockers, all user-side, none technical:
      1. v1 read-only-archive README commit in `../Local Suite` (this session's permissions
         deny writes there — drafted text in HANDOFF.md)
      2. Phase 3 GitHub half: repo push + Pages on `dist/`, fresh-profile share check,
         headed Chrome/Edge install-prompt check
      Tag when both land.

Deferred verifications on record (documented in the respective reports, none gate-blocking):
- nearby: one live Overpass query (upstream outage 2026-07-16; task chip pending)
- apod, nutrition, asteroids: verify-tool re-runs when the NASA/USDA demo pools reset
  (CSS-only a11y edits since their last green runs; route-fulfilled validation archived)
- elevation: verify-tool re-run when api.open-elevation.com stops 504-flapping (v1 fails
  identically today)
- word: dictionaryapi.dev 404-mapping branch live-exercise (code-reviewed only)
