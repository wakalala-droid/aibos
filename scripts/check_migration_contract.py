#!/usr/bin/env python3
"""The migrations on disk here must match the migration the backend expects.

The .sql files live in THIS repo (supabase/migrations/). The code that breaks
when one has not been run lives in the OTHER one, and declares what it needs as
`EXPECTS_MIGRATION`, surfaced by GET /health — which is how the owner confirms
a deploy is really live (Railway pins the last good image on a crash, so a
broken deploy otherwise looks healthy).

Nothing used to compare the two. Add a migration here and forget to bump the
backend, and /health keeps cheerfully reporting the old number while the new
code needs a table that may never have been created. Bump the backend without
adding the .sql, and /health demands a migration that does not exist. Same
duplicated-knowledge shape as every tier bug in
docs/AUDIT_VERIFICATION_2026-07.md.

Exit 0 = the repos agree. Stdlib only — no pip install, seconds in CI.
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

CONTRACT_URL = (
    "https://raw.githubusercontent.com/wakalala-droid/aibos-api/main/schema_contract.json"
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "supabase" / "migrations"


def highest_on_disk() -> tuple[int, str]:
    if not MIGRATIONS.is_dir():
        raise SystemExit(f"FATAL: {MIGRATIONS} not found")
    found: list[tuple[int, str]] = []
    for p in MIGRATIONS.glob("*.sql"):
        m = re.match(r"^(\d+)_", p.name)
        if m:
            found.append((int(m.group(1)), p.name))
    if not found:
        raise SystemExit(
            f"FATAL: no NNNN_*.sql files in {MIGRATIONS} — the parser found "
            "nothing, which would pass forever while drift ships."
        )
    return max(found)


def fetch(src: str) -> dict:
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
        f"COULD NOT REACH THE SCHEMA CONTRACT at {src}\n  {last}\n"
        "This is an infrastructure failure, NOT drift — but it is still red, "
        "because a guard that skips when it cannot check is not a guard."
    )


def main() -> int:
    src = sys.argv[1] if len(sys.argv) > 1 else CONTRACT_URL
    contract = fetch(src)
    expects = contract.get("expects_migration")
    if not isinstance(expects, int):
        raise SystemExit(
            f"schema_contract.json has no integer expects_migration: {expects!r}"
        )

    highest, filename = highest_on_disk()
    if highest != expects:
        print("MIGRATION CONTRACT DRIFT — the two repos disagree.\n")
        print(f"  highest migration here: {highest}  ({filename})")
        print(f"  backend expects:        {expects}")
        print()
        if highest > expects:
            print(
                "  A migration exists that the backend does not know about.\n"
                "  If the new code needs it, bump EXPECTS_MIGRATION in\n"
                "  aibos-api/main.py AND schema_contract.json, and push\n"
                "  aibos-api FIRST."
            )
        else:
            print(
                "  The backend expects a migration that does not exist here.\n"
                "  /health will tell the owner to run a migration they do not\n"
                "  have. Add the .sql, or lower EXPECTS_MIGRATION."
            )
        return 1

    print(
        f"Migration contract OK — {filename} is the highest here, and the "
        f"backend expects {expects}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
