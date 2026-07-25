# Local Suite v3.0.0 release checklist

Release date: 2026-07-25
Release commit: to be recorded by the annotated `v3.0.0` tag
Public repository: https://github.com/Overplant-Paving/local-suite-3
Hosted suite: https://overplant-paving.github.io/local-suite-3/

This checklist supersedes the historical, untagged v2 checklist at
`tests/evidence/phase4/release-checklist.md`. V3 is released from the verified v2 architecture plus
multiple saved locations, Flight Tracker, and the National Parks Explorer.

## Scope

- [x] 73 manifest tools plus the hub; 74 generated HTML pages.
- [x] Multiple saved locations with migration, active-value compatibility, cache safety, and cross-tab behavior.
- [x] Individual Flight Tracker with provider, fallback, offline, and request-budget handling.
- [x] National Parks Explorer with all 29 documented resource groups and designed upstream-failure states.
- [x] No API key or account credential committed.

## Release gates

- [x] Clean deterministic build (`build.txt`).
- [x] `python3 build.py --check` — all fatal and negative gates green (`build-check.txt`).
- [x] Playwright smoke — 74/74 HTML pages green (`smoke.txt`).
- [x] Focused v3 contracts — multiple locations, cross-tab location updates, Flight Tracker, and all 29 Parks resources green (`focused-v3-tests.txt`).
- [x] PWA install/offline verification green (`pwa-install-offline.txt`).
- [x] PWA update verification green with old v2/v3 cache cleanup (`pwa-update.txt`).
- [x] Headed Chromium emits `beforeinstallprompt`, reports zero installability/manifest errors, loads same-origin icons under CSP, and is service-worker controlled (`headed-installability.txt`, `headed-installability.png`).
- [x] Hosted site returns release bytes exactly matching local `dist/index.html` and `dist/sw.js` (`hosted-verify.txt`).
- [x] GitHub Pages workflow for the final release candidate succeeds ([run 30145591822](https://github.com/Overplant-Paving/local-suite-3/actions/runs/30145591822)).
- [x] Working tree clean at the final release commit before tagging.
- [x] Annotated `v3.0.0` tag and GitHub Release published and read back after the final release commit.

## Release fix found during the final headed check

The first headed Chromium run rejected every manifest icon because generated CSP allowed `data:` and
remote image hosts but not same-origin images. Chromium consequently reported
`no-acceptable-icon` and did not emit `beforeinstallprompt`. The release changes generated
`img-src` to include `'self'`, adds installability errors to the automated PWA gate, and moves the
service-worker cache namespace to `suite-v3-*` while deleting stale `suite-vN-*` caches.

An independent release review also caught a stale hardcoded 72-tool assertion in the named-location
contract after Flight Tracker raised the manifest to 73 tools. The test now derives its expected
link count from `manifest/tools.json`; all focused v3 contracts were rerun and archived.

## Historical note

The planned `v2.0` tag was never created. Its technical build/audit evidence remains under
`tests/evidence/phase0` through `phase4`, but two archival/manual tasks held the historical tag.
The original sibling v1 repository and `v1-import` object are not present in this clone. V3.0.0 is
the first formal tag in the currently published repository and does not rewrite that history.
