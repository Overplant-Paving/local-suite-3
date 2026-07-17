# Local Suite v3 — candidate tools and quality-of-life improvements

Grounded reconnaissance at commit `8b8690f` (2026-07-16). This is a proposal, not a committed v3 specification.

## Constraints worth preserving

The strongest differentiators are still the v2 invariants in `README.md` and `ARCHITECTURE.md`:

- self-contained, double-clickable `dist/*.html` files;
- no framework, account, tracking, runtime dependency, or required relay;
- keyless/CORS-open public data first;
- local-first storage under `suite.*`;
- deterministic `build.py`, CSP generation, and evidence-backed release gates;
- calm UI and honest stale/offline states.

V3 should add convenience without turning the suite into a platform. Prefer manifest data, browser-native APIs, and small additions to `Suite`; avoid a router, component framework, cloud sync, or a second cache layer.

## Recommended v3 headline

**Make the suite feel personal and coherent, then add a few high-frequency offline tools.**

V2 has 72 tools but the hub is still a static catalog: search, category pills, offline/no-key filters, and cards (`tools/index.html:72-76`, `135-199`). The highest-value v3 work is therefore navigation, personalization, portability, and trust—not another large API migration wave.

## P0 — high-impact quality-of-life work

### 1. Hub favorites, recents, and a compact “My tools” section

**Why:** With 72 entries, category browsing is no longer enough. The hub has no suite-level favorites or recent-tool history, although individual tools already implement their own favorites.

**Proposal:**

- star/unstar tool cards;
- show pinned tools first in a compact “My tools” row;
- track the last 8–12 opened tools locally;
- add a `Recent` filter and keyboard movement through search results;
- persist under `suite.hub.favorites` and `suite.hub.recent`;
- keep an option in Settings to clear recents.

**Files:** `tools/index.html`, `tools/settings.html`, manifest metadata only if optional keywords are added.

**Effort:** S–M. **Risk:** low. Do this first.

### 2. Multiple saved locations with one active location

**Implementation status:** Added on branch `v3/multiple-locations`: v2 migration, named-location management in Settings, hub switching, active `suite.location` mirroring, cache-safe switches, storage-failure feedback, focused tests, and 73-file smoke coverage.

**Why:** Roughly twenty tools share exactly one `suite.location` (`core/suite.js:161-176`). That is excellent for a single home, but awkward for home/work/family/travel.

**Proposal:**

- preserve `suite.location` as the active-location compatibility key;
- add `suite.locations` as named entries (Home, Work, Cabin, Trip);
- location picker in Settings, plus a lightweight picker in location-aware tools;
- changing the active entry writes `suite.location`, so existing tools continue to work unchanged;
- add optional location-specific cache prefixes only where stale cross-location results are currently possible.

**Files:** `core/suite.js`, `tools/settings.html`, then location-aware tools in controlled batches.

**Effort:** M–L. **Risk:** medium because cache identity must include location. Requires a storage migration and broad interaction tests.

### 3. Safer, clearer backup and restore

**Why:** Settings currently exports every `suite.*` value, including API keys and caches, then restores by overwriting matching keys (`tools/settings.html:107-133`, `265-333`). It warns users, but the safest workflow should be the default.

**Proposal:**

- export presets: **Preferences & content** (default), **Include caches**, **Include API keys** (explicit opt-in);
- import preview: format version, date, key count, affected tools, conflicts, estimated size;
- merge vs replace choice, with replace limited to `suite.*`;
- pre-import automatic rollback snapshot held in memory/downloadable;
- optional passphrase encryption using browser-native WebCrypto (AES-GCM + PBKDF2), with a plain JSON option retained;
- record `suite.backup.lastExport`, already specified in `ARCHITECTURE.md:181` but not written by the current export handler.

**Files:** `tools/settings.html`, backup format documentation, interaction tests.

**Effort:** M. **Risk:** medium; encrypted backups require strong negative tests and an explicit “password cannot be recovered” message.

