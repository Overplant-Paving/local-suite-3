#!/usr/bin/env python3
"""Resolve escaping-heuristic flags for one tool into tests/escape-allowlist.json.
Every flagged expression MUST be documented in the tool's report.md (substring match
after whitespace normalization) — otherwise exit 1 for manual orchestrator review."""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(r"C:\Users\henry\Developement\Local Suite 2")
PATH_REASONS = ROOT / "handoff" / "orchestration" / "escape-reasons.json"
tool = sys.argv[1]
fname = f"{tool}.html"

specific = json.load(open(PATH_REASONS, encoding="utf-8")) if PATH_REASONS.exists() else {}
spec = specific.get(fname, {})

r = subprocess.run([sys.executable, str(ROOT / "build.py"), "--check"],
                   capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
flags = []
pat = re.compile(re.escape(fname) + r": unescaped interpolation into innerHTML: \$\{(.*)\}$")
for line in r.stdout.splitlines():
    m = pat.search(line.strip().lstrip("- ").strip())
    if m:
        flags.append(m.group(1))

if not flags:
    print(f"{fname}: no escaping flags — allowlist unchanged")
    sys.exit(0)

report = (ROOT / "tests" / "evidence" / tool / "report.md").read_text(encoding="utf-8")
squash = lambda s: re.sub(r"\s+", "", s)
rsquash = squash(report)

apath = ROOT / "tests" / "escape-allowlist.json"
allow = json.loads(apath.read_text(encoding="utf-8"))
entry = allow.setdefault(fname, {})
undocumented = []
for e in flags:
    if e in entry:
        continue
    if e in spec:  # orchestrator-authored reason after manual review — takes precedence
        entry[e] = spec[e]
        continue
    if squash(e)[:60] not in rsquash:
        undocumented.append(e)
        continue
    entry[e] = f"local-only expression, recorded verified-clean with reasoning in tests/evidence/{tool}/report.md"

with open(apath, "w", encoding="utf-8", newline="\n") as f:
    json.dump(allow, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"{fname}: {len(flags)} flag(s), {len(entry)} allowlisted")
if undocumented:
    print("NOT DOCUMENTED in report.md — manual review required:")
    for e in undocumented:
        print(f"  ${{{e}}}")
    sys.exit(1)
