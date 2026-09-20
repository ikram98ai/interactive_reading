# Brief: build one interactive chapter page

Hand this file to whoever (or whatever) builds a chapter, together with four facts: the **book slug**
(`ddia`, `csapp`, …), the **chapter number**, the book's **outline of that chapter**, and the
**reference chapter** to imitate — the newest finished page of the same book.

The goal of every page: **a ten-year-old who opens it for the first time can understand each big idea
of the chapter**, by reading a tiny story and then operating a small machine (an interactive SVG
simulation). Each machine should model the real mechanism (state + rules, so the viewer's choices
change the outcome), show concrete readable data instead of anonymous blobs, and be laid out with care
so nothing overlaps, clips, or looks crowded.

## Step 1 — read, in full, before writing anything

1. The chapter text: `tools/.text/<slug>/chNN.txt` (made by `tools/extract.py`). Read ALL of it,
   sidebars and summary included; ignore the reference list at the end. Page breaks look like
   `=== PDF page N ===`. **Everything the page states as a fact must come from this text** — do not
   import claims, product names, or numbers from memory of other editions or other books.
2. `assets/kit.js` — the shared helper library `K` (all of it).
3. `assets/style.css` — design tokens and every component class (all of it).
4. The reference chapter — all of it: the HTML structure, the tone of the copy, and how each sim is
   coded. The new page must feel like the next page of the same book.

## Step 2 — plan the scenes

Pick the chapter's big ideas: **8 to 10 scenes**, in the book's own order, covering every major
heading. Each scene = one idea = one story = one machine. For each, decide: the everyday story, what
the machine shows, what the viewer controls, the "aha", and what breaks when they push it.

## Page structure (copy the reference chapter's skeleton exactly)

- `<head>`: same meta, same Google Fonts link, `../../assets/style.css`, `<title>Ch N · Short name</title>`,
  and a small page `<style>` for extras — CSS variables only, never hard-coded colours, so both themes work.
- `<header id="topbar"></header>`
- Hero: `.ch-tag` with the number, `<h1>` = the book's chapter title, a `.lede` of one or two kid-level
  sentences, `.quote` = the chapter's epigraph (exact words, with attribution) if it has one, a `.toc`
  linking to every scene, and a `.stage.hero-stage` with a live, auto-playing, tappable SVG that shows
  the whole chapter in one picture.
- One `<section class="scene" id="…">` per big idea, alternating `scene-grid` and `scene-grid flip`.
  Left: `.copy` with `.eyebrow` ("Big idea N · topic"), `<h2>`, 2–3 `.story` paragraphs, an `.imagine`
  box starting `<b>Try it:</b>` that says exactly what to press, and
  `<details class="book"><summary>What the book says</summary>`.
  Right: `.stage` with `.stage-head` (title + pill / seg / stats), `.stage-scroll > svg` (viewBox 660
  wide, about 300–380 tall, `role="img"` + `aria-label`), `.controls`, an optional stats row, and a
  `.caption` with `aria-live="polite"` that narrates what is happening in plain words.
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
setting). Guard against double-clicks with a `busy` flag. Anything that auto-plays runs only while on
screen (`K.whenVisible`) and when `!document.hidden && !K.reduced`. Reset fully restores the start state.

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

## Technical constraints

- No external libraries, no images, no build step. Plain ES2020 in one inline `<script>`.
- The deploy check concatenates inline scripts and runs `new Function(src)`; it must parse. Every local
  `href`/`src` must exist.
- No `localStorage` (K handles progress), no `alert`/`prompt`. Every element id unique; prefix sim ids
  `s1-…`, `s2-…`.
- No horizontal page scroll at 390px wide (wide SVGs go inside `.stage-scroll`).
- **Only create or modify your own `chNN.html`.** The shared kit, the stylesheet, `book.js` and the index
  pages are someone else's job.

## Writing a 150 KB file without choking

Write it in passes: first the full HTML (head, hero, every scene's copy and stage shells, summary,
words, quiz container, footer, and a script with the header lines, the flow helper, the quiz data and a
marker comment such as `/* ==SIMS== */`). Then add the sims one or two at a time, inserting above the
marker, and run the smoke test as you go.

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
leftover flying parcels, crowded areas, labels hugging an edge, poor contrast in either theme. Re-run
the stages you changed (`--only=N`) and look again. Read every flag from `factcheck.py`; a flagged
quotation is always a fix.

## Final report

List the scenes (id, title, what the machine does), what you left out of the chapter and why, the final
output of each check, and any rough edges. Say plainly what is unfinished or unverified, and which
details on the page are your own illustrations rather than the book's.