### 4. Visible PWA install and update state

**Why:** Service-worker registration is intentionally silent (`core/suite.js:203-208`) and PWA install is currently browser-led. Users cannot tell whether the whole suite is ready offline or whether a new build is waiting.

**Proposal:** hosted mode only:

- an unobtrusive hub card/button for `beforeinstallprompt` when supported;
- “Offline copy ready” after the SW controls the page;
- “Update available — reload” when a new worker activates;
- current build identifier in Settings for support/debugging;
- keep all UI absent under `file://` and preserve the PWA non-goals: no push, background sync, or periodic refresh.

**Files:** `core/suite.js`, `tools/index.html`, `tools/settings.html`, `PWA.md`, PWA tests.

**Effort:** M. **Risk:** medium due to browser differences. Must not promise an install button on browsers that do not expose one.

### 5. Storage health and persistence controls

**Why:** Many tools depend on `localStorage`, but Settings reports only key sizes. Browser eviction/quota behavior is invisible.

**Proposal:** hosted mode where available:

- show `navigator.storage.estimate()` usage/quota;
- offer “Protect offline data” via `navigator.storage.persist()` with an honest granted/denied result;
- detect storage fallback-to-memory and display a warning rather than silently implying persistence;
- identify the largest tool/cache groups and purge by tool, not only all caches;
- add a backup reminder based on meaningful local content and `suite.backup.lastExport`.

**Files:** `core/suite.js` (expose persistence capability), `tools/settings.html`.

**Effort:** S–M. **Risk:** low if capability-gated.

## P1 — coherence improvements

### 6. Standard “copy / download / print” result actions

Several tools generate useful artifacts, but interaction patterns vary. Establish small shared conventions rather than a large component system:

- `Suite.copyText(text, fallbackEl)` with the proven `file://` fallback already duplicated in Settings;
- `Suite.downloadText(name, text, type)`;
- consistent icon labels and result-action placement;
- print/share-result buttons only where the result is durable and privacy-safe.

Candidate adopters: Text Toolbox, QR, Password, Dates, Loan, Converter, Geo, Data Viewer, Notes, Flashcards.

**Files:** `core/suite.js`, `core/suite.css`, selected tools. **Effort:** M across a batch. **Risk:** low.

### 7. Data freshness and source-health panel

**Why:** `Suite.fetchJSON` already returns timestamps and stale/cache flags (`core/suite.js:95-149`), but the suite has no cross-tool view of what is fresh, stale, throttled, or never loaded.

**Proposal:** Settings groups `suite.cache.*` by tool and shows newest/oldest timestamps, total size, and one-click purge. A later phase can add a “Refresh now” deep link, but Settings should not directly refetch dozens of APIs.

**Files:** `tools/settings.html`; optionally add manifest cache-prefix metadata. **Effort:** S–M. **Risk:** low.

### 8. Hub state persistence and URL-addressable filters

Persist category/offline/no-key/search state for local convenience and mirror shareable filters into the URL hash/query when served. Examples: `index.html#cat=util`, `#offline`, `#q=weather`.

Do not persist transient search text unless the user opts in; restoring a stale query can make the hub look mysteriously empty.

**Files:** `tools/index.html`. **Effort:** S. **Risk:** low.

### 9. Global units and display preferences

`weather` already uses `suite.units`, but suite-wide conventions are incomplete. Add Settings controls for:

- US/metric units;
- 12/24-hour time;
- reduced-data mode (prefer text/no large imagery where a tool supports it);
- reduced-motion remains browser-driven by default.

Adopt only in tools where conversions are unambiguous. Preserve existing per-tool overrides and migrate carefully.

**Files:** `tools/settings.html`, manifest preference metadata if needed, affected tools in batches. **Effort:** L suite-wide. **Risk:** medium-high because silent unit changes can mislead; labels must always remain explicit.

## Candidate new tools

### A. “Today” personal briefing — recommended flagship (M–L)

