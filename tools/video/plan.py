#!/usr/bin/env python3
"""plan.py books/clrs/chNN.html [--scaffold videos/clrs/chNN] — step 1 of tools/video/BLUEPRINT.md.

Reads a chapter page and lists what a video can drive in each scene: the machine's modes, buttons, sliders and stats,
whether it has a Rust listing and a stack-and-heap strip (a Rust segment), and which layers are tagged data-part (so the
script can hide them). Use it to choose the six to eight parts.

--scaffold writes script.md in the series' fixed shape, with this inventory as a comment at the top and TODO wherever
words are needed. narrate.py refuses to speak a TODO, so an unfinished script can't be recorded by accident."""
import argparse, html, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
VIDEO_BOOK = {"algo": "clrs"}  # site slug → the folder under videos/


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


def machines(src):
    """Each (function sN() { … }) block, keyed by N."""
    out = {}
    heads = [(m.start(), m.group(1)) for m in re.finditer(r"\(function s(\d+)\(\) \{", src)]
    for i, (at, n) in enumerate(heads):
        out[n] = src[at:heads[i + 1][0] if i + 1 < len(heads) else len(src)]
    return out


def inventory(page):
    src = page.read_text()
    js = machines(src)
    scenes = []
    for m in re.finditer(r'<section class="scene" id="([^"]+)"(.*?)</section>', src, re.S):
        sid, body = m.group(1), m.group(2)
        svg = re.search(r'<svg id="s(\d+)-svg"', body)
        n = svg.group(1) if svg else None
        code = js.get(n, "")
        seg = [text(x) for x in re.findall(r'"([^"]+)"', (re.search(r"seg\(\[(.*?)\]", code, re.S) or [None, ""])[1])]
        scenes.append({
            "id": sid,
            "n": n,
            "eyebrow": text((re.search(r'class="eyebrow">(.*?)</span>', body, re.S) or [None, ""])[1]),
            "heading": text((re.search(r"<h2[^>]*>(.*?)</h2>", body, re.S) or [None, ""])[1]),
            "stage": text((re.search(r'class="stage-title">(.*?)</span>', body, re.S) or [None, ""])[1]),
            "machine": bool(n),
            "picture_only": 'data-code="off"' in body,
            "modes": seg,
            "buttons": list(dict.fromkeys(re.findall(r'button\(\s*\w+,\s*"([^"]+)"', code))),
            "sliders": re.findall(r'label:\s*"([^"]+)"', " ".join(re.findall(r"slider\(\{[^}]*\}", code))),
            "stats": re.findall(r'stat\("([^"]*)"', code),
            "rust": bool(re.search(r'\brs:\s*\{', code)) or f'id="rs-s{n}"' in src,
            "memory": bool(n) and f'id="s{n}-mem"' in body,
            "parts": sorted({a or b for a, b in re.findall(r'"data-part":\s*"([^"]+)"|\bpart\("([^"]+)"\)', code)}),
        })
    title = text((re.search(r"<h1[^>]*>(.*?)</h1>", src, re.S) or [None, ""])[1])
    ch = int(re.search(r"ch(\d+)\.html$", page.name).group(1))
    return title, ch, scenes


def report(page, title, ch, scenes):
    lines = [f"{page.relative_to(ROOT)} · Chapter {ch}: {title} · {sum(s['machine'] for s in scenes)} machines", ""]
    for s in scenes:
        if not s["machine"]:
            lines.append(f"  {s['id']:<14} (no machine) {s['heading']}")
            continue
        tags = [t for t, on in (("RUST+MEMORY", s["memory"]), ("rust", s["rust"] and not s["memory"]), ("picture only", s["picture_only"])) if on]
        lines.append(f"  {s['id']:<14} s{s['n']:<3} {s['heading']}" + (f"   [{', '.join(tags)}]" if tags else ""))
        for k, label in (("modes", "modes"), ("buttons", "buttons"), ("sliders", "sliders"), ("stats", "stats"), ("parts", "data-part")):
            if s[k]: lines.append(f"  {'':<14}      {label}: " + " · ".join(x if x else "(unnamed)" for x in s[k]))
    lines += ["", "RUST+MEMORY scenes can carry a Rust segment (BLUEPRINT.md § Rust segments). A machine with no data-part layers",
              "shows everything it draws; tag the layers the video won't explain before recording (CHAPTER_BRIEF.md)."]
    return "\n".join(lines)


