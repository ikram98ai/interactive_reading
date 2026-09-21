#!/usr/bin/env python3
"""Flag names, numbers and quotations on a chapter page that don't appear in the book's own text.

  tools/factcheck.py ddia 11        books/ddia/ch11.html  against  tools/.text/ddia/ch11.txt (see extract.py)

Checks the epigraph and every "What the book says" box, because those speak for the book:
  - proper nouns / product names / acronyms
  - numbers with their units
  - anything inside “curly quotes” — it must be the book's words, not a paraphrase

It is a hallucination detector, not a proof of correctness: a claim built only from words the book uses
still passes. Expect a few harmless flags (an ordinary capitalised word); read each one. Exit 1 if a
quotation or the epigraph is not verbatim, since those are always worth fixing."""
import html, pathlib, re, sys, unicodedata

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

STOP = set("""The A An In It If But And Or So This That These Those When Where While With Without For From To Of On At By As Is Are
Was Were Be Both Each Every Some Many Most Other Another Its Their They We You Not No Only Even Also Then There Here One Two Three
First Second Third Instead Because Since After Before Once Such Any All Using Like Unlike However Rather Today Now Still Later Earlier
Either Neither Whether How What Why Which Who Often Usually Typically Examples Example Similarly Thus Hence Finally Book
Chapter Figure Table Part Several Much More Less Just Whatever Whenever Everything Nothing Something Anything Your Our His Her Do Does
Can May Might Must Should Would Could Will Have Has Had Let Note See Think Imagine Say Says Said Called Known Named Give Gives Keep
Keeps Make Makes Run Runs Put Take Read Write Reads Writes Try Add Use Uses Used Need Needs Get Gets Same Different New Old Big Small""".split())


def norm(s):
    s = unicodedata.normalize("NFKC", html.unescape(s))                   # PDF ligatures: "ﬁles" → "files"
    s = s.replace("‐\n", "").replace("-\n", "")                      # undo line-break hyphenation
    s = re.sub(r"\[\s*\d+(?:\s*,\s*\d+)*\s*\]", "", s)                     # citation markers like [12, 13]
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-")):
        s = s.replace(a, b)
    s = re.sub(r"\bY (ou|et)\b", r"Y\1", s)                                # PDF kerning artefacts: "Y ou", "Y et"
    return re.sub(r"\s+", " ", s).lower()


def strip_tags(x):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", x))).strip()


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    slug, n = sys.argv[1], int(sys.argv[2])
    page_path = ROOT / "books" / slug / f"ch{n:02d}.html"
    text_path = HERE / ".text" / slug / f"ch{n:02d}.txt"
    if not text_path.exists():
        sys.exit(f"{text_path.relative_to(ROOT)} is missing — run tools/extract.py first.")
    page, src = page_path.read_text(), norm(text_path.read_text())
    tight = re.sub(r"[^a-z0-9]", "", src)

    def present(term):
        t = norm(term)
        return t in src or re.sub(r"[^a-z0-9]", "", t) in tight

    boxes = [strip_tags(re.sub(r'<p class="cite">.*?</p>', '', m.group(1))) for m in
             re.finditer(r'<details class="book">.*?<div class="inner">(.*?)</div>\s*</details>', page, re.S)]
    print(f"{slug} ch{n}: {len(boxes)} book boxes, {sum(len(b.split()) for b in boxes)} words")

    hard_fail = False
    q = re.search(r'<p class="quote">(.*?)</p>', page, re.S)
    if q:
        inner = re.search(r"“(.+?)”", strip_tags(q.group(1)))
        ok = bool(inner and present(inner.group(1).rstrip(".")))
        print(f"epigraph verbatim: {ok}")
        hard_fail |= not ok

    names, nums, quotes = {}, {}, []
    for bi, b in enumerate(boxes, 1):
        # capitalised / CamelCase / ALLCAPS terms that do not start a sentence
        for m in re.finditer(r"(?<![.!?:]\s)(?<!^)\b([A-Z][A-Za-z0-9]*(?:[-./][A-Za-z0-9]+)*(?:\s+[A-Z][A-Za-z0-9]+)*)", b):
            term = m.group(1)
            if term in STOP or len(term) < 2 or present(term):
                continue
            words = [w for w in term.split() if w not in STOP]
            if words and not all(present(w) for w in words):
                names.setdefault(term, set()).add(bi)
        for m in re.finditer(r"\b\d[\d,.]*\s?(?:%|ms|MB|GB|TB|KB|PB|seconds?|minutes?|hours?|days?|years?|times|x)?", b):
            num = m.group(0).strip()
            if re.fullmatch(r"[0-9]", num):
                continue
            if not present(num) and not present(re.sub(r"[^\d.,]", "", num)):
                nums.setdefault(num, set()).add(bi)
        for m in re.finditer(r"“([^”]{18,})”", b):
            quote = m.group(1).rstrip(".,;:")
            frags = [f.strip(" .,;:") for f in re.split(r"…|\.\.\.|\[[^\]]*\]", quote) if len(f.strip()) > 12]
            if not all(present(f) for f in frags):
                quotes.append((bi, quote))

    for title, found in (("NAMES", names), ("NUMBERS", nums)):
        print(f"\n{title} not found in the chapter text (box #):" + ("" if found else "  none"))
        for k in sorted(found):
            print(f"  {k!r}  boxes {sorted(found[k])}")
    print("\nQUOTATIONS that are not the book's exact words (box #):" + ("" if quotes else "  none"))
    for bi, quote in quotes:
        print(f"  box {bi}: “{quote}”")
    sys.exit(1 if (quotes or hard_fail) else 0)


if __name__ == "__main__":
    main()
