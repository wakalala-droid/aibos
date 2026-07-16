#!/usr/bin/env python3
"""
The frontend half of the tier-contract guard.

AIBOS is two repos that deploy independently and each kept its own copy of what
a plan unlocks. Nothing compared them, so they drifted silently and shipped real
bugs: 'multi_business' was granted by entitlements.py but missing from tiers.ts,
locking paying Growth owners out of the switcher they'd bought; and the Free chat
taster existed only server-side while the pricing page advertised "3 questions a
day", unreachable for a whole release.

aibos-api/tier_contract.json is now the authoritative statement. The backend
asserts it matches (test_tier_contract.py, by importing its own maps). THIS
script asserts lib/tiers.ts matches the same file, fetched from the API repo's
main branch — data only, never remote code.

  python3 scripts/check_tier_contract.py                  # against the API repo's main
  python3 scripts/check_tier_contract.py --contract ../aibos-api/tier_contract.json

Exit 0 = the two repos agree. Exit 1 = drift, or the contract was unreachable.
Both are worth a red build; the message says which.

Python (not Node) because ubuntu-latest ships it and this repo has no test
runner — adding one just for this would cost more than the check is worth.
"""

import argparse
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

CONTRACT_URL = (
    "https://raw.githubusercontent.com/wakalala-droid/aibos-api/main/tier_contract.json"
)
TIERS = ("free", "pro", "proplus", "growth")


# ── Reading tiers.ts ─────────────────────────────────────────────────────────
# A real (small) scanner rather than a naive regex: the arrays carry `//`
# comments that themselves quote feature names — e.g. the GROWTH array explains
# why 'multi_business' belongs there — and a regex that swept those up would
# "find" features that aren't in the map. Strings win over comments, always.


def strip_comments(src: str) -> str:
    out, i, n = [], 0, len(src)
    quote = None
    while i < n:
        c = src[i]
        if quote:
            out.append(c)
            if c == "\\" and i + 1 < n:      # escaped char — copy both, verbatim
                out.append(src[i + 1])
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "'\"`":
            quote = c
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def balanced(src: str, open_idx: int, open_ch: str = "{", close_ch: str = "}") -> str:
    """The {...} (or [...]) block starting at open_idx, brace-matched."""
    depth, i, n = 0, open_idx, len(src)
    while i < n:
        if src[i] == open_ch:
            depth += 1
        elif src[i] == close_ch:
            depth -= 1
            if depth == 0:
                return src[open_idx : i + 1]
        i += 1
    raise ValueError("unbalanced block in tiers.ts — cannot parse")


def parse_tiers_ts(src: str) -> dict:
    src = strip_comments(src)

    # const PRO: Feature[] = [ 'a', 'b', ...OTHER ];  — spreads resolved recursively.
    arrays: dict[str, list[str]] = {}
    raw: dict[str, str] = {}
    for m in re.finditer(r"const\s+(\w+)\s*:\s*Feature\[\]\s*=\s*\[", src):
        raw[m.group(1)] = balanced(src, m.end() - 1, "[", "]")

    def resolve(name: str, seen: frozenset = frozenset()) -> list[str]:
        if name in arrays:
            return arrays[name]
        if name in seen:
            raise ValueError(f"circular spread through {name}")
        body = raw[name]
        out: list[str] = []
        for tok in re.finditer(r"\.\.\.(\w+)|'([^']+)'", body):
            if tok.group(1):
                out.extend(resolve(tok.group(1), seen | {name}))
            else:
                out.append(tok.group(2))
        arrays[name] = out
        return out

    for name in raw:
        resolve(name)

    # const ACCESS: Record<Tier, Feature[]> = { free: [], pro: PRO, ... }
    m = re.search(r"const\s+ACCESS\s*:\s*Record<Tier,\s*Feature\[\]>\s*=\s*\{", src)
    if not m:
        raise ValueError("could not find the ACCESS map in tiers.ts")
    access_block = balanced(src, m.end() - 1)
    access: dict[str, list[str]] = {}
    for tier in TIERS:
        am = re.search(rf"\b{tier}\s*:\s*(\w+|\[\s*\])", access_block)
        if not am:
            raise ValueError(f"ACCESS has no entry for {tier!r}")
        val = am.group(1)
        access[tier] = [] if val.startswith("[") else list(arrays[val])

    # export const FREE_TASTER: ... = { ai_chat: { perDay: 3, noun: 'question' } }
    taster: dict[str, int] = {}
    m = re.search(r"const\s+FREE_TASTER\s*:[^=]*=\s*\{", src)
    if not m:
        raise ValueError("could not find FREE_TASTER in tiers.ts")
    for tm in re.finditer(r"(\w+)\s*:\s*\{[^}]*?perDay\s*:\s*(\d+)", balanced(src, m.end() - 1)):
        taster[tm.group(1)] = int(tm.group(2))

    # export const TIERS: Record<Tier, TierMeta> = { free: { priceMonthly: 0, ... }, ... }
    m = re.search(r"const\s+TIERS\s*:\s*Record<Tier,\s*TierMeta>\s*=\s*\{", src)
    if not m:
        raise ValueError("could not find the TIERS metadata in tiers.ts")
    tiers_block = balanced(src, m.end() - 1)
    prices: dict[str, dict[str, int]] = {}
    for tier in TIERS:
        tm = re.search(rf"\b{tier}\s*:\s*\{{", tiers_block)
        if not tm:
            raise ValueError(f"TIERS has no entry for {tier!r}")
        body = balanced(tiers_block, tm.end() - 1)
        month = re.search(r"priceMonthly\s*:\s*(\d+)", body)
        annual = re.search(r"priceAnnual\s*:\s*(\d+)", body)
        if not month or not annual:
            raise ValueError(f"TIERS.{tier} is missing priceMonthly/priceAnnual")
        prices[tier] = {"monthly": int(month.group(1)), "annual": int(annual.group(1))}

    return {"access": access, "taster": taster, "prices": prices}


