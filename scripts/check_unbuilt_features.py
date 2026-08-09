#!/usr/bin/env python3
"""No UI may depend on a feature flag that is still declared unbuilt.

`lib/tiers.ts` UNBUILT lists flags reserved for features nobody has written
yet. canAccess() denies them to every tier, Growth included, so a gate wired on
one of them fails closed instead of showing a paying customer a feature with no
implementation behind it.

That protects against the first mistake. This guard protects against the
second, opposite one: someone BUILDS the feature, wires the gate, and forgets
to remove the flag from UNBUILT — in which case canAccess() keeps returning
false and the finished feature is invisible to the customers who paid for it.
That is exactly the multi_business bug (audit #16), which locked Growth owners
out of the business switcher they had bought.

So: the moment any app/component/lib file references an unbuilt flag, this goes
red and tells you to unlist it first.

Stdlib only, no build step.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TIERS = ROOT / "lib" / "tiers.ts"
SEARCH_DIRS = ("app", "components", "lib")

if not TIERS.exists():
    print(f"FATAL: {TIERS} not found", file=sys.stderr)
    sys.exit(2)

src = TIERS.read_text(encoding="utf-8")

m = re.search(r"const\s+UNBUILT\s*:\s*Feature\[\]\s*=\s*\[([^\]]*)\]", src)
if not m:
    print("FATAL: could not find UNBUILT in lib/tiers.ts — has it been renamed?",
          file=sys.stderr)
    sys.exit(2)

unbuilt = re.findall(r"'([^']+)'", m.group(1))
if not unbuilt:
    print("Unbuilt-feature guard OK — nothing is currently reserved.")
    sys.exit(0)

# Where each flag is allowed to appear: the declaration itself, and nowhere else.
offenders: list[str] = []
for d in SEARCH_DIRS:
    base = ROOT / d
    if not base.exists():
        continue
    for path in list(base.rglob("*.ts")) + list(base.rglob("*.tsx")):
        if path == TIERS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for line_no, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue          # a comment mentioning the flag is fine
            for flag in unbuilt:
                if re.search(rf"['\"]{re.escape(flag)}['\"]", line):
                    rel = path.relative_to(ROOT).as_posix()
                    offenders.append(f"{rel}:{line_no}  references {flag!r}")

if offenders:
    print("UNBUILT FEATURE IS WIRED INTO THE UI.\n")
    for o in offenders:
        print(f"  • {o}")
    print(
        f"\nUNBUILT currently reserves: {unbuilt}\n"
        "canAccess() denies these to EVERY tier, so whatever you just wired is\n"
        "invisible to the customers who paid for it — the multi_business bug\n"
        "(audit #16) all over again.\n\n"
        "If the feature is now built: remove the flag from lib/tiers.ts UNBUILT,\n"
        "from aibos-api entitlements.py _UNBUILT and from tier_contract.json\n"
        "\"unbuilt\", and push aibos-api FIRST.\n"
        "If it is not built: do not gate on it yet."
    )
    sys.exit(1)

print(f"Unbuilt-feature guard OK — {unbuilt} reserved, and no UI depends on them.")
