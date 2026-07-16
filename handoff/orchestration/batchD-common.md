BATCH D ADDENDUM — large-embedded-data specials (password, word, passes). Read
handoff/orchestration/subagent-common.md FIRST (recipe, deliverables, hard rules). Network
tools (word, passes) also read handoff/orchestration/batchB-common.md (endpoints/CSP, TTL
policy, live-fetch + stale-path verification). This file adds the Batch D specifics.

BYTE-EXACT EMBEDDED DATA (the batch's defining requirement — ROADMAP Phase 2 Batch D):
Each tool carries at least one large embedded data segment (per-tool below). The 62 KB EFF
wordlist line, the embedded dictionary, and the SGP4 math must survive the migration AND the
build byte-exact. Assert by extract-and-hash, never by spot-check:

1. Define each segment with a mechanically reproducible extraction: an exact Python regex or
   unambiguous start/end byte markers that work identically on the v1 original, your migrated
   tools/{TOOL}.html, and (later, run by the orchestrator) the built dist/{TOOL}.html.
2. Extract the full segment from the v1 original and from tools/{TOOL}.html; SHA-256 both;
   they MUST be equal.
3. Write tests/evidence/{TOOL}/data-integrity.txt with, per segment: name, the exact
   extraction (a runnable `python -c` one-liner the orchestrator can replay verbatim against
   any of the three files), byte length, sha256(v1), sha256(v2 source), verdict. The
   orchestrator replays it against dist/ after integration and appends the post-build hash.
4. The data segment is untouchable: recipe changes (quote style, whitespace, escaping,
   addEventListener conversions) stop at its boundary. Never reformat, re-encode, minify, or
   "fix" embedded data even where it looks wrong — byte parity beats style. If a recipe rule
   and byte parity conflict inside the segment, byte parity wins and the conflict is
   documented in report.md.

FUNCTIONAL PROOF ON TOP OF PARITY: hashing proves the data survived; you must also prove the
tool still computes with it. Exercise the real feature deterministically (page.clock and/or
seeded/stubbed randomness where the tool is time- or random-driven) and log concrete observed
values, plus one independent sanity recomputation documented in report.md (e.g. recompute a
passphrase's entropy claim; recompute one satellite pass quantity by an independent path).

EA FLAG (word.html only): this tool is on the Phase 4 escaping-audit shortlist. Inventory
EVERY innerHTML interpolation site in report.md (site, expression, verdict esc'd/local-safe) —
the Phase 4 auditor reads this section. All dictionaryapi.dev strings MUST be esc'd.

MANIFEST: network "offline" (password) / "cors-open" (word, passes); key null; flags include
"embedded-data" for all three; endpoints/cacheTtlMin per batchB-common rules where network
applies (justify the TTL from the source's own guidance and v1's behavior).
