#!/usr/bin/env python3
"""Structural audit of chapter pages — the things a browser won't complain about.

  tools/audit.py books/ddia/ch11.html [more pages…]

Fails (exit 1) on: duplicate ids, in-page links to missing anchors, a table of contents that doesn't match
the scenes, SVGs without an accessible label, hard-coded hex colours (they break the dark theme), emoji,
direct localStorage use, alert(), or a quiz that is missing, unexplained, or always has the same right option."""
import collections, re, sys

SECTIONS_AFTER = {"summary", "words", "quiz", "journey"}  # scenes that are not "big ideas" and needn't be in the toc


def audit(path):
    t = open(path).read()
    problems = []
    ids = re.findall(r'\sid="([^"]+)"', t)
    dup = [k for k, v in collections.Counter(ids).items() if v > 1]
    if dup:
        problems.append(f"duplicate ids: {dup}")
    broken = sorted(a for a in set(re.findall(r'href="#([^"]+)"', t)) if a not in ids)
    if broken:
        problems.append(f"links to missing anchors: {broken}")

    scenes = re.findall(r'<section class="scene" id="([^"]+)"', t)
    toc = re.search(r'<nav class="toc".*?</nav>', t, re.S)
    toc_links = re.findall(r'href="#([^"]+)"', toc.group(0)) if toc else []
    missing_from_toc = [s for s in scenes if s not in SECTIONS_AFTER and s not in toc_links]
    if missing_from_toc:
        problems.append(f"scenes missing from the toc: {missing_from_toc}")
    big = [s for s in scenes if s in toc_links]

    unlabelled = [s for s in re.findall(r"<svg [^>]*>", t) if "aria-label" not in s and "aria-hidden" not in s]
    if unlabelled:
        problems.append(f"{len(unlabelled)} svg(s) without aria-label")
    hexes = re.findall(r'(?<![\w&])#[0-9a-fA-F]{3,8}\b(?=[;"\s,)])', re.sub(r'href="#[^"]*"', "", t))
    if hexes:
        problems.append(f"hard-coded colours (use the CSS variables): {sorted(set(hexes))[:6]}")
    emoji = set(re.findall(r"[\U0001F300-\U0001FAFF]", t))
    if emoji:
        problems.append(f"emoji: {emoji}")
    if "localStorage" in t:
        problems.append("uses localStorage directly (K handles progress)")
    if re.search(r"\balert\(", t):
        problems.append("uses alert()")

    answers, whys = re.findall(r"\banswer:\s*(\d)", t), len(re.findall(r"\bwhy:\s*[\"'`]", t))
    # books differ in quiz length (Data Town asks 6, Bitville 8); what matters is that there is one,
    # every question explains its answer, and the right option isn't always in the same place
    if "K.quiz(" not in t or len(answers) < 4 or whys < len(answers):
        problems.append(f"quiz: K.quiz={'K.quiz(' in t}, {len(answers)} answers, {whys} explanations")
    elif len(set(answers)) < 3:
        problems.append(f"quiz: correct option barely varies {answers}")

    title = re.search(r"<title>(.*?)</title>", t)
    page = re.search(r"K\.page\((\d+)\)", t)
    print(f"{path}: {title.group(1) if title else '—'!r}  K.page({page.group(1) if page else '?'})")
    print(f"   big-idea scenes {len(big)} · book boxes {len(re.findall(r'<details class=.book.>', t))}"
          f" · try-it boxes {len(re.findall(r'class=.imagine.', t))} · live captions {len(re.findall(r'aria-live=.polite.', t))}"
          f" · words {len(re.findall(r'<div class=.word.>', t))} · quiz answers {answers} · {len(t) // 1024} KB")
    for p in problems:
        print("   PROBLEM: " + p)
    return not problems


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    results = [audit(p) for p in sys.argv[1:]]  # audit every page before deciding the exit code
    sys.exit(0 if all(results) else 1)