A calm, glanceable page combining the active location’s weather, active alerts, air quality, daylight, and one or two optional panels such as launches or local hazards. Reuse the same public endpoints and cache envelopes as existing tools; deep-link to the specialist tool for detail.

Guardrails: no engagement feed, no hidden background refresh, no duplicate notification system, and every card shows source/freshness. This creates more value from the existing suite than adding another isolated API.

### B. Calculator & Percentage Workbench (S)

A fully offline everyday calculator focused on transparent, editable expressions plus percentages, tips, tax, ratios, and change-over-time. This is a conspicuous daily-use gap beside Converter and Loan. Avoid implementing a programming language; use a small validated expression parser rather than `eval`.

### C. Image Toolbox (M)

Local-only image resize, crop, rotate, format conversion, compression preview, and metadata-stripping by canvas re-encoding. No uploads. Complements Color Studio’s photo palette feature without duplicating it.

Caveats: explain that re-encoding can remove common metadata but is not a forensic sanitizer; preserve transparency and warn about lossy output.

### D. Data Workbench (evolve `dataviewer.html`, M)

The current tool is a searchable JSON/CSV viewer (`manifest/tools.json`, `dataviewer` description). Evolve it before creating a second overlapping tool:

- column type inference and sorting/filtering;
- select/rename/drop columns;
- deduplicate and simple group/count/sum;
- JSON ↔ CSV conversion;
- export the transformed data;
- keep all processing local and set explicit file/row limits.

### E. File Integrity Toolbox (S–M)

Drop files to compute SHA-256/SHA-512, compare two files, verify a pasted checksum, and show byte size/MIME details. Text Toolbox hashes text, but not files. Use streaming where supported; otherwise warn before reading very large files into memory.

### F. Checklist & Routine Tracker (S–M)

A calm, offline recurring checklist for travel packing, maintenance, chores, and daily/weekly routines. This fills the gap between free-form Notes, printable planners, and Focus/Timers. Include JSON/text export and avoid streaks, badges, or engagement mechanics.

### G. Split & Tip Calculator (S)

Offline bill splitting with tax/tip handling, unequal shares, rounding reconciliation, and a copyable summary. Small enough to be excellent rather than broad. Could be a mode inside the Calculator tool instead of a separate card.

### H. Browser & Offline Diagnostics (S)

Prefer a Settings section rather than another hub card: protocol/origin, online state, storage availability/quota/persistence, service-worker control/cache version, clipboard/geolocation/notification availability, and a local self-test. Never expose public IP here; Network already owns network diagnostics.

### I. Meteor Patrol (existing backlog, M–L)

Finish the already-designed WIP game card in `tools/index.html:241-268` before adding a second game. It should meet the same keyboard, reduced-motion, offline, theme, CSP, and evidence requirements as every tool.

### J. Calendar / ICS Maker (M)

Turn custom reminders, countdowns, holidays, and World Clock meeting times into downloadable `.ics` files; optionally import a local ICS file into a private agenda view. This builds on Dates, Holidays, World Clock, and Printables without adding an account or calendar service.

Guardrails: correctly escape CR/LF and ICS delimiters, distinguish floating local times from UTC/TZID events, test DST boundaries, and promise only file import/export—not automatic OS calendar integration.

## Additional cross-suite findings

### Reliable save feedback

`Suite.store.set()` currently suppresses quota and storage-denial errors (`core/suite.js:43-47`). Notes compensates with a manual read-back, but many tools can announce success after a failed write. Make writes return a success result while remaining backward-compatible, expose whether storage is persistent or memory-only, and standardize verified-save feedback. Diagnostics must never reveal API-key values.

### First-run setup without a mandatory wizard

Offer a dismissible hub setup card for theme, ZIP/device location, units, and optional keys. Centralize repeated ZIP/geolocation behavior in a small shared helper. Geolocation must remain user-initiated, existing locations must never be overwritten silently, and all setup remains skippable.

