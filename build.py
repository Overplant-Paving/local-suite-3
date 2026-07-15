#!/usr/bin/env python3
"""build.py — the entire Local Suite v2 toolchain. Python stdlib only (ADR D1).

Commands:
  python build.py            inline core into tools/*.html -> dist/; hub injection; CSP
  python build.py --check    validation gates; exits non-zero on any failure
  python build.py --serve    build + http.server on 8000 (PWA mode)
  python build.py --new ID   scaffold tools/ID.html + manifest entry
  python build.py --refresh-data   fetch BLS numbers, embed into jobs/inflation (Batch C)

Phase 0 state: arg parsing + gate registry. Every gate is a stub that FAILS
LOUDLY as "not implemented" — nothing passes vacuously. Phase 1 implements them.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT / "tools"
DIST = ROOT / "dist"
CORE = ROOT / "core"
MANIFEST = ROOT / "manifest" / "tools.json"


class NotImplementedGate(Exception):
    """A gate that exists in the spec but has no implementation yet."""


def load_manifest():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 2:
        sys.exit(f"manifest schemaVersion must be 2, got {data.get('schemaVersion')}")
    return data


# ---------------------------------------------------------------- build

def cmd_build(args):
    sys.exit("build: not implemented (Phase 1)")


def cmd_serve(args):
    sys.exit("--serve: not implemented (Phase 1)")


def cmd_new(args):
    sys.exit("--new: not implemented (Phase 1)")


def cmd_refresh_data(args):
    sys.exit("--refresh-data: not implemented (Phase 2, Batch C)")


# ---------------------------------------------------------------- gates
# Registry mirrors ARCHITECTURE.md §4.4. Each returns a list of problem
# strings (empty = pass) or raises NotImplementedGate.

def gate_manifest_files_sync(manifest):
    raise NotImplementedGate


def gate_markers(manifest):
    raise NotImplementedGate


def gate_dist_staleness(manifest):
    raise NotImplementedGate


def gate_no_inline_handlers(manifest):
    raise NotImplementedGate


def gate_csp(manifest):
    raise NotImplementedGate


def gate_escaping_heuristic(manifest):  # advisory
    raise NotImplementedGate


def gate_catalog_crosscheck(manifest):  # advisory
    raise NotImplementedGate


def gate_key_hygiene(manifest):
    raise NotImplementedGate


GATES = [
    # (name, fn, fatal)
    ("manifest-files-sync", gate_manifest_files_sync, True),
    ("markers", gate_markers, True),
    ("dist-staleness", gate_dist_staleness, True),
    ("no-inline-handlers", gate_no_inline_handlers, True),
    ("csp", gate_csp, True),
    ("escaping-heuristic", gate_escaping_heuristic, False),
    ("catalog-crosscheck", gate_catalog_crosscheck, False),
    ("key-hygiene", gate_key_hygiene, True),
]


def cmd_check(args):
    manifest = load_manifest()
    failed, unimplemented = [], []
    for name, fn, fatal in GATES:
        try:
            problems = fn(manifest)
        except NotImplementedGate:
            unimplemented.append(name)
            print(f"GATE {name:<20} NOT IMPLEMENTED")
            continue
        if problems:
            tag = "FAIL" if fatal else "WARN"
            print(f"GATE {name:<20} {tag} ({len(problems)})")
            for p in problems:
                print(f"  - {p}")
            if fatal:
                failed.append(name)
        else:
            print(f"GATE {name:<20} pass")

    print(f"\ntools in manifest: {len(manifest['tools'])} / 71 migrated")

    if unimplemented:
        print(f"\n{len(unimplemented)} gate(s) not implemented -- Phase 1 work remains:")
        for name in unimplemented:
            print(f"  - {name}")
        sys.exit(2)
    if failed:
        sys.exit(1)
    print("\n--check: all gates green")


# ---------------------------------------------------------------- main

def main():
    p = argparse.ArgumentParser(description="Local Suite v2 toolchain")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--check", action="store_true", help="run validation gates")
    g.add_argument("--serve", action="store_true", help="build + serve on :8000")
    g.add_argument("--new", metavar="ID", help="scaffold a new tool")
    g.add_argument("--refresh-data", action="store_true",
                   help="fetch + embed monthly BLS data")
    args = p.parse_args()

    if args.check:
        cmd_check(args)
    elif args.serve:
        cmd_serve(args)
    elif args.new:
        cmd_new(args)
    elif args.refresh_data:
        cmd_refresh_data(args)
    else:
        cmd_build(args)


if __name__ == "__main__":
    main()
