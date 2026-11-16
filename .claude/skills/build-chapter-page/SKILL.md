---
name: build-chapter-page
description: Build or rebuild one interactive chapter page, books/<slug>/chNN.html, for any book in this repo (CLRS, CS:APP, DDIA, or a new one) — the story, machines (SVG simulations), optional code panels, summary, words and quiz, tested until clean. Use for any work that creates or substantially changes a chapter page. Not for video scripts (use write-video-script).
---

# Build one interactive chapter page

You need three facts: the **book slug** (the folder under `books/`, such as `clrs`, `csapp`, `ddia`), the **chapter
number**, and the book's **outline of that chapter**. The **reference chapter** to imitate comes from `book.json` (Step 0).

The goal of every page: **anyone who opens it for the first time can understand every section of the chapter**, by
reading a tiny story and operating a small machine (an interactive SVG simulation). Each machine should model the real
mechanism (state + rules, so the viewer's choices change the outcome), show concrete readable data instead of anonymous
blobs, and be laid out with care so nothing overlaps, clips, or looks crowded. When a section's idea is a program or an
algorithm, the machine can also have a code panel — real code or pseudocode, with the line it is executing right now
highlighted. Many ideas need no code at all ([code-panel.md](code-panel.md)).

## Step 0 — the book's profile

Read `books/<slug>/book.json`. It names the book's real title, its PDF and extracted text, its code language (or none),
its page helpers, its reference page, and any extra checks. The reference
chapter is `page.reference` when it names a page, otherwise the newest finished page of the same book. Older pages were
built before some of these rules and don't all meet them: where a page and these rules differ, follow the rules.

Always call the book by its real title (`title`, or `short` where space is tight), never a made-up site name.

## Step 1 — read, in full, before writing anything

1. The chapter text: `book.json` `text` with NN filled in (made by `tools/authoring/extract.py`). Read ALL of it,
   sidebars and summary included; ignore the reference list at the end. Page breaks look like `=== PDF page N ===`.
   **Everything the page states as a fact must come from this text** — do not import claims, product names, or numbers
   from memory of other editions or other books.
2. `assets/kit.js` — the shared helper library `K` (all of it).
3. `assets/style.css` — design tokens and every component class (all of it).
4. The reference chapter — all of it: the HTML structure, the tone of the copy, and how each sim is coded. The new page
   must feel like the next page of the same book.
5. Script helpers. If `book.json` lists `page.helpers`, use those and don't copy any. Otherwise `books/csapp/ch01.html`
   is the reference for the script helpers (`box`, `txt`, `clickable`, `button`, `session`) and, if any scene will have a
   code panel, the `code` helper with its CSS: the shared kit doesn't have these yet, so copy the ones you use into your
   page.

## Step 2 — plan the scenes

**One scene per section and subsection of the chapter's outline**, in the book's own order — not a fixed number. A
20-section chapter gets about 20 scenes. Each scene = one section = one story = one machine, plus a code panel only where
it helps.

- A subsection with named parts that are each a separate mechanism (CS:APP 1.4.1's _Buses_, _Main Memory_, _Processor_;
  1.9.2's thread-level, instruction-level and SIMD parallelism) gets one scene per part.
- A section intro that only sets up its subsections (CS:APP 1.9 "Important Themes") shares a scene with its first
  subsection; one whose text has its own idea (1.4's shell, 1.7's two purposes of the OS) gets its own scene.
- A section with several separate points (CS:APP 1.3's three reasons) is one scene with modes (`K.seg`).
- The chapter's summary section becomes the summary cards, not a machine.

For each scene, decide: the everyday story, what the machine shows, what the viewer controls, the "aha", what breaks
when they push it, and **whether it gets a code panel** — real code, pseudocode, or none.

## Step 3 — build it

Read each of these before the part of the page it governs:

- [page-structure.md](page-structure.md) — the skeleton to copy exactly: head, hero, scenes, summary, words, quiz, footer.
- [writing.md](writing.md) — the copy: story first, "Explain it simply", "What the book says".
- [machines.md](machines.md) — the simulations: a real model, clean layout, clean animation, and what videos need.
- [code-panel.md](code-panel.md) — when a scene gets a code panel, and how to make it live.
- [testing.md](testing.md) — technical constraints, writing a 250 KB file in passes, and the checks.

**Only create or modify your own `chNN.html`.** The shared kit, the stylesheet, `book.js`, `book.json` and the index
pages are someone else's job. If a shared helper has a bug or a gap, work around it in your page and say so in your
report. Don't commit.

## Step 4 — test until clean (mandatory)

Run every check in [testing.md](testing.md), plus `book.json` `page.extra_checks`, and look at the screenshots. Passing
the checks is not the bar: could someone new to this topic tell what is happening from the picture and caption alone?

## Final report

List the scenes (id, section number, title, what the machine does, and its code panel: real code, pseudocode, or none),
anything from the chapter you left out and why, warm-up scenes you added, shared-helper gaps you worked around, the final
output of each check, and any rough edges. Say plainly what is unfinished or unverified; which details are your own
illustrations or toy numbers rather than the book's; which code panels were compiled or run and which are sketches or
pseudocode; and any place where real output disagreed with the book. If the book looked wrong somewhere, raise that
first.
