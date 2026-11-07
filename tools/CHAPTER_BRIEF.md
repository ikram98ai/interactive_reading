# Brief: build one interactive chapter page

Hand this file to whoever (or whatever) builds a chapter, together with four facts: the **book slug**
(`ddia`, `csapp`, …), the **chapter number**, the book's **outline of that chapter**, and the
**reference chapter** to imitate — the newest finished page of the same book.

The goal of every page: **Anyone who opens it for the first time can understand every section
of the chapter**, by reading a tiny story and operating a small machine (an interactive SVG simulation).
Each machine should model the real mechanism (state + rules, so the viewer's choices change the
outcome), show concrete readable data instead of anonymous blobs, and be laid out with care so nothing
overlaps, clips, or looks crowded. When a section's idea is a program or an algorithm, the machine can
also have a code panel — real code or pseudocode, with the line it is executing right now highlighted.
Many ideas need no code at all (see "Code panel rules").

**Algorithm Alley's reference is always the elevator scene of `books/algo/ch27.html`** (`#elevator`), the standard for
copy, machine, narration and code. Read that page's head, hero, journey section, that scene (the HTML and the `s1`
script) and the end of the page. The file is large, so skip its other scenes unless you want an example. Older pages
were built before some of these rules and don't all meet them: where a page and this brief differ, follow this brief.

## Step 1 — read, in full, before writing anything

1. The chapter text: `tools/.text/<slug>/chNN.txt` (made by `tools/extract.py`). Read ALL of it,
   sidebars and summary included; ignore the reference list at the end. Page breaks look like
   `=== PDF page N ===`. **Everything the page states as a fact must come from this text** — do not
   import claims, product names, or numbers from memory of other editions or other books.
2. `assets/kit.js` — the shared helper library `K` (all of it).
3. `assets/style.css` — design tokens and every component class (all of it).
4. The reference chapter — all of it: the HTML structure, the tone of the copy, and how each sim is
   coded. The new page must feel like the next page of the same book.
5. `books/csapp/ch01.html` — the reference for the script helpers (`box`, `txt`, `clickable`, `button`,
   `session`) and, if any scene will have a code panel, the `code` helper with its CSS. This applies
   whichever book you are building: the shared kit doesn't have these yet, so copy the ones you use into
   your page.
