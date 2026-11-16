# Page structure (copy the reference chapter's skeleton exactly)

- `<head>`: same meta, same Google Fonts link, `../../assets/style.css`, `<title>Ch N · Short name</title>`, and a small
  page `<style>` for extras — CSS variables only, never hard-coded colours, so both themes work.
- `<header id="topbar"></header>`
- Hero: `.ch-tag` with the number, `<h1>` = the book's chapter title, a `.lede` of one or two kid-level sentences,
  `.quote` = the chapter's epigraph (exact words, with attribution) if it has one, a `.toc` linking to every scene (each
  link starts with its section number, `<span class="n">1.4.1</span>`), and a `.stage.hero-stage` with a live,
  auto-playing, tappable SVG that shows the whole chapter in one picture.
- One `<section class="scene" id="…">` per section, alternating `scene-grid` and `scene-grid flip`.
  Left: `.copy` with `.eyebrow` ("1.4.1 · section title in lower case"), `<h2>`, a one-line gist (writing.md, "Explain
  it simply"), 2–3 `.story` paragraphs, an `.imagine`
  box starting `<b>Try it:</b>` that says exactly what to press, and `<details class="book"><summary>What the book
  says</summary>`, ending with a `<p class="cite">` that gives the book's printed page numbers and then the section title,
  e.g. `pp.&nbsp;198–208 · Single-Leader Replication` — no author, book title or edition. `kit.js` turns the page numbers
  into links that open the book's PDF at that page. (`book.json` `printed_page_offset`, where set, is PDF page minus
  printed page.)
  Right: `.stage` with `.stage-head` (title + pill / seg / stats), `.stage-scroll > svg` (viewBox 660 wide, about
  300–380 tall, `role="img"` + `aria-label`), `.controls`, an optional `.statrow`, a `.caption` with
  `aria-live="polite"` that narrates what is happening in plain words, and last — only if the scene has one — the code
  panel `<div id="sN-code"></div>`, filled by `code("#sN-code", …)`.
- Summary: "The seesaws from this chapter" as `.tradeoffs` (6–8 rows). If the chapter isn't about trade-offs, use
  `.cards` with the key take-aways.
- "Words to know": `<dl class="words">`, each term explained in one plain sentence.
- Quiz: `<div class="quiz" id="quiz-root">` + `K.quiz(root, items, N)`; 3–4 options each, a `why` for every question, and
  vary which option is correct (use the first and last positions too).
- `<footer id="chapter-end"></footer>`, then `book.js`, `../../assets/kit.js`, then ONE inline `<script>` that starts
  with the reference chapter's destructuring line and `K.page(N);`. Each sim is its own IIFE so a bug in one can't break
  the rest.

A book's reference chapter may add to this skeleton; follow it (CLRS adds a journey section, a fixed copy-column order with its
`.gist` / `.decode` / `.whyworks` / `.mixup` classes, and a fixed stage order).
