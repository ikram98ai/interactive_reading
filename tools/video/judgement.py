#!/usr/bin/env python3
"""judgement.py — the verdict a script needs before narrate.py will narrate it (the judge-video-script skill).

  judgement.py hash   <script.md>                                     print the hash of what viewers read or hear
  judgement.py record <script.md> --verdict pass|fail --report FILE   write <script>.judgement.json beside the script
  judgement.py check  <script.md>                                     exit 0 only if a pass verdict matches the script now
  judgement.py status <dir>                                           check every script.md under a folder

The hash covers what a viewer reads or hears: the spoken text, the title and kicker, the editor's snapshots, and the text
of visible cues ({label}, {card}, {board}, {bullet}, {sub}, {mono}, {item}, {goto}). Timing and pointing cues ({speed},
{pause}, {focus}, {click}, {check}, …) are left out, so retiming a script doesn't need a new judgement; changing its
words does. A cue that puts new words on screen must be added to VISIBLE here."""
import argparse, datetime, hashlib, json, pathlib, re, sys

VISIBLE = {"label", "card", "board", "bullet", "sub", "mono", "item", "goto"}
FENCE = re.compile(r"```(\w+) @([\w-]+)[ \t]*\n(.*?)\n```", re.S)


def viewer_text(path):
    raw = pathlib.Path(path).read_text()
    m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
    front, body = (m.group(1), m.group(2)) if m else ("", raw)
    parts = [f"{k}: {v.strip()}" for k, v in re.findall(r"^(title|kicker):(.*)$", front, re.M)]
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)                       # author's notes: never shown
    parts += [f"@{name}\n{src}" for _, name, src in FENCE.findall(body)]     # the editor's snapshots: read on screen
    body = FENCE.sub("", body)
    words = []
    for tok in re.findall(r"\{[^}]*\}|[^\s{]+", body):
        if tok.startswith("{"):
            op, _, arg = tok[1:-1].strip().partition(" ")
            if op in VISIBLE and arg.strip(): words.append(f"{{{op} {arg.strip()}}}")
        else:
            words.append(tok)
    parts.append(" ".join(words))
    return "\n".join(parts)


def digest(path):
    return hashlib.sha256(viewer_text(path).encode()).hexdigest()[:16]


def verdict_path(path):
    p = pathlib.Path(path)
    return p.with_name(p.stem + ".judgement.json")


def check(path):
    """(ok, why) for narrate.py."""
    v = verdict_path(path)
    if not v.exists(): return False, f"no judgement: {v.name} is missing (hand the script to the script-judge agent)"
    rec = json.loads(v.read_text())
    if rec.get("hash") != digest(path):
        return False, f"judgement is stale: the script's words changed after it was judged on {rec.get('judged_at', '?')}"
    if rec.get("verdict") != "pass": return False, f"judgement failed on {rec.get('judged_at', '?')}: see {v.name}"
    return True, f"judged pass on {rec.get('judged_at', '?')}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("hash").add_argument("script")
    r = sub.add_parser("record"); r.add_argument("script"); r.add_argument("--verdict", choices=["pass", "fail"], required=True)
    r.add_argument("--report", required=True, help="the judge's report for this script (markdown)")
    sub.add_parser("check").add_argument("script")
    sub.add_parser("status").add_argument("dir")
    a = ap.parse_args()
    if a.cmd == "hash":
        print(digest(a.script))
    elif a.cmd == "record":
        rec = {"verdict": a.verdict, "hash": digest(a.script), "judged_at": datetime.datetime.now().astimezone().isoformat(timespec="minutes"),
               "report": pathlib.Path(a.report).read_text()}
        verdict_path(a.script).write_text(json.dumps(rec, indent=1) + "\n")
        print(f"{verdict_path(a.script)}: {a.verdict}")
    elif a.cmd == "check":
        ok, why = check(a.script); print(f"{a.script}: {why}"); sys.exit(0 if ok else 1)
    else:
        bad = 0
        for s in sorted(pathlib.Path(a.dir).rglob("script.md")):
            if "build" in s.parts: continue
            ok, why = check(s); bad += not ok
            print(f"{'ok  ' if ok else 'NO  '} {s}  {why}")
        sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
