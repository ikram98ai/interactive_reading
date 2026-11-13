# Constraints, writing in passes, and checks

## Technical constraints

- No external libraries, no images, no build step. Plain ES2020 in one inline `<script>`.
- The deploy check concatenates inline scripts and runs `new Function(src)`; it must parse. Every local `href`/`src`
  must exist.
- No `localStorage` (K handles progress), no `alert`/`prompt`. The one exception is the theme line in `<head>` copied
  from the reference chapter; `audit.py` flags it on every page, so ignore that single flag. Every element id unique;
  prefix sim ids `s1-…`, `s2-…`.
- No horizontal page scroll at 390px wide (wide SVGs go inside `.stage-scroll`).

## Writing a 250 KB file without choking

With one scene per section, a page runs to 250 KB or more. Write it in passes: first the full HTML (head, hero, every
scene's copy and stage shells, summary, words, quiz container, footer, and a script with the header lines, the helpers,
the quiz data and a marker comment such as `/* ==SIMS== */`). Then add the sims three to five at a time, inserting above
the marker, and run the smoke test on those stages (`--only=N`) before the next pass. Remove the marker at the end.

## The checks (mandatory)

```
node tools/browser/smoke.js    books/<slug>/chNN.html --light      # and again with --dark
node tools/browser/play.js     books/<slug>/chNN.html --light      # then --seg=1 for the second mode of each sim
python3 tools/static/audit.py books/<slug>/chNN.html
python3 tools/static/factcheck.py <slug> N
node tools/static/check-site.js
```

Then every command in `book.json` `page.extra_checks`, with NN filled in. Each must pass.

Open at least the first, middle and last step of every scene, and judge them as a reader would. Passing the checks is
not the bar: could someone new to this topic tell what is happening from the picture and caption alone? If not, change
it. Then reread your copy against "Explain it simply" ([writing.md](writing.md)).

Fix everything `smoke.js` prints. Then **look at the screenshots** in `tools/.shots/` — every `-played` shot and the
`-b` shots — and fix what looks wrong: overlapping or clipped text, misalignment, leftover flying parcels, crowded areas,
labels hugging an edge, poor contrast in either theme, code-panel tags pushed out of view, and a run that ended half-way.
Re-run the stages you changed (`--only=N`) and look again.

- **Dark theme:** pages follow their own sun/moon switch (light by default), not the OS setting, so `--dark` doesn't
  show the dark theme. Check it by switching the page itself — run `K.applyTheme("dark")` in the page before taking the
  screenshot — and look at every mode of every stage.
- **One mode per play:** `play.js` presses only the first primary button of the first mode. Each extra mode, and any
  machine that needs several presses, needs `--seg=K` / `--presses=N` or a screenshot you take yourself.

Read every flag from `factcheck.py`; a flagged quotation is always a fix. If the sentence really is the book's, check
whether it runs across a `=== PDF page N ===` break with a figure's labels in between; if it does, paraphrase it without
curly quotes rather than splitting it into fragments.
