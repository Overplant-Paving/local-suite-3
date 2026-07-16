#!/usr/bin/env python3
"""Orchestrator helper: insert a reviewed tool's manifest entry (from its evidence
dir) into manifest/tools.json in canonical burn-down order, rebuild, run --check."""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(r"C:\Users\henry\Developement\Local Suite 2")
ORDER = ["focus", "weather", "almanac", "holidays", "voting", "emergency", "convert",
         "worldclock", "dates", "daylight", "printables", "tripcost", "qr", "text",
         "color", "random", "notes", "dataviewer", "sound", "paper", "timers", "loan",
         "flashcards",
         # Batch B (burn-down rows 24-56)
         "alerts", "radar", "air", "spaceweather", "tides", "marine", "normals",
         "quakes", "rivers", "wildfire", "drought", "volcano", "snow", "wildlife",
         "iss", "asteroids", "fedregister", "recalls", "treasury", "yields",
         "currency", "illness", "medicine", "foodrecalls", "dictionary", "wiki",
         "zip", "factbook", "books", "art", "geo", "elevation", "network",
         # Batch C (rows 57-68)
         "apod", "nutrition", "congress", "gas", "parks", "markets", "launches",
         "nearby", "airport", "jobs", "inflation", "transit",
         # Batch D (rows 69-71)
         "password", "word", "passes"]

REQUIRED = ["id", "file", "name", "cat", "cx", "desc", "network", "key", "endpoints",
            "storage", "cacheTtlMin", "since", "flags"]

tool = sys.argv[1]
entry = json.loads((ROOT / "tests" / "evidence" / tool / "manifest-entry.json").read_text(encoding="utf-8"))
missing = [k for k in REQUIRED if k not in entry]
if missing:
    sys.exit(f"manifest-entry.json missing fields: {missing}")
if entry["id"] != tool or entry["file"] != f"{tool}.html":
    sys.exit(f"entry id/file mismatch: {entry['id']}/{entry['file']}")

mpath = ROOT / "manifest" / "tools.json"
manifest = json.loads(mpath.read_text(encoding="utf-8"))
tools = [t for t in manifest["tools"] if t["id"] != tool]
tools.append(entry)
tools.sort(key=lambda t: ORDER.index(t["id"]) if t["id"] in ORDER else 999)
manifest["tools"] = tools
with open(mpath, "w", encoding="utf-8", newline="\n") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"manifest: {len(tools)} tools, inserted {tool}")
r = subprocess.run([sys.executable, str(ROOT / "build.py")], capture_output=True, text=True, cwd=ROOT)
print(r.stdout[-400:] or r.stderr[-400:])
if r.returncode: sys.exit("BUILD FAILED")
r = subprocess.run([sys.executable, str(ROOT / "build.py"), "--check"], capture_output=True, text=True, cwd=ROOT)
print(r.stdout)
sys.exit(r.returncode)
