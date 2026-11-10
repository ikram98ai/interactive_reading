# Chapter video blueprint

Every chapter becomes a **section of short lessons**, made the same way, so the series looks, sounds and teaches like one
course. This page has the steps, the lesson types, and the rules for voice, picture and Rust. Chapter 1 of CLRS is the
reference: [`videos/clrs/ch01/`](../../videos/clrs/ch01/), one folder per lesson. When this page and those scripts disagree,
fix one of them.

The format comes from measuring well-regarded programming courses lesson by lesson. A concept is taught with animation
first, then written in code. An exercise is set in the editor and solved in the next lesson. Every lesson is a few minutes
long, opens on its title card, and ends by naming the next one. Their Java becomes our Rust.

Algorithm Alley (`books/clrs`, the CLRS book) is the only book whose pages the recorder can drive. Its videos go in
`videos/clrs/`.

## Steps

Each step has a gate. Don't start the next step until the gate passes.

| #   | Step                     | Command                                                                       | Gate                                                                                       |
| --- | ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | **Plan**                 | `make video-plan PAGE=books/clrs/ch02.html`                                   | You've chosen the concept lessons (a machine each), the code lessons, and two exercises     |
| 2   | **Scaffold**             | `make video-plan PAGE=books/clrs/ch02.html OUT=videos/clrs/ch02`              | One folder per lesson, `NN-name/script.md`, in the order below                             |
| 3   | **Ready the machines**   | edit `books/clrs/chNN.html`                                                   | Every layer a lesson won't explain has a `data-part`; `make smoke` and `make steps` pass    |
| 4   | **Write**                | edit each `script.md`                                                         | No TODO left; every number said aloud has a `{check}`; every `{run}` compiles               |
| 5   | **Silent pass**          | `make video-silent SCRIPT=videos/clrs/ch02/02-…/script.md`                    | No `CHECK FAILED`, `no button`, unknown target, or "typing ran past the voice"             |
| 6   | **Pilot one lesson**     | `make series ONLY=clrs/ch02/05-…`                                             | You've watched one code lesson and one concept lesson at full size                         |
| 7   | **Render and QA**        | `make series ONLY=clrs/ch02`, then `make video-qa VIDEO=…` for each lesson    | No FAIL. Fix every WARN, or write down why it stays                                        |
| 8   | **Publish**              | one YouTube playlist per chapter, one video per lesson, in order, with `.srt` | Each description links the chapter's page                                                  |

## Where things live

```
videos/<book>/<ch>/NN-name/script.md               a lesson's script, the only file git tracks here (<!-- comments --> are never spoken)
videos/<book>/<ch>/NN-name/build/<voice>/          clips, Whisper word times, manifest.json, frames while recording
videos/<book>/<ch>/NN-name/build/rust/             each code snapshot that is run, compiled with rustc
videos/<book>/<ch>/NN-name/NN-name-<voice>.mp4     the lesson, with its .srt captions
```

The voice is `kokoro:bm_fable`, for every lesson. (`kokoro:am_liam` was compared on three lessons and rejected.) Narration is cached per
block, so re-running after an edit only redoes what changed.

## The section

A chapter's lessons follow this order. The numbers come from the reference course, measured lesson by lesson.

| Lesson                     | Kind      | Length       | What happens                                                                                       |
| -------------------------- | --------- | ------------ | -------------------------------------------------------------------------------------------------- |
| `01-introduction`          | `board`   | 20–40 s      | "In this section, we're going to talk about…": one bullet per big idea, then "so let's get started" |
| concept                    | `concept` | 1–3 min      | One idea, animated on the chapter's machine. No code on screen                                     |
| code                       | `code`    | 2–6 min      | The same idea in Rust, typed live: first with the standard library, then built from scratch        |
| `NN-exercise-…`            | `code`    | 30–90 s      | The task, typed as comments in the editor, one example, one hint, and a time to spend on it        |
| `NN-solution-…`            | `code`    | 2–7 min      | The algorithm as comments first, then the code, a run, and a better second version                 |
| …more concepts and code…   |           |              | Two exercises per chapter is right                                                                 |
| `NN-summary`               | `board`   | 1–2 min      | "Let's quickly recap…": one bullet per idea, as it's said                                          |
| `NN-wrap-up`               | `board`   | 20–40 s      | "Congratulations on completing…", where to try the machines, and what the next section covers       |

