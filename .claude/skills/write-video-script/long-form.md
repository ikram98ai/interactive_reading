# The long-form video

`videos/<book>/chNN/script.md` teaches the whole chapter in one video. It's for a viewer who wants the algorithms in
depth, so it has **no time limit**. It runs as long as the chapter needs, as long as it keeps to the method below, which
is the reference course's own method, measured in `videos/demo`. Record it with `narrate.py videos/<book>/chNN/script.md`,
then `studio.js` on its manifest.

**No code language when `book.json` `videos.long_form.language` is false** (CLRS: no Rust). No `{rust}` cue, no stack or
heap, no ownership or borrowing, and no machine number types ("sixty-four-bit float", "a hundred-twenty-eight-bit
integer") in the narration, the agenda or the recap. The code language stays out of the long form. In its place, **each of
the chapter's own algorithms is read in the book's pseudocode, one line at a time**.

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
- **Exercises and Problems** can have a part when they teach something the chapter needs. Give the result and the one
  idea behind it on the machine. Don't solve each sub-part on screen.

## Say it once

A viewer who hears the same point three times stops listening. A long form usually runs 30–45 minutes, so this matters
more here than in a short video.

- **One demonstration per point.** Once the machine has shown a result, don't run it again to confirm it, not at random
  and not on a second input, unless the second run shows something new (a worst case, a failure). Say "run it a thousand
  times and you get the same" without running it, or skip it.
- **Define a term once.** Later parts use it with at most a clause of reminder ("by linearity of expectation, …"). The
  same goes for the pseudocode conventions, the race, the cold open's example and a part's own conclusion: don't restate
  in narration what a `{card}` is about to say, and don't say a moral twice in one part.
- **No summary before the recap.** A part ends on its result and the question that opens the next part. The only summary
  is the recap at the end.
- **Walk one lap, then Play.** After the full lap the method asks for, `{click Play}` the rest while you say what repeats.
  Don't narrate a second lap that does the same thing as the first.
- **Watch the openers.** No more than one sentence in ten starts with "So", "Now" or "Let's". Cut sentences that only
  announce the next one ("Let's see.", "Let's run the scan.", "So let's get started.").

**How each algorithm is taught**, in this order:

1. **The problem**, with a real use: who needs it, and what goes wrong without it.
2. **The idea, animated** on one small example, with no code on screen. Show it, name it, then say why the name fits
   ("this is called chaining, because we chain the items together").
3. **"That's our algorithm. Now let's read it the way the book writes it."** `{split}{show panel}`. The first time a
   chapter shows pseudocode, explain the conventions it uses (indentation is the block, arrays start at one, `//` is a
   comment).
4. **The walk-through.** `{click Step}{focus code:N}`, line by line, on the same example, saying what the line does with
   the values it has right now: "Line two lifts the key. Here, that's forty-one." Walk at least one full lap of every
   loop, and both sides of every `if` the example reaches. Say why each line is there ("we need j, because the inner loop
   walks left").
5. **The rest at speed.** `{click Play}` while you say what repeats, then the result, `{check}`ed against the caption.
6. **What it costs**, or how it can fail, and the drawback that opens the next part.

**Going deep** means building each concept, not stating it. A formula is introduced term by term, then filled in with
the example's numbers ("don't panic, it's simpler than it looks"). A definition is followed by an example that meets it
and one that doesn't. When there are two algorithms for one problem, run both on the same input and compare the counts.
The chapter's other machines (the page usually has more than one part needs) are there to show more, so use them, but where
the book says little, the machine does the showing and the voice stays brief (see "Depth follows the book").

**Finding the steps.** Trace each machine with `make video-trace` before writing its walk-through
([picture.md](picture.md)), so each `{click Step xN}` lands on the line you name and each value you say has a
`{check .is-full .caption ~ …}`.

**Everything else is the same:** the cold open, the title card with an agenda, parts as questions with a `{goto}` card
each, the voice and its pace, one change at a time, cues on the noun, no silent motion, recap cards, and the hook into
the next chapter. Reuse the long forms' running examples (for CLRS: 31, 41, 59, 26, 41, 58, the cards, the race) and keep each lint
rule: no digits or symbols in speech, at most two numbers a sentence, at most 34 words.