def assert_not_vacuous(parsed: dict) -> None:
    """A parser that quietly finds nothing would pass forever while drift ships.
    These anchors make a broken parser fail like drift, which is the safe way
    round."""
    if set(parsed["access"]) != set(TIERS):
        raise ValueError(f"parsed tiers {sorted(parsed['access'])}, expected {list(TIERS)}")
    if len(parsed["access"]["pro"]) < 10:
        raise ValueError("parsed suspiciously few Pro features — the parser is broken")
    if "ai_chat" not in parsed["taster"]:
        raise ValueError("parsed no ai_chat taster — the parser is broken")
    if parsed["prices"]["pro"]["monthly"] <= 0:
        raise ValueError("parsed a non-positive Pro price — the parser is broken")


# ── Compare ──────────────────────────────────────────────────────────────────


def fetch_contract(src: str) -> dict:
    if not src.startswith("http"):
        return json.loads(pathlib.Path(src).read_text("utf-8"))
    last = None
    for _ in range(3):                       # a blip must not read as drift
        try:
            with urllib.request.urlopen(src, timeout=20) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
    raise SystemExit(
        f"COULD NOT REACH THE CONTRACT at {src}\n  {last}\n"
        "This is an infrastructure failure, NOT drift — but it is still red, "
        "because a guard that skips when it cannot check is not a guard."
    )


def compare(parsed: dict, contract: dict) -> list[str]:
    problems: list[str] = []

    for tier in TIERS:
        mine = set(parsed["access"][tier])
        theirs = set(contract["access"][tier])
        if mine != theirs:
            only_fe = sorted(mine - theirs)
            only_be = sorted(theirs - mine)
            problems.append(
                f"ACCESS[{tier}] disagrees:\n"
                + (f"    only in lib/tiers.ts:      {only_fe}\n" if only_fe else "")
                + (f"    only in the backend:      {only_be}" if only_be else "").rstrip()
            )

    if parsed["taster"] != contract["taster"]:
        problems.append(
            f"FREE_TASTER disagrees:\n"
            f"    lib/tiers.ts: {parsed['taster']}\n"
            f"    backend:      {contract['taster']}"
        )

    for plan, want in contract["prices"].items():
        got = parsed["prices"].get(plan)
        if got != want:
            problems.append(
                f"PRICE[{plan}] disagrees — this is what gets CHARGED:\n"
                f"    lib/tiers.ts: {got}\n"
                f"    backend:      {want}"
            )
    if parsed["prices"]["free"] != {"monthly": 0, "annual": 0}:
        problems.append(f"Free is not free in lib/tiers.ts: {parsed['prices']['free']}")

    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--contract", default=CONTRACT_URL, help="path or URL to tier_contract.json")
    ap.add_argument("--tiers", default=str(pathlib.Path(__file__).parent.parent / "lib" / "tiers.ts"))
    args = ap.parse_args()

    parsed = parse_tiers_ts(pathlib.Path(args.tiers).read_text("utf-8"))
    assert_not_vacuous(parsed)
    contract = fetch_contract(args.contract)

    problems = compare(parsed, contract)
    if problems:
        print("TIER CONTRACT DRIFT — lib/tiers.ts and the backend disagree.\n")
        for p in problems:
            print(f"  • {p}\n")
        print(
            "Fix the mismatch, not this check. If the backend is right, update\n"
            "lib/tiers.ts. If the frontend is right, update entitlements.py /\n"
            "main.py AND aibos-api/tier_contract.json, push aibos-api first, then\n"
            "re-run this. A red here has already caught paying customers being\n"
            "locked out of features they bought."
        )
        return 1

    print(f"Tier contract OK — lib/tiers.ts agrees with {args.contract}")
    print(f"  tiers:  {', '.join(TIERS)}")
    print(f"  taster: {parsed['taster']}")
    print(f"  prices: {parsed['prices']['pro']['monthly']}/{parsed['prices']['proplus']['monthly']}"
          f"/{parsed['prices']['growth']['monthly']} ZMW per month")
    return 0


if __name__ == "__main__":
    sys.exit(main())