def scaffold(out, page, title, ch, scenes, book):
    live = [s for s in scenes if s["machine"]]
    first = live[0]["id"] if live else scenes[0]["id"]
    inv = report(page, title, ch, scenes).replace("--", "—")
    parts = live[:7]  # a starting point: the author keeps six to eight and folds the rest in as second scenes
    n = len(parts)
    body = [f"<!--\nINVENTORY (from tools/video/plan.py). Pick six to eight parts, one question each; a second machine in the same\npart is a {{goto scene}} with no card. Delete this comment when the plan is settled.\n\n{inv}\n-->",
            f"{{scene}} TODO cold open on the most surprising machine ({first}): ask a question, run it, show the result, and say in one sentence what explains it.",
            "{title} TODO the book and the chapter, and what the viewer will know by the end. Here's what we'll cover.",
            " ".join(f"{{item TODO part {i + 1}}} TODO one clause naming part {i + 1}." for i in range(n)),
            "TODO the Rust promise, what the viewer doesn't need to know already, and: So let's get started."]
    for i, s in enumerate(parts):
        body.append(f"{{goto {s['id']} | Part {i + 1} of {n} | TODO {s['heading'] or 'question'}?}}{{pause 0.6}}")
        body.append(f"{{scene}} TODO problem, then demo, then name, then why it matters. Machine: {', '.join(s['buttons']) or 'no buttons'}"
                    + (f"; modes {', '.join(s['modes'])}" if s["modes"] else "") + ".")
        if s["memory"]:
            body.append("{label In Rust}{hide stats}{split}{show panel}{rust} TODO Rust segment: one ownership idea, shown on the stack and heap.")
        body.append("TODO end on the question the next part answers.")
    body.append(f"{{goto {first} | Recap | What you learned}}{{pause 0.6}}")
    body.append("{scene}" + "".join(f"{{card TODO takeaway {i + 1}}} TODO say takeaway {i + 1}.\n\n" for i in range(n)).rstrip())
    body.append("{card Try every machine yourself. | The link is in the description.} TODO point to the page, then one sentence on what the next chapter's video answers. {pause 0.4}")
    fm = [f"title: TODO {title}", f"kicker: {book} · Chapter {ch}", f"page: {page.relative_to(ROOT)}", f"scene: {first}", "seed: 1", "targets:"]
    out.mkdir(parents=True, exist_ok=True)
    dest = out / "script.md"
    if dest.exists(): sys.exit(f"plan: {dest} already exists; not overwriting it")
    dest.write_text("---\n" + "\n".join(fm) + "\n---\n" + "\n\n".join(body) + "\n")
    return dest


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("page"); ap.add_argument("--scaffold", metavar="DIR")
    a = ap.parse_args()
    page = (ROOT / a.page).resolve() if not pathlib.Path(a.page).is_absolute() else pathlib.Path(a.page)
    title, ch, scenes = inventory(page)
    print(report(page, title, ch, scenes))
    slug = page.parent.name
    if not a.scaffold: print(f"\nnext: plan.py {a.page} --scaffold videos/{VIDEO_BOOK.get(slug, slug)}/ch{ch:02d}")
    if a.scaffold:
        book = re.search(r'book:\s*"([^"]+)"', (page.parent / "book.js").read_text()).group(1)
        dest = scaffold(ROOT / a.scaffold, page, title, ch, scenes, book)
        print(f"\nwrote {dest}: fill in every TODO, then follow BLUEPRINT.md from step 3.")


if __name__ == "__main__":
    main()
