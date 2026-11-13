# Building a page for Introduction to Algorithms (CLRS)

What a CLRS chapter page adds to the general rules in the `build-chapter-page` skill. Read this after the skill's
`SKILL.md`, before planning scenes. The facts tools need (helper files, reference scene, extra checks, page offset) are in
[book.json](book.json).

## The reference

**The reference is always the elevator scene of `books/clrs/ch27.html`** (`#elevator`), the standard for copy, machine,
narration and code. Read that page's head, hero, journey section, that scene (the HTML and the `s1` script) and the end
of the page. The file is large, so skip its other scenes unless you want an example. Older pages were built before some
of these rules and don't all meet them: where a page and these rules differ, follow the rules.

## Helpers: `algo.js` and `algo.css`

Don't copy the csapp script helpers. `books/clrs/algo.js` and `algo.css` already have them (`AL.box`, `AL.session`, …),
plus `AL.code` — the book's pseudocode with a Pseudocode | Rust toggle, engines highlighting by the book's own line
numbers — `AL.mem` for a stack-and-heap strip, `AL.cells` for array cells, `AL.grid` for 2-D tables, `AL.tree` for binary
trees and `AL.graph` for directed/undirected weighted graphs (read each one's comment block in `algo.js`). Load `algo.js`
after `kit.js` and copy `books/clrs/ch01.html`'s script header. Every scene gets the book's pseudocode (from whichever
chapter states the algorithm) and a complete Rust program in `<script type="text/x-rust">` with its real output in `-out`;
`tools/static/rustcheck.py` must pass. Also read the "Step-through toolkit" section near the end of `algo.js` and the same
block at the end of `algo.css`.

## What CLRS adds to the page skeleton

- A scene's copy column, in order: eyebrow, `<h2>`, `.gist`, 2–3 short `.story` paragraphs, `.decode` (0–2),
  `.whyworks` (0–1), `.mixup` (0–1), `.imagine`, `details.book`.
- Between the hero and the first scene comes `<section class="scene" id="journey">`: an `ol.journey` with one stop per
  main idea in the chapter (3–6 stops, each a `<b>` title and one or two plain sentences), and a `.prep` box saying
  what the reader needs to know. They tell the chapter's story before any machine appears.
- The hero's `.first` box uses the reference page's wording (Next and Back, dotted words).
- Stage order: `.stage-head`, `.stage-scroll > svg`, optional `.controls` for inputs, `.controls` for the walk,
  `.statrow`, `.caption`, optional mem, code. `walk({ id: "s3" })` needs `#s3-controls` and `#s3-cap`.
- Scene ids are short, readable words. Cite printed pages: printed page = PDF page − 22.

The class names in the skill's "Explain it simply" rules (`.gist`, `.decode`, `.whyworks`, `.mixup`, `.term`) are this
book's (`algo.css`); other books follow the same rules with their own markup.

## Use `AL.walk` for anything with steps

It gives Start over / Back / Next / Play and a step slider, and a two-part caption. All steps are computed up front as
plain data, and `paint(frame)` redraws from one frame. That is why Back works. Free-play machines are fine only when
experimenting is the point, and they still narrate. `morph: 520` glides between frames, and `w.send` flies a value.
`say` is what happened, `why` is the reason when one is worth saying, and the last step has `phase: "Result"` and a
`tone`. Colour classes: `on` (amber) the thing being worked on now, `on2` (blue) its partner or a second flow, `good`
(mint) finished or correct, `bad` (coral) wrong or in conflict, `sorted` (lilac) settled or yours, `dim` out of play.
Add an `AL.legend` at a fixed place when colours carry meaning. The viewBox can go up to about 420 tall.

Pitfalls the toolkit can't catch for you:

- `paint` must not read anything except the frame it is given (plus constants). Inputs go into the frames.
- With `morph`, numeric frame fields are in-between values while moving. Use `Math.round` wherever a whole number
  is printed, and keep ids and indices as strings or look them up from the destination frame, so they don't
  interpolate into nonsense. Check any division for a zero.
- Inside `enter`, animate only through `w` (`w.morph`, `w.tween`, `w.send`, `w(K.sleep(…))`). A plain `K.tween` keeps
  running after Back and paints over the new step.
- `lines`, `notes`, `notesRust`, `mark`, `out`, `say`, `why`, `phase`, `tone` and `hold` are reserved frame fields:
  `walk` acts on them. Name your own state something else.
- `AL.matrix`, `AL.grid`, `AL.cells`, `AL.tree.draw` and `AL.graph.draw` clear the group you give them, so give each
  one its own `<g>`, or a title drawn into it first silently vanishes. Check every number fits its cell at the slider
  extremes; `steps.js` tests those too.
- Use `AL.plot` for anything on axes, `AL.bars` for comparisons, `AL.matrix` for matrices, `AL.point` for arrows,
  `AL.note` for labels over lines. Add a page `<style>` rule only for what they don't cover, using CSS variables only.

## Rust in the code panel

Use the book's pseudocode where it gives one. Where it states only a formula, write it as short procedures and say so in
the book box. Build each panel's `map` with `AL.rmap(src("rs-s1"), { 3: "let mut worst" })`, which finds Rust lines by
their text, so the highlight can't drift when the program changes; don't hand-count line numbers. Rust stays
standard-library only and deterministic: printed output must not vary between runs (write a small LCG where you need
randomness; join threads before printing). Comments explain the idea in plain words. `AL.mem` is optional: use it only
where ownership or memory really teaches something.

## Ready for the chapter's videos

CLRS chapters also become narrated videos (the `write-video-script` skill), recorded with the controls and captions
hidden. Besides the general machine rules for videos, use this book's helpers: draw cells with `AL.cells` / `AL.grid`
(they update in place, so colours ease between steps), fly values as `AL.chip(value, { w, h, cls })` (the same shape as
the cell they land in), and bring new things in with `AL.pop` and `AL.fade`, so a result appears only once it exists
rather than as an empty box with "…".

## Extra checks

CLRS runs these after the general checks, and `steps.js` must pass (the list is also in `book.json`, `page.extra_checks`):

```
node tools/browser/steps.js    books/clrs/chNN.html --light        # every step of every mode: overlaps, clipping, Back works
node tools/browser/steps.js    books/clrs/chNN.html --dark --shots=2
node tools/browser/rustview.js books/clrs/chNN.html                # steps where the Rust listing lights up nothing
node tools/browser/interact.js books/clrs/chNN.html                # used as a reader would: speed, keys, touch
python3 tools/static/rustcheck.py books/clrs/chNN.html
```
