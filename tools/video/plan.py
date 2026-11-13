#!/usr/bin/env python3
"""plan.py books/<slug>/chNN.html [--scaffold videos/<slug>/chNN] — steps 1 and 2 of the write-video-script skill.

Reads a chapter page and lists what a video can drive in each scene: the machine's modes, buttons, sliders and stats,
whether it has a Rust listing and a stack-and-heap strip (a Rust segment), and which layers are tagged data-part (so the
script can hide them). Use it to choose the lessons: a concept lesson per big idea, a code lesson where Rust teaches something.

--scaffold writes one lesson folder per lesson, in the section's order, with this inventory as a comment at the top and TODO wherever
words are needed. narrate.py refuses to speak a TODO, so an unfinished script can't be recorded by accident."""
import argparse, html, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


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
    lines += ["", "RUST+MEMORY scenes can show ownership on the stack-and-heap strip in a code lesson. A machine with no data-part layers",
              "shows everything it draws; tag the layers the video won't explain before recording (build-chapter-page skill, machines.md)."]
    return "\n".join(lines)


def scaffold(out, page, title, ch, scenes, book):
    """One folder per lesson, in the section's order (write-video-script skill, "The section"). Each script starts with TODOs."""
    live = [s for s in scenes if s["machine"]]
    if out.exists() and any(out.glob("[0-9][0-9]-*/script.md")): sys.exit(f"plan: {out} already has lessons; not overwriting them")
    kicker = f"{book} · Chapter {ch}"
    inv = report(page, title, ch, scenes).replace("--", "—")
    lessons = [("introduction", "board", "Introduction", "{board TODO the chapter's subject} TODO In this section, we're going to talk about … {bullet TODO idea} … So let's get started.")]
    exercise = 0
    for s in live[:10]:  # a starting point: keep the machines that carry the chapter's big ideas, fold or drop the rest
        lessons.append((re.sub(r"\W+", "-", s["heading"].lower()).strip("-")[:40] or s["id"], "concept", s["heading"] or s["id"],
                        f"TODO the problem, then the animation, then the name, then why it matters. Machine: {', '.join(s['buttons']) or 'no buttons'}"
                        + (f"; modes {', '.join(s['modes'])}" if s["modes"] else "") + ". TODO Next, we're going to …", s))
        if s["rust"] and exercise < 2 and s["memory"]:
            exercise += 1
            lessons.append((f"exercise-todo-{exercise}", "code", "Exercise: TODO", "TODO the task in one sentence {code s1} TODO the example, typed as comments. TODO a hint. Spend TODO minutes on it, then see my solution."))
            lessons.append((f"solution-todo-{exercise}", "code", "Solution: TODO", "TODO the algorithm, in comments on a small example. That is our algorithm. Now let's implement it. {code s1} TODO {run} TODO Next, …"))
    lessons.append(("summary", "board", "Summary", "{board TODO} Let's quickly recap all the key points you learned in this section. {bullet TODO}"))
    lessons.append(("wrap-up", "board", "Wrap Up", "{board TODO} Congratulations on completing this section. TODO where to try the machines, and what the next section covers."))
    made = []
    for n, (slug, kind, head, body, *rest) in enumerate(lessons, 1):
        d = out / f"{n:02d}-{slug}"; d.mkdir(parents=True, exist_ok=True)
        fm = [f"kind: {kind}", f"title: TODO {head}", f"kicker: {kicker}"]
        if kind == "concept": fm += [f"page: {page.relative_to(ROOT)}", f"scene: {rest[0]['id']}", "seed: 1", "targets:"]
        if kind == "code": fm += ["file: main.rs", "start: s0"]
        code = "```rust @s0\nfn main() {\n}\n```\n\n```rust @s1\nfn main() {\n    // TODO\n}\n```\n\n" if kind == "code" else ""
        note = f"<!--\n{inv}\n-->\n" if n == 1 else ""
        (d / "script.md").write_text("---\n" + "\n".join(fm) + "\n---\n" + note + code + body + "\n")
        made.append(d)
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("page"); ap.add_argument("--scaffold", metavar="DIR")
    a = ap.parse_args()
    page = (ROOT / a.page).resolve() if not pathlib.Path(a.page).is_absolute() else pathlib.Path(a.page)
    title, ch, scenes = inventory(page)
    print(report(page, title, ch, scenes))
    slug = page.parent.name
    if not a.scaffold: print(f"\nnext: plan.py {a.page} --scaffold videos/{slug}/ch{ch:02d}")
    if a.scaffold:
        profile = page.parent / "book.json"   # the book's real title; book.js is the site's copy
        book = json.loads(profile.read_text())["title"] if profile.exists() else re.search(r'book:\s*"([^"]+)"', (page.parent / "book.js").read_text()).group(1)
        dest = scaffold(ROOT / a.scaffold, page, title, ch, scenes, book)
        print(f"\nwrote {len(list(dest.glob('[0-9][0-9]-*/script.md')))} lessons in {dest}: fill in every TODO, then follow the write-video-script skill from step 3.")


if __name__ == "__main__":
    main()