6. **Algorithm Alley (`algo`) only:** don't copy those helpers. `books/algo/algo.js` and `algo.css` already
   have them (`AL.box`, `AL.session`, …), plus `AL.code` — the book's pseudocode with a Pseudocode | Rust toggle,
   engines highlighting by the book's own line numbers — `AL.mem` for a stack-and-heap strip, `AL.cells` for
   array cells, `AL.grid` for 2-D tables, `AL.tree` for binary trees and `AL.graph` for directed/undirected
   weighted graphs (read each one's comment block in `algo.js`). Load `algo.js` after `kit.js` and copy `books/algo/ch01.html`'s script header. Every scene
   gets the book's pseudocode (from whichever chapter states the algorithm) and a complete Rust program in
   `<script type="text/x-rust">` with its real output in `-out`; `tools/rustcheck.py` must pass. Also read the
   "Step-through toolkit" section near the end of `algo.js` and the same block at the end of `algo.css`.

## Step 2 — plan the scenes

**One scene per section and subsection of the chapter's outline**, in the book's own order — not a
fixed number. A 20-section chapter gets about 20 scenes. Each scene = one section = one story = one
machine, plus a code panel only where it helps.

- A subsection with named parts that are each a separate mechanism (CS:APP 1.4.1's *Buses*, *Main
  Memory*, *Processor*; 1.9.2's thread-level, instruction-level and SIMD parallelism) gets one scene per
  part.
- A section intro that only sets up its subsections (CS:APP 1.9 "Important Themes") shares a scene with
  its first subsection; one whose text has its own idea (1.4's shell, 1.7's two purposes of the OS) gets
  its own scene.
- A section with several separate points (CS:APP 1.3's three reasons) is one scene with modes (`K.seg`).
- The chapter's summary section becomes the summary cards, not a machine.

For each scene, decide: the everyday story, what the machine shows, what the viewer controls, the
"aha", what breaks when they push it, and **whether it gets a code panel** — real code, pseudocode, or
none (see "Code panel rules").

## Page structure (copy the reference chapter's skeleton exactly)

- `<head>`: same meta, same Google Fonts link, `../../assets/style.css`, `<title>Ch N · Short name</title>`,
  and a small page `<style>` for extras — CSS variables only, never hard-coded colours, so both themes work.
- `<header id="topbar"></header>`
- Hero: `.ch-tag` with the number, `<h1>` = the book's chapter title, a `.lede` of one or two kid-level
  sentences, `.quote` = the chapter's epigraph (exact words, with attribution) if it has one, a `.toc`
  linking to every scene (each link starts with its section number, `<span class="n">1.4.1</span>`),
  and a `.stage.hero-stage` with a live, auto-playing, tappable SVG that shows the whole chapter in one
  picture.
- One `<section class="scene" id="…">` per section, alternating `scene-grid` and `scene-grid flip`.
  Left: `.copy` with `.eyebrow` ("1.4.1 · section title in lower case"), `<h2>`, 2–3 `.story`
  paragraphs, an `.imagine` box starting `<b>Try it:</b>` that says exactly what to press, and
  `<details class="book"><summary>What the book says</summary>`, ending with a `<p class="cite">` that
  gives the book's printed page numbers and then the section title, e.g. `pp.&nbsp;198–208 · Single-Leader
  Replication` — no author, book title or edition. `kit.js` turns the page numbers into links that open the
  book's PDF at that page.
  Right: `.stage` with `.stage-head` (title + pill / seg / stats), `.stage-scroll > svg` (viewBox 660
  wide, about 300–380 tall, `role="img"` + `aria-label`), `.controls`, an optional `.statrow`, a
  `.caption` with `aria-live="polite"` that narrates what is happening in plain words, and last — only
  if the scene has one — the code panel `<div id="sN-code"></div>`, filled by `code("#sN-code", …)`.
- Summary: "The seesaws from this chapter" as `.tradeoffs` (6–8 rows). If the chapter isn't about
  trade-offs, use `.cards` with the key take-aways.
- "Words to know": `<dl class="words">`, each term explained in one plain sentence.
- Quiz: `<div class="quiz" id="quiz-root">` + `K.quiz(root, items, N)`; 3–4 options each, a `why` for
  every question, and vary which option is correct (use the first and last positions too).
- `<footer id="chapter-end"></footer>`, then `book.js`, `../../assets/kit.js`, then ONE inline `<script>`
  that starts with the reference chapter's destructuring line and `K.page(N);`. Each sim is its own IIFE
  so a bug in one can't break the rest.

**Algorithm Alley adds to this skeleton:**

- A scene's copy column, in order: eyebrow, `<h2>`, `.gist`, 2–3 short `.story` paragraphs, `.decode` (0–2),
  `.whyworks` (0–1), `.mixup` (0–1), `.imagine`, `details.book`.
- Between the hero and the first scene comes `<section class="scene" id="journey">`: an `ol.journey` with one stop per
  main idea in the chapter (3–6 stops, each a `<b>` title and one or two plain sentences), and a `.prep` box saying
  what the reader needs to know. They tell the chapter's story before any machine appears.
- The hero's `.first` box uses the reference page's wording (Next and Back, dotted words).
- Stage order: `.stage-head`, `.stage-scroll > svg`, optional `.controls` for inputs, `.controls` for the walk,
  `.statrow`, `.caption`, optional mem, code. `walk({ id: "s3" })` needs `#s3-controls` and `#s3-cap`.
- Scene ids are short, readable words. Cite printed pages: printed page = PDF page − 22.

## Writing rules

- Story first, jargon second. Short sentences. Everyday pictures (a school, a bakery, a post office, a
  library, a football match…). Introduce a technical word in **bold** only once the idea is already clear.
- Never talk down, no baby talk, no emoji. Friendly, precise, a bit playful.
- "What the book says" is for grown-ups: the book's precise terms, the systems it names, its caveats and
  numbers. 3–5 compact paragraphs, faithful to the text. **Curly quotes mean the book's exact words** —
  if you are paraphrasing, don't use them. (`tools/factcheck.py` enforces this.)
- Captions narrate cause and effect ("Because X, Y happens"), not just "done".
- Use varied, international first names.

### Explain it simply

The reader is a curious person who can program a little and has forgotten most school maths. Assume nothing else.
The class names below are Algorithm Alley's (`algo.css`); other books follow the same rules with their own markup.

1. **Concrete first.** Open with one specific situation with real numbers. The general rule comes after it.
2. **A one-line gist under every `<h2>`** (`.gist`). One sentence, at most 25 words, no symbols and no jargon. If
   someone reads only the gists, they should still get the chapter's story.
3. **Short and plain.** One idea per sentence. Most sentences under 20 words. Common words: "use", not "utilize".
   Banned: clearly, obviously, trivially, simply, note that, it is easy to see, we observe.
4. **Name things last.** Explain the idea, then give it the book's name. Mark a word in `<b>` or
   `<span class="term">` the first time, with its meaning in that same sentence. Every `.term` needs an entry
   in "Words to know" (use `data-w="…"` when the text says it differently, such as a plural).
5. **Every formula gets a `.decode` box**: the formula, what each symbol means in plain words, and a
   **With numbers** line with the arithmetic worked out. Say it in words before showing symbols. Never leave a
   symbol on the page that the reader hasn't been told the meaning of.
6. **Reasons, not proofs.** `.whyworks` gives the intuition for why a method works, in 1–3 sentences. Formal lemmas
   and proofs belong in "What the book says". Use `.mixup` only for a confusion readers really do have.
7. **Check the analogy.** An everyday picture must match the mechanism. If it breaks somewhere important, say where.
8. **Warm up when needed.** If a chapter needs maths the reader may have lost (complex numbers, modular arithmetic,
   matrix equations), add a warm-up scene before its first use, with its own machine. Its eyebrow starts `warm-up ·`,
   and its toc entry uses `<span class="n">start</span>`. Keep it elementary and short, and list it in your report.
9. **Keep rigour too.** "What the book says" stays precise and faithful. Simple copy is not vague copy: nothing in a
   story, caption or gist may be false. If a simplification hides a condition that matters, state the condition.
10. **If the book looks wrong.** Say so only after working the book's own example by hand. Then quote the book exactly,
    mark the correction as this page's reading, and raise it first in your report.

## Simulation rules

**Make each machine a real model.** A small state object, a `render()` that draws from state, and
actions that change state. Let the viewer change an input (`K.seg`, `K.slider`, click a node to crash
it, add events…) and have the result honestly change — including causing the failure the chapter warns
about, then fixing it. Most scenes should offer a compare: the naive way vs the better way. Show live
numbers with `K.stat` when there is something to count.

**Show concrete data.** Real tiny log lines, real keys and values, real event names — readable at a
glance. Keep each example small (4–8 items).

**Animate the mechanism.** Data should visibly travel (`K.fly`, `K.path`, `K.tween`) so the viewer sees
*how* the result came about. Use a Step / Play / Reset flow for multi-step stories and free-play buttons
for sandboxes. All waits go through `K.sleep` / `K.tween` (they respect reduced motion and the speed
setting). Anything that auto-plays runs only while on screen (`K.whenVisible`) and when
`!document.hidden && !K.reduced`. Reset fully restores the start state.

**Run animations through `session()`.** `S.run(async (w) => { await w(fly(…)); })` blocks double-clicks,
and `S.cancel()` (from Reset or a mode switch) makes the old run stop at its next `w(…)` instead of
touching the fresh state. Keep two functions: `reset()` = `S.cancel()` + redraw, and a plain redraw.
**Never call the cancelling `reset()` from inside `S.run`** — the run cancels itself and silently does
nothing. `smoke.js` can't catch this, because a cancelled run throws no error; only the screenshots show it.

**Keep it clean.**
- viewBox width 660; keep every shape and label at least 14px inside its edges.
- Lay out on a grid: aligned columns and rows, equal gaps, consistent box sizes.
- No overlapping text, ever. Estimate ~6.8px per character for 11px mono labels and ~7.5px for 14px body
  text; make boxes wide enough; shorten a label rather than shrink the font (minimum 11px) or hyphenate it.
- Under about 25 text labels visible in one SVG; rows of cells can go over that if dimming makes the live ones
  obvious. If it's crowded, split into modes or steps.
- Colour has meaning: blue = computers/services (`sv-server`), lilac = storage (`sv-db`), yellow = data
  in motion (`sv-data`, `sv-data-soft`), mint = good (`sv-good`), coral = failure (`sv-bad`), grey =
  neutral (`sv-box`, `sv-panel`). `sv-*` classes and CSS variables only.
- Flying things go in a `layer` group appended last — unless they travel *through* boxes, in which case
  put that layer *under* the boxes so parcels never cover the labels.
- Don't put a label on a `K.draw.db` cylinder's middle band: it spans `cy - 2` to `cy - 2 + 0.16 * w`.
- Clickable SVG things: `class="clickable" tabindex="0" role="button" aria-label="…"`, handling click
  and Enter/Space.
- Long sentences belong in the caption, not inside the SVG.

### Keep the animation clean

1. **One change per step.** If two things happen, make two steps. A reader should never ask "what just changed?"
2. **Show where to look.** At most two highlights at a time. Dim what is out of play.
3. **Nothing jumps.** A thing keeps its position from step to step, and space is reserved for things that appear
   later. The viewBox doesn't change between steps. Scales stay fixed, or glide.
4. **Movement means something.** Motion shows data travelling or a value changing. Keep it to 400–600 ms, with no
   bounce, spin or decoration.
5. **Narrate cause and effect, with the actual values.** Talk about the idea, not the line number. Not "Line 7 runs"
   but "7 is smaller than 9, so it moves left." Captions must make sense read aloud with the screen off.
6. **Start and finish well.** Step 1 shows the setup and says what to watch. The last step states the outcome in one
   sentence with its number.
7. **Keep runs short.** 6–30 steps, with an example small enough to check in your head (4–8 items). Use a bigger
   input only to show a trend, in a separate mode, and collapse repetition into one step.
8. **Compute, never type.** Every number on screen comes from a real implementation in the page's script, so changing
   an input honestly changes the outcome. Where the book has a figure, use its numbers as the first example.

### Algorithm Alley: use `AL.walk` for anything with steps

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

## Code panel rules

A code panel sits under a machine and shows the program or algorithm the machine is acting out, so the
viewer can match each animation to a line. **It is optional.** Decide scene by scene:

- **Real code** when the section is about how a program behaves and the reader will meet that code:
  CS:APP's C, assembly, machine-code bytes and `linux>` commands (a loop that misses the cache, a
  buffer overflow, a context switch).
- **Pseudocode** when the idea is an algorithm or protocol with steps the machine walks through, and
  there is no real code worth showing: DDIA's quorum reads and writes, leader election, compaction, a
  hash-partitioning rule, two-phase commit.
- **No panel** when the idea is a concept, a definition, a trade-off, a comparison or a piece of
  history: reliability vs scalability, data models, what "latency" means. Made-up code there only
  adds noise.

The test: would the viewer understand the machine better by following a highlighted line step by
step? If not, leave the panel out. A page can mix all three kinds.

**Pick the code.**
- Real code does what the machine shows. **Verify it:** compile, run, assemble or disassemble it
  (`clang -target x86_64-linux-gnu` works on a Mac) and show the real output, bytes and instruction
  names — never ones recalled from memory. If the book's numbers disagree with the real output, show the
  real output and say so in a comment.
- Pseudocode follows the book's own description of the algorithm, not a textbook version from memory.
  Write it plainly (`for each replica`, `send`, `wait for w acks`, `return`), label the file
  `(pseudocode)`, and use `lang: "text"` (or `"c"` if it is C-like).
- If real code uses invented helper names (`load_and_run`, `keep_copy`), put `(sketch)` in the file name.
- Keep it short (4–16 lines), with short comments (a line under ~70 characters), so the live tags stay
  in view. When a scene has modes, give each mode its own files (`cv.setFiles`, or tabs that switch the
  mode through `onTab`).

**Make it live.**
- `cv.at([lines])` highlights what the machine is doing *now* (`"on"`). Use `"on2"` for a second flow of
  control, `"dim"` for a paused one, and `"good"` / `"bad"` for outcomes.
- `cv.notes({ line: "i = 2" })` puts live values at the ends of lines; `cv.caret(line, col)` marks a
  single character; `cv.out(text)` / `cv.print(text)` show what the program printed.
- The highlight must move in step with the animation, and Reset clears it.

**Algorithm Alley's Rust.** Use the book's pseudocode where it gives one. Where it states only a formula, write it as
short procedures and say so in the book box. Build each panel's `map` with `AL.rmap(src("rs-s1"), { 3: "let mut worst" })`,
which finds Rust lines by their text, so the highlight can't drift when the program changes; don't hand-count line
numbers. Rust stays standard-library only and deterministic: printed output must not vary between runs (write a small
LCG where you need randomness; join threads before printing). Comments explain the idea in plain words. `AL.mem` is
optional: use it only where ownership or memory really teaches something.

## Technical constraints

- No external libraries, no images, no build step. Plain ES2020 in one inline `<script>`.
- The deploy check concatenates inline scripts and runs `new Function(src)`; it must parse. Every local
  `href`/`src` must exist.
- No `localStorage` (K handles progress), no `alert`/`prompt`. The one exception is the theme line in
  `<head>` copied from the reference chapter; `audit.py` flags it on every page, so ignore that single
  flag. Every element id unique; prefix sim ids `s1-…`, `s2-…`.
- No horizontal page scroll at 390px wide (wide SVGs go inside `.stage-scroll`).
- **Only create or modify your own `chNN.html`.** The shared kit, the stylesheet, `book.js` and the index
  pages are someone else's job. If a shared helper has a bug or a gap, work around it in your page and say so in your
  report. Don't commit.

## Writing a 250 KB file without choking

With one scene per section, a page runs to 250 KB or more. Write it in passes: first the full HTML
(head, hero, every scene's copy and stage shells, summary, words, quiz container, footer, and a script
with the header lines, the helpers, the quiz data and a marker comment such as `/* ==SIMS== */`). Then
add the sims three to five at a time, inserting above the marker, and run the smoke test on those stages
(`--only=N`) before the next pass. Remove the marker at the end.

## Step 3 — test until clean (mandatory)

```
node tools/smoke.js    books/<slug>/chNN.html --light      # and again with --dark
node tools/play.js     books/<slug>/chNN.html --light      # then --seg=1 for the second mode of each sim
python3 tools/audit.py books/<slug>/chNN.html
python3 tools/factcheck.py <slug> N
node tools/check-site.js
```

Algorithm Alley also runs these, and steps.js must pass:

```
node tools/steps.js    books/algo/chNN.html --light        # every step of every mode: overlaps, clipping, Back works
node tools/steps.js    books/algo/chNN.html --dark --shots=2
node tools/rustview.js books/algo/chNN.html                # steps where the Rust listing lights up nothing
node tools/interact.js books/algo/chNN.html                # used as a reader would: speed, keys, touch
python3 tools/rustcheck.py books/algo/chNN.html
```

Open at least the first, middle and last step of every scene, and judge them as a reader would. Passing the checks is
not the bar: could someone new to this topic tell what is happening from the picture and caption alone? If not, change
it. Then reread your copy against "Explain it simply".

Fix everything `smoke.js` prints. Then **look at the screenshots** in `tools/.shots/` — every
`-played` shot and the `-b` shots — and fix what looks wrong: overlapping or clipped text, misalignment,
leftover flying parcels, crowded areas, labels hugging an edge, poor contrast in either theme, code-panel
tags pushed out of view, and a run that ended half-way. Re-run the stages you changed (`--only=N`) and
look again.

- **Dark theme:** pages now follow their own sun/moon switch (light by default), not the OS setting, so
  `--dark` no longer shows the dark theme. Check it by switching the page itself — run
  `K.applyTheme("dark")` in the page before taking the screenshot — and look at every mode of every stage.
- **One mode per play:** `play.js` presses only the first primary button of the first mode. Each extra
  mode, and any machine that needs several presses, needs `--seg=K` / `--presses=N` or a screenshot you
  take yourself.

Read every flag from `factcheck.py`; a flagged quotation is always a fix. If the sentence really is the
book's, check whether it runs across a `=== PDF page N ===` break with a figure's labels in between;
if it does, paraphrase it without curly quotes rather than splitting it into fragments.

## Final report

List the scenes (id, section number, title, what the machine does, and its code panel: real code,
pseudocode, or none), anything from the chapter you left out and why, warm-up scenes you added, shared-helper gaps you
worked around, the final output of each check, and any rough edges. Say plainly what is unfinished or unverified; which details are your own
illustrations or toy numbers rather than the book's; which code panels were compiled or run and which
are sketches or pseudocode; and any place where real output disagreed with the book.
