# Book Simulations

Books I read, turned into interactive explainers — one page per chapter, built so the
ideas are clear even to a ten-year-old. Every chapter page is a set of little machines
you can operate: press buttons, drag sliders, crash computers, watch what happens.

## Layout

```
index.html              the shelf — every book I've started
assets/style.css        design tokens + components (light and dark themes)
assets/kit.js           shared SVG/animation/UI helpers, chapter nav, progress
books/books.js          the list of books shown on the shelf
books/<slug>/book.js    one book's chapter list + how many chapters are built
books/<slug>/index.html that book's chapter route map
books/<slug>/chNN.html  one chapter simulation
```

`book.js` sets `window.BOOK` and loads before `assets/kit.js`, so the shared kit works
for any book. Chapters above `built` show as "coming soon" instead of broken links.

## Adding a chapter simulation

1. Read the chapter.
2. Ask Claude Code for the simulation for that chapter — it writes `books/<slug>/chNN.html`
   and bumps `built` in `books/<slug>/book.js`.
3. `git push` — the site redeploys itself.

## Adding a new book

1. Create `books/<slug>/` with a `book.js` (copy DDIA's and edit the chapter list),
   plus an `index.html` route map.
2. Add an entry to `books/books.js` so it appears on the shelf.
3. Push.

## Deployment

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`/`master`
(and on manual run). It assembles `_site/`, strips any PDFs and `.DS_Store`, checks that
every page's inline JavaScript parses and every local link resolves, then deploys.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Book PDFs are gitignored; only the explainer pages are published.

## Local preview

```
python3 -m http.server 8000     # then open http://localhost:8000
```