**Every lesson** opens on its title card, held for three seconds with no voice, which then slides away. It is about one
idea. It ends by naming the next lesson: "Next, we're going to look at…". A concept lesson can show a second machine with
`{goto scene}`, which dips to black.

**The order inside a lesson:**
- **Concept:** the problem, then the animation that shows it, then the name for it, then why it matters.
- **Code:** what we're going to build, then type it while saying what each line does, then run it. When a version works
  but can be better, say so ("this works, but…"), improve it, and run it again.
- **Exercise:** the task in one sentence, then the example typed as comments, then what makes it interesting, then a hint,
  then "spend N minutes on it, then see my solution".
- **Solution:** explain the algorithm first, in comments on a small example, then "that is our algorithm, now let's
  implement it".

## The voice

- **Pace by lesson kind:** concepts at about 190 words a minute, code lessons at about 160, exercises and boards in between.
  `narrate.py` sets Kokoro's speed and the gaps for each `kind`; don't add `{pause}` to slow it down.
- **Person:** say "we" for the work you're doing together, and keep "you" for the viewer's own code.
- **Sentences:** short and declarative, with the occasional longer one that carries a "because" or a "so".
- **Show, then name:** "That's called the sorting problem." Then give the definition, in the book's words when it has them.
- **Signposts:** "Now", "So", "Let's say", "There you go", "Look, we have a compilation error". Ask a question just before a
  surprise ("So what do you think is going to happen?").
- **Numbers:** never read numbers off the screen. The lint stops a sentence that recites more than two, and it stops digits
  and symbols: write "ampersand mut", not `&mut`.
- **Checks:** check every number you say against the machine or the run with `{check selector ~ text}`. In the editor, the
  run panel is `#out`. A run fails when the page disagrees with the narration.
- **Warmth:** keep a little ("Now here's where it gets interesting", "Beautiful"), with no hype and no filler.
- **Our own voice:** never name another channel, tutor or course in a video.

## Sounding like a person

The reference course sounds like a teacher at a keyboard, not a narrator reading a script. These habits do that, and every
lesson should have a few of them. They are not filler: each one carries a reason, a warning, or a choice.

- **First person for your own actions:** "I'm going to add a function here", "let me show you a shortcut", "I'd rather not
  convert this twice, so let's store it in a variable". Keep "we" for the reasoning you do together.
- **Say why you did it:** "I made this private, because it's an implementation detail", "I'm using a small example, so we
  can see every step".
- **Ask, then answer:** "What do you think is going to happen? Well, let's take a look." Use it before every run whose
  result could surprise, and before every compiler error.
- **Judge your own code out loud:** "This works, but it looks repetitive", "That's better", "There's a problem with this".
- **Honest asides:** "That's an advanced topic, so let's not worry about it for now", "In a real program, you'd also check
  for an empty list", "This one comes up a lot in interviews".
- **Encourage on exercises:** "Do your best to solve it on your own, even if it takes half an hour. Trust me, it's easier
  than you think", then the time to spend on it.
- **Small reactions:** "There you go", "Beautiful", "Easy, right?", "Look at that". About one a minute.
- **Simplify on purpose, and say so:** "For simplicity, let's assume all the numbers are positive", "we can always improve
  this later".

## Between chapters

The series is one course, so each section knows what came before it:

