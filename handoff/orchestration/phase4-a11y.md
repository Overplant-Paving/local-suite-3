PHASE 4 ACCESSIBILITY AUDIT — per-tool re-verification of the QUALITY.md §2 checklist
(ROADMAP Phase 4 item 3: "Migration-time a11y work gets re-verified here, not trusted.")

You are auditing an ASSIGNED LIST of tools (given in your task prompt). Project root:
C:\Users\henry\Developement\Local Suite 2. Read QUALITY.md §2 first, then per tool:

CHECKLIST (execute, don't infer — every item verified in the RUNNING tool via Playwright
against tools/<tool>.html from file://, both themes where relevant):

1. Icon-only / symbol-only buttons and links: accessible name present (aria-label, or
   visible text). Enumerate them programmatically (buttons/links whose textContent is
   empty, whitespace, or a single symbol/emoji) and check each.
2. Async/result regions: containers that update after user actions or fetches carry
   aria-live (Suite.liveRegion) — grep the source AND verify at runtime
   (getAttribute("aria-live")) on the container that actually changes.
3. Keyboard paths: every mouse path has a keyboard path. Concretely: all interactive
   elements reachable by Tab (no positive tabindex, no keyboard traps); Enter submits
   where a text-entry + button pair exists; custom clickable non-button elements have
   tabindex=0 + Enter/Space handlers; Esc closes any overlay/modal. Drive the tool's
   PRIMARY feature start-to-finish using ONLY keyboard calls (page.keyboard) and log it.
4. Labels: every input has <label for=> or aria-label (enumerate inputs, check each).
5. Contrast, both palettes: for the tool's running page in light AND dark theme, compute
   WCAG contrast ratios for: body text vs background, .muted-class text vs its actual
   background, accent-on-soft chips/buttons (foreground vs rendered background), and any
   status/badge colors the tool defines locally. Ratio >= 4.5 for normal text, >= 3.0 for
   large text (>= 24px or >= 18.7px bold) and UI component boundaries. Compute from
   getComputedStyle color/backgroundColor (walk up ancestors for the effective bg;
   alpha-composite when needed). Log each computed pair (fg, bg, ratio, pass/fail).
6. Focus visibility: focus an interactive element and verify a visible focus indicator
   (computed outline/box-shadow difference vs unfocused).

FIX what fails. Rules: smallest change that passes; tool-local CSS for tool-local colors
(all four theme contexts, matching each tool's existing pattern); never touch core/ or the
suite palette (a suite-wide contrast failure = REPORT it prominently, don't fix locally);
never change behavior; localStorage keys untouchable; embedded-data segments (password,
word, passes — see their tests/evidence/<t>/data-integrity.txt) are byte-untouchable.

PER TOOL, after auditing (and fixing if needed):
- If you MODIFIED the tool: re-run cd tests && node verify-tool.mjs <tool> (exit 0). If a
  tool's live source is down (Overpass etc. — check its report), the module's fallbacks
  handle it; document, don't hammer. Embedded-data tools: re-run the data-integrity
  extraction afterward and confirm the hash.
- APPEND to tests/evidence/<tool>/report.md: "## Phase 4 a11y audit" — checklist verdict
  table (item -> pass/fixed/n-a + evidence one-liner), contrast measurements, fixes made.
  (A PostToolUse hook may block report.md Writes — append via shell; expected.)

HUB EXCEPTION: if index.html is in your list, audit dist/index.html-equivalent by loading
tools/index.html — its tool grid is empty from source (manifest injected at build), so ALSO
load dist/index.html for the populated-grid checks (search, pills, cards keyboard nav), but
make any FIXES in tools/index.html only.

HARD RULES: do not modify manifest/tools.json, MIGRATION.md, dist/, core/, build.py,
tests/verify-tool.mjs, tests/smoke.mjs, tools outside your list, or anything under
..\Local Suite. Do not run build.py or git.

FINAL MESSAGE: per tool one line — pass-as-was / fixed(what) / suite-wide-flag(what);
plus harness results for modified tools, and any contrast failures you could NOT fix
locally (suite palette issues) as a prominent list.
