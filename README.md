# Local Suite 2 — the v2 rebuild

This is **Local Suite v2**: the next generation of the single-file HTML tool suite
(v1 lives in `../Local Suite`, now a read-only archive).

**To use the suite: open [`dist/index.html`](dist/index.html).** Everything in `dist/` is
built and self-contained — double-click any file there. The `tools/` folder holds the
*sources*, which don't link up until `python build.py` runs.

## What Local Suite is

A family of ~71 **single-file HTML tools** — weather station, earthquake monitor, password
generator, notepad, tide board, flashcards — plus a hub page that maps them all. The philosophy
(unchanged in v2):

- **One `.html` file per tool.** No framework, no npm, no runtime dependencies. Copy it anywhere,
  double-click it, it works.
- **Free, open data — government sources first.** NOAA, USGS, NASA, BLS, FDA, Treasury. Keyless
  and CORS-open wherever possible.
- **No tracking, no ads, no accounts.** The only requests a tool makes are to its data source.
  Many tools make *zero* requests.
- **Pleasant and calm.** Readable typography, light/dark aware, graceful "data unavailable" states.
- **Remembers politely.** Preferences live in `localStorage` under the `suite.*` namespace —
  nowhere else.
- **Just works, easily shared.** v2's defining goal: hand anyone the files (or a link) and every
  tool functions with zero setup — no accounts, no keys required for the core experience, no
  configuration steps.

## Sharing the suite

Two supported ways, both zero-setup for the recipient:

