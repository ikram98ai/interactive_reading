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
  gives the book's page numbers and section title.
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

## Writing rules

- Story first, jargon second. Short sentences. Everyday pictures (a school, a bakery, a post office, a
  library, a football match…). Introduce a technical word in **bold** only once the idea is already clear.
- Never talk down, no baby talk, no emoji. Friendly, precise, a bit playful.
- "What the book says" is for grown-ups: the book's precise terms, the systems it names, its caveats and
  numbers. 3–5 compact paragraphs, faithful to the text. **Curly quotes mean the book's exact words** —
  if you are paraphrasing, don't use them. (`tools/factcheck.py` enforces this.)
- Captions narrate cause and effect ("Because X, Y happens"), not just "done".
- Use varied, international first names.

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
  text; make boxes wide enough; shorten a label rather than shrink the font (minimum 10.5px) or hyphenate it.
- At most ~35 text labels visible in one SVG. If it's crowded, split into modes or steps.
- Colour has meaning: blue = computers/services (`sv-server`), lilac = storage (`sv-db`), yellow = data
  in motion (`sv-data`, `sv-data-soft`), mint = good (`sv-good`), coral = failure (`sv-bad`), grey =
  neutral (`sv-box`, `sv-panel`). `sv-*` classes and CSS variables only.
- Flying things go in a `layer` group appended last — unless they travel *through* boxes, in which case
  put that layer *under* the boxes so parcels never cover the labels.
- Don't put a label on a `K.draw.db` cylinder's middle band: it spans `cy - 2` to `cy - 2 + 0.16 * w`.
- Clickable SVG things: `class="clickable" tabindex="0" role="button" aria-label="…"`, handling click
  and Enter/Space.
- Long sentences belong in the caption, not inside the SVG.

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

## Technical constraints

- No external libraries, no images, no build step. Plain ES2020 in one inline `<script>`.
- The deploy check concatenates inline scripts and runs `new Function(src)`; it must parse. Every local
  `href`/`src` must exist.
- No `localStorage` (K handles progress), no `alert`/`prompt`. The one exception is the theme line in
  `<head>` copied from the reference chapter; `audit.py` flags it on every page, so ignore that single
  flag. Every element id unique; prefix sim ids `s1-…`, `s2-…`.
- No horizontal page scroll at 390px wide (wide SVGs go inside `.stage-scroll`).
- **Only create or modify your own `chNN.html`.** The shared kit, the stylesheet, `book.js` and the index
  pages are someone else's job.

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
pseudocode, or none), anything from the chapter you left out and why, the final output of each check,
and any rough edges. Say plainly what is unfinished or unverified; which details are your own
illustrations or toy numbers rather than the book's; which code panels were compiled or run and which
are sketches or pseudocode; and any place where real output disagreed with the book.
