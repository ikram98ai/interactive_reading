# Interactive Reading

Books I read, turned into interactive explainers — one page per chapter, built so the
ideas are clear even to anyone. Every chapter page is a set of little machines
you can operate: press buttons, drag sliders, crash computers, watch what happens.

## Layout

```
index.html              the shelf — every book I've started
assets/style.css        design tokens + components (light and dark themes)
assets/kit.js           shared SVG/animation/UI helpers, chapter nav, progress
books/books.js          the list of books shown on the shelf
books/<slug>/book.js    one book's chapter list + how many chapters are built
books/<slug>/book.json  the book's profile for agents: title, PDF, text, helpers, reference page, checks, videos
books/<slug>/index.html that book's chapter route map
books/<slug>/chNN.html  one interactive chapter
books/clrs/algo.js, algo.css   Introduction to Algorithms' own helpers: pseudocode/Rust code panels, the
                        stack-and-heap strip, array cells, 2-D tables, binary trees, graphs, step-through machines
.claude/                the process, as skills and agents (see CLAUDE.md)
tools/                  local checks for chapter pages, and the video tools (not published) — see tools/README.md
videos/                 scripts and videos: gitignored here, with its own local-only git repo
```

`book.js` sets `window.BOOK` and loads before `assets/kit.js`, so the shared kit works
for any book. Chapters above `built` show as "coming soon" instead of broken links.

## Adding a chapter

1. Read the chapter.
2. Ask for the interactive chapter page — it writes `books/<slug>/chNN.html` and nothing else.
   The [`build-chapter-page`](.claude/skills/build-chapter-page/SKILL.md) skill is the brief to build from, with the
   book's own `books/<slug>/book.json` (e.g. [CLRS's](books/clrs/book.json)).
3. Check it: [`tools/`](tools/README.md) clicks through every simulation in a headless browser,
   screenshots them, and checks the page's claims against the book's text.
4. Bump `built` in `books/<slug>/book.js` **and** `books/books.js`.
5. `git push` — the site redeploys itself.

## Adding a new book

1. Create `books/<slug>/` with a `book.js` (copy DDIA's and edit the chapter list),
   an `index.html` route map, and a `book.json` profile (copy DDIA's: `videos: null`, no helpers).
2. Add an entry to `books/books.js` so it appears on the shelf.
3. Push.

## Deployment

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`/`master`
(and on manual run). It assembles `_site/` (book PDFs included), strips `.DS_Store`, checks that
every page's inline JavaScript parses and every local link resolves, then deploys.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Book PDFs are published next to their chapters, so the page-number links open the book.

## Local preview

```
python3 -m http.server 8000     # then open http://localhost:8000
```
