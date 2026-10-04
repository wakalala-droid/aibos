#!/usr/bin/env python3
"""
The design guard (UI/UX audit 2026-10, Part E phase 4).

The October audit found 953 uses of 12 to 14px text, 358 long dashes in
on-screen words, 65 emoji and 163 off-scale corners, each added one at a time
by someone who did not know the rule. The fixes are in; this keeps them in.
It fails on:

  1. text under the floor: a font size below 18px (16px is allowed only for
     spaced capitals, so a 16 or 17 needs "uppercase" within three lines);
     in CSS, anything below 16px, and the --fs-* tokens below their floor
  2. a long dash in words the owner reads (comments are fine)
  3. an emoji in the product
  4. a corner of 4, 5, 8 or 12px (the scale is 6, 10 and 16; cards use 14)

  python3 scripts/check_design_contract.py

Exit 0 = clean. Exit 1 = each problem printed as file:line and what to use.
Python, like the other contract checks, because CI already has it.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CODE_DIRS = ("app", "components", "lib", "hooks")
SKIP = ("node_modules", ".next", "app/admin/design")   # the design page shows the old sizes on purpose

PX = re.compile(r"fontSize:\s*['\"]?(\d+(?:\.\d+)?)(px|rem)?['\"]?\s*[,}]")
RADIUS = re.compile(r"borderRadius:\s*['\"]?(4|5|8|12)(?:px)?['\"]?\s*[,}\s]")
EMOJI = re.compile("[\U0001F000-\U0001FAFF]")
DASH = "—"


def strip_comments(src: str) -> str:
    """Code without comments, keeping line numbers. URLs ("https://") survive
    because a // comment must follow whitespace or start a line."""
    src = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), src, flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", r"\1", line) for line in src.split("\n"))


def size_px(value: str, unit: str | None) -> float:
    n = float(value)
    return n * 16 if unit == "rem" else n


def check_code(path: pathlib.Path, rel: str, problems: list) -> None:
    raw = path.read_text(encoding="utf-8")
    code = strip_comments(raw)
    lines = code.split("\n")
    for i, line in enumerate(lines, 1):
        for m in PX.finditer(line):
            px = size_px(m.group(1), m.group(2))
            if px >= 18:
                continue
            near = " ".join(lines[max(0, i - 4):i + 3]).lower()
            if px >= 16 and "uppercase" in near:
                continue
            problems.append(f"{rel}:{i}: text at {px:g}px; use var(--fs-body) (18px) or var(--fs-caps) for spaced capitals")
        if RADIUS.search(line):
            problems.append(f"{rel}:{i}: corner off the scale; use var(--radius-sm) 6, var(--radius-md) 10 or var(--radius-lg) 16")
        if DASH in line:
            problems.append(f"{rel}:{i}: long dash in on-screen words; use a colon, a comma or two sentences")
        if EMOJI.search(line):
            problems.append(f"{rel}:{i}: emoji in the product; use an icon from the 2px-stroke set or words")


CSS_PX = re.compile(r"font-size:\s*(\d+(?:\.\d+)?)(px|rem)\s*;")
TOKEN_FLOOR = {"--fs-body": 18, "--fs-data": 18, "--fs-label": 18, "--fs-caps": 16,
               "--fs-h3": 20, "--fs-h2": 24, "--fs-h1": 30}


def check_css(path: pathlib.Path, rel: str, problems: list) -> None:
    text = path.read_text(encoding="utf-8")
    for i, line in enumerate(text.split("\n"), 1):
        for m in CSS_PX.finditer(line):
            px = size_px(m.group(1), m.group(2))
            if px < 16:
                problems.append(f"{rel}:{i}: font-size {px:g}px is under the 16px floor")
        for token, floor in TOKEN_FLOOR.items():
            t = re.search(rf"{re.escape(token)}:\s*(\d+(?:\.\d+)?)(px|rem)", line)
            if t and size_px(t.group(1), t.group(2)) < floor:
                problems.append(f"{rel}:{i}: {token} is below its {floor}px floor")


def main() -> int:
    problems: list = []
    for d in CODE_DIRS:
        for path in sorted((ROOT / d).rglob("*")):
            rel = path.relative_to(ROOT).as_posix()
            if any(s in rel for s in SKIP):
                continue
            if path.suffix in (".tsx", ".ts"):
                check_code(path, rel, problems)
            elif path.suffix == ".css":
                check_css(path, rel, problems)
    if problems:
        print(f"Design contract: {len(problems)} problem(s)\n")
        print("\n".join(problems))
        return 1
    print("Design contract: clean (sizes, dashes, emoji, corners)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
