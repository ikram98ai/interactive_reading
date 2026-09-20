# tools/

Local checks for chapter pages. Nothing here is published — the deploy workflow only ships
`index.html`, `assets/` and `books/`.

## One-time setup

```
cd tools && npm install                                        # puppeteer-core; drives the Chrome you already have
python3 -m venv .venv && .venv/bin/pip install pypdf fonttools # only extract.py needs this
```

`smoke.js` and `play.js` look for Chrome or Chromium in the usual places; set `CHROME_PATH` if yours
lives elsewhere. `audit.py`, `factcheck.py` and `check-site.js` need nothing installed.

## Building a chapter

```
tools/.venv/bin/python tools/extract.py books/ddia/ddia.pdf --list    # see the PDF's outline
tools/.venv/bin/python tools/extract.py books/ddia/ddia.pdf ddia 11   # → tools/.text/ddia/ch11.txt
```

DDIA's outline says "Chapter 11. …", so the number is enough. CS:APP's doesn't, so pick the entry by
title or give the pages: `… csapp 7 --title Linking` or `… csapp 7 --pages 696-746`.

Then build the page from [CHAPTER_BRIEF.md](CHAPTER_BRIEF.md) — it is written to be handed to the
builder as-is, along with the book slug, chapter number, chapter outline, and the newest finished
chapter of that book as the reference. Afterwards bump `built` in `books/<slug>/book.js` **and** in
`books/books.js`.

## Checking a chapter

| Command | What it catches |
|---|---|
| `node tools/smoke.js books/ddia/ch11.html --light` | Clicks every control in every simulation, rapidly and mid-animation. Fails on JS errors, SVG labels clipped by their viewBox, and sideways scrolling on a phone. Saves before/after screenshots of each stage. |
| `node tools/play.js books/ddia/ch11.html --light` | Presses each simulation's main button, waits for it to settle, and screenshots that. It never fails on looks — **you have to open the PNGs**. This is where overlapping labels and stray parcels show up. `--seg=1` plays each sim's second mode; `--presses=8` fills sandboxes. |
| `python3 tools/audit.py books/ddia/ch1*.html` | Duplicate ids, links to missing anchors, scenes missing from the table of contents, unlabelled SVGs, hard-coded colours, emoji, a quiz whose right answer is always in the same spot. |
| `python3 tools/factcheck.py ddia 11` | Every name, number and “quoted phrase” in the epigraph and the "What the book says" boxes must appear in the chapter's text. Exits 1 on a quotation that isn't the book's exact words. |
| `node tools/check-site.js` | The same parse-and-links check the deploy workflow runs, for the whole site. If this passes, the push will deploy. |

Run `smoke.js` and `play.js` once with `--light` and once with `--dark`: headless Chrome inherits the
OS theme, so without a flag you only ever test one of them. `--only=N` re-runs a single stage while you
fix it (stage 0 is the hero); it skips the page-wide checks, so finish with a full run.

Screenshots land in `tools/.shots/<book>-<chapter>/`. That folder, `tools/.text/` (book text is
copyrighted, like the PDFs), `node_modules/` and `.venv/` are all gitignored.

## What these checks can't tell you

- `factcheck.py` is a hallucination detector, not a proof. A wrong claim made entirely of words the book
  uses will pass, and it only reads the grown-up boxes — not the stories, captions or quiz. It does not
  replace reading the chapter.
- `smoke.js` proves a page doesn't throw; it can't tell whether a simulation teaches the right thing.
- Nothing here tests `prefers-reduced-motion`, keyboard-only use, or a screen reader.