### Cross-tab preference updates

Listen for browser `storage` changes so theme, active location, keys, and hub pins update in other open Local Suite tabs. Avoid feedback loops and document that `file://` storage-event behavior can vary by browser.

### Relay contradiction to resolve before v3

Settings lets users save and test an arbitrary relay but explicitly notes that generated dist CSP blocks that relay (`tools/settings.html:149-155`). The Worker is also powerful enough to incur abuse or hosting costs if deployed publicly. V3 should choose one truthful model:

1. keep the strict personal-template policy and remove/clarify unusable built-page promises; or
2. support a build-time allowlisted relay origin, preserving per-tool CSP and the Worker host allowlist.

Do **not** permit arbitrary runtime relay origins in `connect-src`. Preserve the Worker’s destination allowlist and add deployment guidance for authentication/rate limiting if a user exposes it publicly.

### Stable summaries for a Today dashboard

A Today tool should not parse arbitrary `suite.cache.<tool>` payloads directly. Add a small versioned contract such as `suite.summary.<tool> = {schema, t, status, fields}` written by participating tools, or a manifest-defined adapter. This prevents the first dashboard from becoming a brittle cross-tool coupling layer and avoids duplicate API requests.

### Tool-count documentation drift

The manifest contains 72 tools including Settings, while historical documents and evidence use different counts for migrated tools, suite-native tools, the hub, and total HTML files. The live build summary now derives and labels these categories mechanically (`72 tools + hub`, split by `since`) instead of reporting the confusing `72/71 tools (+hub)`; historical evidence remains untouched.

## Developer quality-of-life improvements

These preserve the “one Python toolchain” decision rather than adding infrastructure:

1. **Manifest-driven Settings key registry.** `tools/settings.html:351-361` hardcodes API-key metadata already present in `manifest/tools.json`. Inject it at build time to prevent drift (the current list even labels eBird as used by `birds`, while the manifest tool is `wildlife`).
2. **Focused verification command.** Add `python build.py --check-tool <id>` or a test wrapper that runs static checks plus that tool’s interaction test, while full `--check` and smoke remain release gates.
3. **Changed-tool test selection.** A local helper can map `git diff` to affected tools; any `core/`, `build.py`, or manifest generator change still forces the full suite.
4. **Richer `--new`.** Generate the interaction-test skeleton, evidence directory checklist, and complete manifest fields together. Fail until the placeholder description/endpoints/storage fields are resolved.
5. **Generated build metadata.** Inject a short version/commit/build date into Settings and the hub for support, without changing individual tool behavior or making builds nondeterministic. Release builds should receive the value explicitly rather than calling the clock internally.
6. **Endpoint health sweep.** Add an explicit local `--verify-endpoints` command that records HTTP/CORS observations without making normal builds network-dependent. This supports the existing CATALOG verification-date contract.

## Suggested implementation order

1. Hub favorites/recents and URL-addressable filters.
2. Backup safety + storage health.
3. Manifest-driven key registry and focused developer verification.
4. PWA install/update visibility.
5. Calculator, File Integrity, and Data Workbench (three mostly-offline quick wins).
6. Multiple locations, with explicit cache-key audit and migration.
7. “Today” briefing after location and freshness conventions are stable.
8. Image Toolbox, Checklist, and Meteor Patrol.
9. Global units/display preferences as a deliberate cross-suite migration.

## V3 release gates to add

- migration round-trip from real v2 storage, including backups and active location;
- hub favorites/recents keyboard and screen-reader tests;
- file:// and hosted/PWA parity for every new shared feature;
- quota/storage-denied tests for persistence-sensitive tools;
- backup tests proving keys/caches are excluded unless explicitly selected;
- PWA update UI tested against an actual changed service worker;
- large-file limits and memory-failure states for Image/Data/File tools;
- full existing `build.py --check`, Playwright smoke, CSP, escaping, and evidence requirements remain mandatory.