- **`01-introduction`** opens with one sentence on the previous section ("In the last section, you learned what an algorithm
  is, and wrote insertion sort in Rust"), then says what this one adds.
- **Concepts and code reuse what the viewer already has.** Start from the earlier code and examples (insertion sort, the
  numbers 31, 41, 59, 26, 41, 58, the card analogy, the race) and say so: "Remember the race from the last section?".
  Don't re-explain a Rust idea an earlier chapter taught; use it, with a short reminder ("as you learned, ampersand mut
  lends the vector").
- **The wrap-up** names the next section and the one thing it builds on from this one.
- **Lesson titles** follow the same pattern in every chapter: "Exercise: …", "Solution: …", "… in Rust", "Summary", "Wrap Up".

## The picture

**Concept lessons** use the chapter's machine:
- **Nothing is on screen until it's named.** The code panel and stats start hidden and the picture is centred. `{show stats}`
  brings the counters in. Hide layers the lesson doesn't explain: `{hide s1ptr}`, where
  `s1ptr: css:#s1-svg [data-part=pointers]` is in the script's `targets:`.
- **One change at a time.** Aim for six to ten changes a minute, with the machine still most of the time.
- **No silent motion.** Talk over every `{click Play}` and `{click Run}`, and raise `{speed}` until the narration outlasts the
  animation.
- **Cues sit on the noun.** Put `{focus}`, `{label}` and `{click}` right before the word that names the thing.
- **Tools:** `{label}` gives a small heading for the current idea; `{focus}` draws a thin ring and dims nothing;
  `{card big | small}` is for the one takeaway a lesson should leave.

**Code lessons** use the editor (`tools/video/editor.html`): one Rust file, zoomed so about fifteen lines fill the frame.
- **Snapshots:** the script keeps each state of the file as a fenced block, ` ```rust @name `, which is never spoken.
  `{code name}` types from the current text to that snapshot while the voice goes on; `{code name fast}` is for long blocks
  the narration summarises.
- **Pointing:** `{select text}` highlights code while you talk about it, the way you'd select it with a mouse; `{unselect}`
  clears it.
- **Running:** `{run}` opens the run panel with the program's real output, because `narrate.py` compiles and runs each
  snapshot with `rustc`. `{run error}` shows the compiler's real error, which is how a lesson teaches the borrow checker:
  write the natural thing, run it, read the error, then fix it. `{close}` hides the panel before the next edit.
- **Exercises** are set as comments in the editor: the function's name, an example input and output, and the constraint.

**Boards** (`kind: board`) give a heading and lines that appear as they're said: `{board heading}`, `{bullet …}`, `{sub …}`,
`{mono …}`. A second `{board}` starts a fresh one.

Dark mode only, at 1920×1080. Studio sets this.

## Rust, across the series

Code lessons teach Rust one idea at a time, at the moment the algorithm needs it, usually through a real compiler error.
Follow this order and don't re-teach what an earlier chapter covered:

1. Ownership: every value has one owner. Passing a `Vec` moves it (ch01, insertion sort: E0382)
2. Borrowing: `&mut` lends without giving away, and small values are copied (ch01)
3. Moves and `Box`: `take()` moves out of a borrow, ownership passes along a chain, and freeing is automatic (ch01, linked list: E0507)
4. Shared `&` borrows: many readers at once, or one writer (ch01 duplicates; ch02)
5. `clone()` for data you change but also keep, then `Option` instead of NIL: `get` returns `None` instead of crashing (ch03)
6. Slices and splitting a borrow, as in divide and conquer: `to_vec()` and `split_at_mut` (ch02)
7. `#[derive(Clone, Copy)]` for small types of your own, and what a borrow costs: a slice is an address and a
   length, the same size whatever it covers (ch04)
8. A `Vec` grows by doubling its capacity, and a `Vec` of `Vec`s is many separate allocations, all freed when the outer
   one drops; then generic functions over `T`, and `&mut` for state that changes on every call, such as a seeded
   pseudorandom generator (ch05)
9. Lifetimes, only when a chapter's data structure needs them

## What the machines must provide

Concept lessons drive the page's own machines with their controls and captions hidden, so a machine has to explain itself.
`tools/authoring/CHAPTER_BRIEF.md` asks new chapters for this. Check older ones in step 3:

- Wrap each layer of the picture in `s("g", { "data-part": "name" })`, such as `input`, `pointers`, `checks` or `key`.
- Draw cells with `AL.cells` / `AL.grid`, which update in place, so colours ease between steps. Fly values as
  `AL.chip(value, { w, h, cls })`, the shape of the cell they land in. Bring new things in with `AL.pop` and `AL.fade`.
- Show a result only once it exists: a check or a verdict pops in at the end, instead of sitting empty with "…".
- Captions carry the real numbers, so `{check}` has something to read.

## The quality bar

`make video-qa VIDEO=…` measures a lesson against the bar for its kind (read from the script beside it) and exits 1 on a FAIL.

| Measure                                               | Concept     | Code                | Board        |
| ----------------------------------------------------- | ----------- | ------------------- | ------------ |
| Pace, words over the whole running time               | 180–195 wpm | 150–175 wpm         | 140–190 wpm  |
| Picture moving                                        | 5–11%       | (typing)            | under 12%    |
| Visual changes                                        | 6–10 a min  | (typing)            | under 14     |
| Longest pause, excluding the title card and the end   | under 3 s   | under 3.5 s         | under 3 s    |
| Silent motion, the picture moving with nobody talking | under 1.5 s | under 3 s           | under 1.5 s  |
| Clutter, the share of the frame that isn't background | under 6%    | (code fills it)     | under 15%    |
