#!/usr/bin/env python3
"""Pull one chapter's text out of a book PDF, so it can be read in full and fact-checked against.

  tools/extract.py books/ddia/ddia.pdf --list                     show the PDF's top-level outline with page numbers
  tools/extract.py books/ddia/ddia.pdf ddia 11                    outline entry "Chapter 11…" → tools/.text/ddia/ch11.txt
  tools/extract.py "books/csapp/….pdf" csapp 7 --title Linking    outline entry whose title contains "Linking"
  tools/extract.py "books/csapp/….pdf" csapp 7 --pages 696-746    explicit PDF page range (1-based, inclusive)

A chapter found through the outline runs up to the page before the next top-level entry.
The text is copyrighted: tools/.text/ is gitignored, like the PDFs. Needs pypdf (fonttools lets it decode
the CFF fonts some PDFs use, e.g. the CS:APP one):
  python3 -m venv tools/.venv && tools/.venv/bin/pip install pypdf fonttools     then run with tools/.venv/bin/python
"""
import argparse, logging, pathlib, re, sys

try:
    import pypdf
except ImportError:
    sys.exit("pypdf is missing. Run:  python3 -m venv tools/.venv && tools/.venv/bin/pip install pypdf fonttools\n"
             "then:  tools/.venv/bin/python tools/extract.py …")

HERE = pathlib.Path(__file__).resolve().parent


class FontNote(logging.Filter):
    """pypdf repeats its "fontTools is required" warning for every font on every page (hundreds of long
    lines). Swallow the repeats and say it once at the end instead."""
    seen = 0

    def filter(self, record):
        if "fontTools" in record.getMessage():
            FontNote.seen += 1
            return False
        return True


# The filter must sit on a handler: pypdf logs from child loggers ("pypdf._…"), which skip a parent logger's filters.
_handler = logging.StreamHandler()
_handler.addFilter(FontNote())
logging.getLogger("pypdf").addHandler(_handler)
logging.getLogger("pypdf").propagate = False


def top_level(reader):
    out = []
    for it in reader.outline:
        if isinstance(it, list):
            continue
        try:
            out.append((it.title.strip(), reader.get_destination_page_number(it) + 1))
        except Exception:
            pass
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("slug", nargs="?")
    ap.add_argument("chapter", nargs="?", type=int)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--title", help="pick the outline entry whose title contains this (case-insensitive)")
    ap.add_argument("--pages", help="PDF page range A-B instead of using the outline")
    a = ap.parse_args()

    reader = pypdf.PdfReader(a.pdf)
    entries = top_level(reader)
    if a.list:
        print(f"{len(reader.pages)} pages")
        for title, page in entries:
            print(f"{page:>6}  {title}")
        return
    if not a.slug or a.chapter is None:
        ap.error("need <slug> <chapter> (or --list)")

    if a.pages:
        first, last = (int(x) for x in a.pages.split("-"))
    else:
        if a.title:
            hits = [i for i, (t, _) in enumerate(entries) if a.title.lower() in t.lower()]
        else:
            hits = [i for i, (t, _) in enumerate(entries) if re.match(rf"chapter\s+{a.chapter}\b", t, re.I)]
        if len(hits) != 1:
            sys.exit(f"{len(hits)} outline entries matched — use --list, then --title or --pages.")
        i = hits[0]
        first = entries[i][1]
        last = entries[i + 1][1] - 1 if i + 1 < len(entries) else len(reader.pages)
        print(f"outline: {entries[i][0]!r}")

    parts = [f"\n\n=== PDF page {p} ===\n{reader.pages[p - 1].extract_text() or ''}" for p in range(first, last + 1)]
    out = HERE / ".text" / a.slug / f"ch{a.chapter:02d}.txt"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(parts))
    print(f"pages {first}-{last} → {out.relative_to(HERE.parent)}  ({len(''.join(parts).split())} words)")
    if FontNote.seen:
        print(f"note: this PDF uses CFF fonts and fonttools is not installed ({FontNote.seen} warnings hidden). The text is "
              "usually still fine — skim the output — but `tools/.venv/bin/pip install fonttools` removes the doubt.")


if __name__ == "__main__":
    main()
