# Machines (the simulations)

**Make each machine a real model.** A small state object, a `render()` that draws from state, and actions that change
state. Let the viewer change an input (`K.seg`, `K.slider`, click a node to crash it, add events…) and have the result
honestly change — including causing the failure the chapter warns about, then fixing it. Most scenes should offer a
compare: the naive way vs the better way. Show live numbers with `K.stat` when there is something to count.

**Show concrete data.** Real tiny log lines, real keys and values, real event names — readable at a glance. Keep each
example small (4–8 items).

**Animate the mechanism.** Data should visibly travel (`K.fly`, `K.path`, `K.tween`) so the viewer sees _how_ the result
came about. Use a Step / Play / Reset flow for multi-step stories and free-play buttons for sandboxes. All waits go
through `K.sleep` / `K.tween` (they respect reduced motion and the speed setting). Anything that auto-plays runs only
while on screen (`K.whenVisible`) and when `!document.hidden && !K.reduced`. Reset fully restores the start state.

**Run animations through `session()`.** `S.run(async (w) => { await w(fly(…)); })` blocks double-clicks, and
`S.cancel()` (from Reset or a mode switch) makes the old run stop at its next `w(…)` instead of touching the fresh state.
Keep two functions: `reset()` = `S.cancel()` + redraw, and a plain redraw. **Never call the cancelling `reset()` from
inside `S.run`** — the run cancels itself and silently does nothing. `smoke.js` can't catch this, because a cancelled run
throws no error; only the screenshots show it.

A book's `authoring.md` may name a step-through toolkit to use instead (CLRS: `AL.walk`).

## Keep it clean

- viewBox width 660; keep every shape and label at least 14px inside its edges.
- Lay out on a grid: aligned columns and rows, equal gaps, consistent box sizes.
- No overlapping text, ever. Estimate ~6.8px per character for 11px mono labels and ~7.5px for 14px body text; make
  boxes wide enough; shorten a label rather than shrink the font (minimum 11px) or hyphenate it.
- Under about 25 text labels visible in one SVG; rows of cells can go over that if dimming makes the live ones obvious.
  If it's crowded, split into modes or steps.
- Colour has meaning: blue = computers/services (`sv-server`), lilac = storage (`sv-db`), yellow = data in motion
  (`sv-data`, `sv-data-soft`), mint = good (`sv-good`), coral = failure (`sv-bad`), grey = neutral (`sv-box`,
  `sv-panel`). `sv-*` classes and CSS variables only.
- Flying things go in a `layer` group appended last — unless they travel _through_ boxes, in which case put that layer
  _under_ the boxes so parcels never cover the labels.
- Don't put a label on a `K.draw.db` cylinder's middle band: it spans `cy - 2` to `cy - 2 + 0.16 * w`.
- Clickable SVG things: `class="clickable" tabindex="0" role="button" aria-label="…"`, handling click and Enter/Space.
- Long sentences belong in the caption, not inside the SVG.

## Keep the animation clean

1. **One change per step.** If two things happen, make two steps. A reader should never ask "what just changed?"
2. **Show where to look.** At most two highlights at a time. Dim what is out of play.
3. **Nothing jumps.** A thing keeps its position from step to step, and space is reserved for things that appear later.
   The viewBox doesn't change between steps. Scales stay fixed, or glide.
4. **Movement means something.** Motion shows data travelling or a value changing. Keep it to 400–600 ms, with no
   bounce, spin or decoration.
5. **Narrate cause and effect, with the actual values.** Talk about the idea, not the line number. Not "Line 7 runs" but
   "7 is smaller than 9, so it moves left." Captions must make sense read aloud with the screen off.
6. **Start and finish well.** Step 1 shows the setup and says what to watch. The last step states the outcome in one
   sentence with its number.
7. **Keep runs short.** 6–30 steps, with an example small enough to check in your head (4–8 items). Use a bigger input
   only to show a trend, in a separate mode, and collapse repetition into one step.
8. **Compute, never type.** Every number on screen comes from a real implementation in the page's script, so changing an
   input honestly changes the outcome. Where the book has a figure, use its numbers as the first example.

## Ready for videos

If the book has videos (`book.json` `videos` is not null), its concept lessons drive the page's own machines with their
controls and captions hidden, so a machine has to explain itself. Build every machine so:

- Each layer of the picture is wrapped in `s("g", { "data-part": "name" })`, such as `input`, `pointers`, `checks` or
  `key`, so a script can hide what it doesn't explain.
- Cells update in place, so colours ease between steps, and a value that flies has the shape of the cell it lands in.
  (The book's `authoring.md` names the helpers that do this; CLRS: `AL.cells`, `AL.grid`, `AL.chip`, `AL.pop`, `AL.fade`.)
- A result shows only once it exists: a check or a verdict pops in at the end, instead of sitting empty with "…".
- Captions carry the real numbers, so a script's `{check}` has something to read.

The `write-video-script` skill checks older pages for this before recording.
