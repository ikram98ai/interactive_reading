#!/usr/bin/env python3
"""plan.py books/<slug>/chNN.html — step 1 of the write-video-script skill.

Reads a chapter page and lists what a video can drive in each scene: the machine's modes, buttons, sliders and stats,
whether it has a Rust listing and a stack-and-heap strip (a Rust segment), and which layers are tagged data-part (so the
script can hide them). Use it to choose the machine each part of a video drives."""
import argparse, html, pathlib, re

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
    lines += ["", "RUST+MEMORY scenes can show ownership on the stack-and-heap strip in a Rust video. A machine with no data-part layers",
              "shows everything it draws; tag the layers the video won't explain before recording (build-chapter-page skill, machines.md)."]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("page")
    a = ap.parse_args()
    page = (ROOT / a.page).resolve() if not pathlib.Path(a.page).is_absolute() else pathlib.Path(a.page)
    title, ch, scenes = inventory(page)
    print(report(page, title, ch, scenes))


if __name__ == "__main__":
    main()
