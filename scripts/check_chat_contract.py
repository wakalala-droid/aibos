#!/usr/bin/env python3
"""Client half of the chat contract — the half that keeps getting forgotten.

AIBOS's recurring failure mode is a capability built on the server whose client
is never wired, with tests covering only the half that exists. This guards the
two places where lib/aiAssistant.tsx must hold up its end of a server contract.

1. ONE `qid` PER QUESTION.
   sendMessage() POSTs /chat/stream and falls back to the buffered /chat on any
   streaming failure, so one question the owner typed reaches the backend twice.
   The backend charges a Free owner's daily taster per QUESTION, keyed on `qid`
   (aibos-api entitlements.chat_taster). Without `qid` in the payload the server
   cannot tell the retry from a new question and charges both — which turned
   "3 free questions a day" into 1-2 and told owners their questions were spent
   after asking two.

   The payload must be built ONCE and reused by both hops. Building it twice
   would mint two qids and reintroduce the bug while looking correct.

2. BOTH HOPS SEND THE SAME PAYLOAD OBJECT.

Stdlib only, no build step — runs in seconds in CI.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "lib" / "aiAssistant.tsx"

problems: list[str] = []

if not SRC.exists():
    print(f"FATAL: {SRC} not found", file=sys.stderr)
    sys.exit(2)

text = SRC.read_text(encoding="utf-8")

# The single payload the two hops share.
m = re.search(r"const payload = JSON\.stringify\(\{(.*?)\n    \}\);", text, re.S)
if not m:
    problems.append(
        "could not find the single `const payload = JSON.stringify({...})`. "
        "Both /chat/stream and /chat must send ONE payload built once."
    )
else:
    body = m.group(1)
    if not re.search(r"\bqid\b", body):
        problems.append(
            "the chat payload does not include `qid`. The backend charges the "
            "Free taster per question keyed on qid; without it the streaming "
            "retry is billed as a second question."
        )

# Exactly one payload construction — two would mean two qids for one question.
built = len(re.findall(r"const payload = JSON\.stringify\(", text))
if built > 1:
    problems.append(
        f"the chat payload is built {built} times. One question must produce "
        "ONE qid; a second construction mints a new one and the fallback gets "
        "charged again."
    )

# qid must be freshly generated per question, not module-level constant.
if "const qid" not in text:
    problems.append("no per-question `const qid` — it must be generated inside sendMessage.")

# Both endpoints must still be called (the fallback is the resilience story).
for ep in ("/chat/stream", "/chat`"):
    if ep not in text:
        problems.append(f"expected a call to {ep!r} in aiAssistant.tsx")

if problems:
    print("CHAT CONTRACT BROKEN — lib/aiAssistant.tsx and the backend disagree.\n")
    for p in problems:
        print(f"  • {p}")
    print(
        "\nFix the mismatch, not this check. The backend half lives in\n"
        "aibos-api/entitlements.py chat_taster(qid=...) and main.py\n"
        "_prepare_chat; test_chat_context.py pins it there."
    )
    sys.exit(1)

print("Chat contract OK — one qid per question, shared by /chat/stream and /chat.")
