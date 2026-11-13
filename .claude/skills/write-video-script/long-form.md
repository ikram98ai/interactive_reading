# The long-form video

`videos/<book>/chNN/script.md` teaches the whole chapter in one video. It's for a viewer who wants the algorithms in
depth, so it has **no time limit**. It runs as long as the chapter needs, as long as it keeps to the method below, which
is the reference course's own method, measured in `videos/demo`. Record it with `narrate.py videos/<book>/chNN/script.md`,
then `studio.js` on its manifest (`make-series.sh` records the lessons instead).

**No code language when `book.json` `videos.long_form.language` is false** (CLRS: no Rust). No `{rust}` cue, no stack or
heap, and no ownership or borrowing, in the narration, the agenda or the recap. The language belongs to the code lessons.
In its place, **every algorithm is read in the book's pseudocode, one line at a time**.

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
The chapter's other machines (the page has more than the lessons use) are there to go deeper, so use them.

**Finding the steps.** Trace each machine with `make video-trace` before writing its walk-through
([picture.md](picture.md)), so each `{click Step xN}` lands on the line you name and each value you say has a
`{check .is-full .caption ~ …}`.

**Everything else is the same:** the cold open, the title card with an agenda, parts as questions with a `{goto}` card
each, the voice and its pace, one change at a time, cues on the noun, no silent motion, recap cards, and the hook into
the next chapter. Reuse the series' examples (for CLRS: 31, 41, 59, 26, 41, 58, the cards, the race) and keep each lint
rule: no digits or symbols in speech, at most two numbers a sentence, at most 34 words.