1. **Send the files.** `dist/` is self-contained — copy the folder (or a single tool's file) to a
   USB stick, a network share, an email attachment. Double-click and it works.
2. **Share a link.** Deploy `dist/` to any static host (GitHub Pages is the documented free path,
   set up in Phase 3). Recipients get the same suite at a URL, plus the installable PWA.

The 4 tools whose data sources block browser scripts stay simple: the two BLS tools (inflation,
jobs) show monthly numbers embedded at build time, and airport/custom-transit show a clean card
linking straight to the source's own website. Nothing needs setup, hosting, or accounts — see
[API-AND-RELAY.md](API-AND-RELAY.md) §4–5.

## Why v2

v1 (in `../Local Suite`) is a disciplined, high-quality build — but it was produced in one shot,
outside version control, with every shared piece copy-pasted per file. The audit that preceded
this plan found:

| | v1 | v2 |
|---|---|---|
| Version control | none — `.git` is an empty stub; git resolves to the **home directory** repo | real repo rooted here, v1 imported as a tag |
| Shared theme/chrome | byte-identical CSS block hand-copied into 55 files; ~60–90 duplicated lines × 70 files | `core/suite.css` + `core/suite.js`, inlined at build time |
| Hub (`index.html`) | hand-maintained 71-entry `TOOLS` array | generated from `manifest/tools.json` |
| Fetch/cache helpers | re-implemented per file (`getJSON` vs `fetchWithTimeout`) | one `Suite.fetchJSON()` with timeout + cache envelope |
| CORS-blocked tools (airport, jobs, inflation, transit-custom) | ship broken `.example` placeholder URLs | BLS numbers embedded at build; airport/transit link out to the source's own site |
| Offline story | zero-network tools + stale-cache fallback | same, **plus** installable PWA when served over http |
| Security hardening | no CSP, two inline handlers | build-generated per-file CSP with script hashes |
| Backup | per-tool export in 2 of 71 tools; focus.html can silently lose data | suite-wide backup/restore in a new `settings.html` |
| Accessibility | sparse ARIA (24/72 files) | checklist-driven sweep; shared chrome fixed once in core |

**The single-file contract is preserved**: every built tool in `dist/` is still one
self-contained, double-clickable HTML file. The only new tooling is one dependency-free
`build.py` (Python stdlib) that inlines the shared core into each tool.

## Target repo layout

```
Local Suite 2/
├── README.md · ROADMAP.md · ARCHITECTURE.md · MIGRATION.md
│   API-AND-RELAY.md · PWA.md · QUALITY.md · CATALOG.md   ← planning + reference docs
├── build.py                  # the entire toolchain, Python stdlib only
├── manifest/
│   └── tools.json            # single source of truth for every tool
├── core/
│   ├── suite.css             # theme + reset + shared chrome
│   ├── suite.js              # the Suite namespace (theme, fetch, store, esc, …)
│   └── icons/                # PWA icons
├── tools/                    # SOURCE: valid, runnable HTML files (edit these)
│   ├── index.html            # the hub
│   └── weather.html …
├── relay/
│   ├── worker.js             # Cloudflare Worker template (opt-in)
│   └── README.md
├── games/                    # meteor-patrol, de-nested, in the manifest
├── dist/                     # BUILT: self-contained double-clickable files (committed)
└── tests/                    # smoke suite + gate fixtures + per-tool evidence (required to ship)
```

## Quickstart (once built)

```
# Use the suite: open dist/index.html — that's it. Double-click works.

# Develop: edit tools/*.html (they run as-is from file:// via relative core links)
python build.py            # inline core into dist/
python build.py --check    # validation gates (run before committing)
python build.py --serve    # local server → PWA mode at http://localhost:8000
python build.py --new foo  # scaffold a new tool + manifest entry
```

## Doc map — read X when doing Y

| Document | Read it when… |
|---|---|
| [ROADMAP.md](ROADMAP.md) | deciding what to do next; tracking phase status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | building `build.py`, `core/`, or the manifest; any design question (ADRs D1–D9) |
| [MIGRATION.md](MIGRATION.md) | porting a v1 tool — the recipe, the batch plan, and the 71-row burn-down table |
| [API-AND-RELAY.md](API-AND-RELAY.md) | anything network: source policy, keys, rate limits, CORS-blocked sources |
| [PWA.md](PWA.md) | the service worker / installable layer (Phase 3) |
| [QUALITY.md](QUALITY.md) | security, accessibility, testing, and the release checklist |
| `CATALOG.md` (carried from v1) | the human-readable per-tool endpoint narrative with CORS verification dates |

## Non-goals / preserve list

These are deliberate constraints. Every doc assumes them; don't relitigate casually.

1. **Design language stays.** Warm-paper light / dark-slate dark, teal accent, the exact CSS
   variable names and 3-layer theming (`color-scheme` / `prefers-color-scheme` / `data-theme`).
   `core/suite.css` is an *extraction*, not a redesign.
2. **localStorage conventions stay.** `suite.*` namespace, shared `suite.location`, `{t,v}` cache
   envelope, `suite.key.<name>`. v2 reads v1 data unchanged — user data survives the swap.
3. **Single-file outputs, forever.** Every `dist/*.html` is self-contained and double-clickable.
4. **Keyless-first API policy.** The ~40 keyless government/public sources and the good-citizen
   caching rules stay canonical.
5. **CATALOG.md keeps its role** — human prose + verification dates; the manifest is machine truth.
   The build cross-checks them; neither replaces the other.
6. **Justified large files are a feature.** The EFF wordlist embedded in password.html and the
   offline dictionaries make tools work with zero network. They stay inline.
7. **Tool simplicity.** Per-tool source is markup + layout + logic, readable top-to-bottom in one
   sitting. The only shared abstraction is the `Suite` namespace.
8. **No frameworks, no bundlers, no CI server.** One Python script is the whole toolchain — but
   the quality gates it enforces (static checks with negative tests, the Playwright smoke suite,
   per-tool verification evidence) are mandatory for shipping, not optional extras.

## Development model

**This project is developed by Claude** (Fable 5 or later) operating agentically in Claude Code,
with the user directing scope and reviewing outcomes. The plan is written for that developer:
phases carry dependency-ordered hard exit gates instead of time estimates, independent work fans
out to parallel subagents, and every claim of "done" is backed by archived evidence
(screenshots, live-fetch records, gate output) rather than assertion. See the standing rules at
the top of [ROADMAP.md](ROADMAP.md).
