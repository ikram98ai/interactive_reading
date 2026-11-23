# The long-form video

A long-form video teaches one chapter of the book (`videos/<book>/chNN/script.md`; for CLRS, decided 2026-11-22).
It has **no fixed time limit**: it runs as long as its chapter needs, as long as it keeps to the method below, which is
the reference course's own method, measured in `videos/demo`. A CLRS chapter video's parts, depths and estimate are in
its block in `videos/clrs/plan.md`. Record it with `narrate.py <script>`, then `studio.js` on its manifest.

**A CLRS chapter video** also follows the plan's own rules: picture first (the machine carries each idea, the voice
says only what the picture can't), each part tagged WALK, PROOF, ANIM or LINE at the plan's condensed depths, a
"previously" beat of at most two sentences, and each idea taught by the one chapter the plan's ledger names. Its hook
leads into the next chapter's video. `videos/clrs/ch03/script.md` is the model.

**Each algorithm is read in the book's pseudocode, one line at a time**, on the page. What follows it depends on
`book.json` `videos.long_form.language`:

- **false (CLRS): no code language** (`videos/clrs/plan.md` rule 13). No RUST part, no editor, no `{rust}` cue, no
  stack or heap, no ownership or borrowing, and no machine number types ("sixty-four-bit float", "a
  hundred-twenty-eight-bit integer") in the narration, the agenda or the recap. The CLRS Rust programs are the
  Shorts' (`videos/shorts/clrs/plan.md`), never a chapter video's.
- **A language (CS:APP, `"rust"`): every algorithm ends in it.** Once the walk and the cost are done, a RUST part crossfades to the
  editor (`{goto editor}`), types an efficient, executable Rust program for that algorithm (`{code name}`), runs it on
  the walk's own input (`{run}`, with a `{check}` on the output), and comes back (`{goto page}`). It explains each
  core Rust concept the first time a program needs it, and only there: the book's video plan keeps the series' Rust
  concept ledger (which video owns each concept) and every RUST part's program, concepts and efficiency note.
  **The machine comes along.** Put `{side <scene>}` before `{goto editor}`: the algorithm's machine sits on the left of
  the editor, in Rust mode (0-based indices) with its stack-and-heap strip, and the page cues (`{click Step}`,
  `{speed}`, `{focus heap}`, `{check .is-full .caption ~ …}`, `{await}`) drive it while the code is typed on the right.
  Step it on the line being explained (the key lifted on `let key = a[i];`, a card sliding on `a[j] = a[j - 1];`), bring
  the strip in with `{show memory}` when the narration first talks about memory, and `{click Play}` the rest while
  `main` is explained, so the picture shows what the program is doing at every moment. The machine's Rust must be the
  editor's program: the same function signatures and variable names (rename one side if they differ), or the strip shows
  names the code doesn't have. `{side <other scene>}` swaps machines under a dip.
  Anywhere else in the video, Rust stays out: the page parts, the agenda and the recap talk about the algorithm.

## Depth follows the book

Words may run past the book's where they explain a concept the book teaches: a proof built step by step, a formula filled
in with the example's numbers, a definition with one example that meets it and one that doesn't. That is the point of
the long form. What the video must not do is go deep where the book has no content. **Match the depth of the book's own
text**:

- **Line-by-line walks are only for pseudocode the book prints in this chapter.** A procedure the page added (a checker,
  a scan, an evaluator, a memo, a simulator) is never read line by line. Show it running with `{click Play}` and say what
  it does in one or two sentences ("The page checks every node against its parent. Every parent wins.").
- **An algorithm the chapter only names** (chapter 1's Dijkstra, Huffman, DFS, Miller-Rabin; a later chapter's topic
  mentioned in passing) gets its animation and as many sentences as the book gives it, plus one on why it's here. Its
  pseudocode waits for its own chapter.
- **An idea the book states in a sentence or a footnote** (repeated squaring, address arithmetic, the cost of a
  subroutine call) gets a sentence or two over its animation, not a segment.
- **Exercises and Problems** can have a part only when the chapter or section body needs their result; no video sets exercises for the viewer. Give the result and the one
  idea behind it on the machine. Don't solve each sub-part on screen.

## Say it once

A viewer who hears the same point three times stops listening. A chapter video runs ten minutes or more (CLRS Chapter 3
is about 11, Chapter 1 about 20), so this matters more here than in a short video.

- **One demonstration per point.** Once the machine has shown a result, don't run it again to confirm it, not at random
  and not on a second input, unless the second run shows something new (a worst case, a failure). Say "run it a thousand
  times and you get the same" without running it, or skip it.
- **Define a term once.** Later parts use it with at most a clause of reminder ("by linearity of expectation, …"). The
  same goes for the pseudocode conventions, the race, the cold open's example and a part's own conclusion: don't restate
  in narration what a `{card}` is about to say, and don't say a moral twice in one part.
- **Once is not the same as one sentence.** Saying it once means not coming back to it later. It doesn't mean one
  sentence and move on: a definition or a result that matters gets its plain-words restatement right after it ("In
  other words, …"), then a `{beat}` (voice.md, "Write for the ear"). That's one explanation, told for the ear.
- **No summary before the recap.** A part ends on its result and the question that opens the next part. The only summary
  is the recap at the end.
- **Walk one lap, then Play.** After the full lap the method asks for, `{click Play}` the rest while you say what repeats.
  Don't narrate a second lap that does the same thing as the first.
- **Watch the openers.** No more than one sentence in ten starts with "So", "Now" or "Let's". Cut sentences that only
  announce the next one ("Let's see.", "Let's run the scan.", "So let's get started.").

**How each algorithm is taught**, in this order:

1. **The problem**, with a real use: who needs it, and what goes wrong without it.
2. **The idea, animated** on one small example, with no code on screen. Show it, name it, then say why the name fits
   ("this is called chaining, because we chain the items together"). Then say what to take away, in one plain sentence,
   and give it a `{beat}` before the pseudocode.
3. **"That's our algorithm. Now let's read it the way the book writes it."** `{split}{show panel}`. The first time a
   chapter shows pseudocode, explain the conventions it uses (indentation is the block, arrays start at one, `//` is a
   comment).
4. **The walk-through.** `{click Step}{focus code:N}`, line by line, on the same example, saying what the line does with
   the values it has right now: "Line two lifts the key. Here, that's forty-one." Walk at least one full lap of every
   loop, and both sides of every `if` the example reaches. Say why each line is there ("we need j, because the inner loop
   walks left").
5. **The rest at speed.** `{click Play}` while you say what repeats, then the result, `{check}`ed against the caption.
6. **What it costs**, or how it can fail, and the drawback that opens the next part.

**In a CLRS chapter video, steps 3–5 are condensed** to the plan's WALK depth (`videos/clrs/plan.md`, rule 3): step one
full lap of the main loop on the book's own figure, with `{focus code:N}` on the lines that matter, then Play the rest.
A lesser procedure (a helper, a variant) is shown running with its key line focused, and isn't stepped. Where this page
and the plan differ on depth, the plan wins.

**A part reads as the viewer's questions.** Before writing a part, list the questions a first-year student would ask
watching it ("why start at two?", "what if every card is bigger?"), and answer each where it would occur to them. A part
that only follows the book's order of statements, definition after definition, is a reading of the book, not a lesson.

**Going deep** means building each concept, not stating it. A formula is introduced term by term, then filled in with
the example's numbers ("don't panic, it's simpler than it looks"). A definition is followed by an example that meets it
and one that doesn't. When there are two algorithms for one problem, run both on the same input and compare the counts.
The chapter's other machines (the page usually has more than one part needs) are there to show more, so use them, but where
the book says little, the machine does the showing and the voice stays brief (see "Depth follows the book").

**Finding the steps.** Trace each machine with `make video-trace` before writing its walk-through
([picture.md](picture.md)), so each `{click Step xN}` lands on the line you name and each value you say has a
`{check .is-full .caption ~ …}`.

**Everything else is the same:** the cold open, the title card with an agenda, parts as questions with a `{goto}` each
(a dissolve, never shown or read: the part's first sentence carries the viewer over, see voice.md), the voice and its pace, one change at a time, cues on the noun, no silent motion, recap cards, and the hook into
the next chapter's video. For CLRS, each walk runs on the figure the book itself steps through (plan rule 1; Figure 2.2
for insertion sort), and the series' running pictures (the cards, the race) come back where the book reuses them. Keep each lint
rule: no digits or symbols in speech, at most two numbers a sentence, at most 34 words (and, for the ear, at most 25,
with a breath every sixteen words at least: voice.md).
