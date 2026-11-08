# Chapter video blueprint

Every chapter's video is made the same way, so the series looks, sounds and teaches like one course. This page has the
steps, the fixed shape of a video, and the rules for its voice, picture and Rust. Chapter 1 of CLRS is the reference:
[`videos/clrs/ch01/script.md`](../../videos/clrs/ch01/script.md). When this page and that script disagree, fix one of them.

The style comes from measuring well-regarded programming tutorials: a still, nearly empty screen where each change is named as
it happens, and a voice that explains instead of performing. The targets in step 7 are those measurements.

Algorithm Alley (`books/clrs`, the CLRS book) is the only book whose pages the recorder can drive. Its videos go in
`videos/clrs/`.

## Steps

Each step has a gate. Don't start the next step until the gate passes.

| #   | Step                   | Command                                                                                     | Gate                                                                                            |
| --- | ---------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **Plan**               | `make video-plan PAGE=books/clrs/ch02.html`                                                 | You have picked six to eight parts, each one a question with a machine that answers it          |
| 2   | **Scaffold**           | `make video-plan PAGE=books/clrs/ch02.html OUT=videos/clrs/ch02`                            | `videos/clrs/ch02/script.md` exists, in the fixed shape                                         |
| 3   | **Ready the machines** | edit `books/clrs/chNN.html`                                                                 | Every layer the video won't explain has a `data-part`; `make smoke` and `make steps` still pass |
| 4   | **Write**              | edit `script.md`                                                                            | No TODO left; every number said aloud has a `{check}`                                           |
| 5   | **Silent pass**        | `make video-silent SCRIPT=videos/clrs/ch02/script.md`                                       | No `CHECK FAILED`, `no button` or unknown target                                                |
| 6   | **Pilot one part**     | `make video-part SCRIPT=… ONLY="Part 1"`                                                    | You've watched it: the voice, the pacing, and one Rust segment, at full size                    |
| 7   | **Full render and QA** | `make series ONLY=clrs/ch02`, then `make video-qa VIDEO=videos/clrs/ch02/ch02-bm_fable.mp4` | No FAIL. Fix every WARN, or write down why it stays                                             |
| 8   | **Publish**            | upload the `.mp4`; paste `.chapters.txt` into the description; upload the `.srt`            | The description links the chapter's page                                                        |

Step 1 prints every scene with its modes, buttons, sliders and stats. It tags scenes that have a Rust listing and a
stack-and-heap strip with `RUST+MEMORY`, which means they can carry a Rust segment. It also lists the `data-part` layers.
Step 2 writes the inventory into the script as a comment, along with the skeleton below. `narrate.py` refuses any TODO,
so an unfinished script can't be recorded by accident.

## Where things live

```
videos/<book>/<ch>/script.md                   the script, the only file git tracks here (<!-- comments --> are never spoken)
videos/<book>/<ch>/build/<voice>/              clips, Whisper word times, manifest.json, frames while recording
videos/<book>/<ch>/build/<part>/<voice>/       the same for a one-part pilot
videos/<book>/<ch>/<ch>-<voice>.mp4            the video, with its .srt captions and .chapters.txt
```

The voice is `kokoro:bm_fable` (the default). `kokoro:am_liam` is the second voice for the series. Narration is cached per
block, so re-running after an edit only redoes what changed.

## The fixed shape

```
{scene} cold open                       under 45 s. The chapter's most surprising machine: ask a question, run it, show the
                                        result, and say in one sentence what explains it. No title first.
{title} {item …} × parts                "This is chapter N of Introduction to Algorithms…". One {item} per part, each on the
                                        word that names it. Then the Rust promise, "You don't need any math", and
                                        "So let's get started."
{goto id | Part 1 of N | Question?}     six to eight parts. Each is named as the question it answers, and ends on the
  … problem → demo → name → why it      question the next one opens with. A second machine inside a part is {goto id},
  … {label In Rust}{rust} segment       with no card: a quick dip to black and no new YouTube chapter.
{goto id | Recap | What you learned}    one {card} per part, in order, each said in one sentence
{card Try every machine yourself. | The link is in the description.}   then one sentence on what the next chapter answers
```

Inside a part, the order is: the problem, a demo that shows it, the name for it, and why it matters. A worked example
comes before the code, and the code comes before the Rust.

## The voice

- **Pace:** about 190 words a minute. Kokoro's speed and the gaps between blocks are set in `narrate.py`; don't add `{pause}`
  to slow it down.
- **Person:** say "we" for the work you're doing together, and keep "you" for the viewer's own code.
- **Sentences:** short and declarative, with the occasional longer one that carries a "because" or a "so".
- **Show, then name:** "That's called the sorting problem." Then give the definition, in the book's words when it has them.
- **Questions:** ask one just before a surprise ("So which one finishes first?").
- **Numbers:** never read numbers off the screen. The lint stops a sentence that recites more than two, and it stops digits
  and symbols: write "ampersand mut", not `&mut`.
- **Checks:** check every number you say against the machine with `{check selector ~ text}`. A run fails when the page
  disagrees with the narration. Captions and stats can be checked even though the video hides them.
- **Warmth:** keep a little ("Now here's where it gets interesting"), with no hype and no filler.
- **Our own voice:** never name another channel, tutor or course in a video. The style is borrowed, not the name: the lint
  stops a script that says one.

## The picture

- **Nothing is on screen until it's named.** Every scene starts with the code panel and stats hidden and the picture
  centred, so `{show panel}{split}` brings the code in and `{show stats}` the counters. Hide machine layers the video
  doesn't explain: `{hide s1ptr}`, where `s1ptr: css:#s1-svg [data-part=pointers]` is in the script's `targets:`.
- **One change at a time.** Aim for six to ten changes a minute. The machine should be still most of the time, and a
  finished picture can hold while you talk over it.
- **No silent motion.** Talk over every `{click Play}` and `{click Run}`, and raise `{speed}` until the narration outlasts the
  animation. If the log shows "animation took" over a second, the narration is too short.
- **Cues sit on the noun.** Put `{focus}`, `{label}` and `{click}` right before the word that names the thing, and start a
  new idea after a sentence ends.
- **`{label}`** gives a small heading for the current idea or mode, because the page's mode buttons are hidden. Clear it with
  `{label}` when the idea changes.
- **`{focus}`** draws a thin ring around a target and dims nothing. Use it on what the sentence is about, then `{focus off}`.
- **`{card big | small}`** is for a takeaway to remember, about one per part. `{scene}` lifts it.
- **Dark mode** only, at 1920×1080. Studio sets this.

Built-in targets, the same in every chapter: `panel`, `stats`, `memory`, `stack`, `heap`. Code lines are `code:5-7` for
pseudocode and `rs:16` for Rust.

## Rust segments

Teach one or two Rust ideas per segment, through the machine's memory strip. Across the series, follow this order and
don't re-teach what an earlier chapter covered:

1. Ownership: every value has one owner (ch01)
2. Borrowing: `&mut` lends without giving away, and small values are copied (ch01)
3. Moves and `Box`: ownership passes along a chain, and freeing is automatic (ch01)
4. Shared `&` borrows: many readers at once, or one writer (ch02)
5. `clone()` for data you change but also keep, then `Option` instead of NIL: `get` returns `None` instead of crashing (ch03)
6. Slices and splitting a borrow, as in divide and conquer: `to_vec()` and `split_at_mut` (ch02)
7. `#[derive(Clone, Copy)]` for small types of your own, and what a borrow costs: a slice is an address and a
   length, the same size whatever it covers (ch04)
8. A `Vec` grows by doubling its capacity, and a `Vec` of `Vec`s is many separate allocations, all freed when the outer
   one drops; then generic functions over `T`, and `&mut` for state that changes on every call, such as a seeded
   pseudorandom generator (ch05)
9. Lifetimes, only when a chapter's data structure needs them

The segment follows the same steps each time:

1. `{label In Rust}{hide stats}{split}{show panel}{rust}`, then reset the machine to the book's instance. The memory strip
   appears under the listing.
2. Point at the line (`{focus rs:17}`), then at the memory (`{focus stack}` or `{focus heap}`), and say what each one holds.
3. Step through the moment that teaches the idea (the call, the borrow, the move), then let it finish with `{click Play}`.
4. End on what happened to ownership when the call returned or the value moved, then give the idea in one sentence.

## What the machines must provide

The video drives the page's own machines with their controls and captions hidden, so a machine has to explain itself.
`tools/authoring/CHAPTER_BRIEF.md` asks new chapters for this. Check older ones in step 3:

- Wrap each layer of the picture in `s("g", { "data-part": "name" })`, such as `input`, `pointers`, `checks` or `key`.
- Draw cells with `AL.cells` / `AL.grid`, which update in place, so colours ease between steps. Fly values as
  `AL.chip(value, { w, h, cls })`, the shape of the cell they land in. Bring new things in with `AL.pop` and `AL.fade`.
- Show a result only once it exists: a check or a verdict pops in at the end, instead of sitting empty with "…".
- Captions carry the real numbers, so `{check}` has something to read.
- A Rust listing gets a memory strip (`AL.mem`) wherever ownership or memory teaches something.

## The quality bar

`make video-qa` measures these and exits 1 on a FAIL.

| Measure                                               | Target                                  | Reference tutorials | CLRS ch01 |
| ----------------------------------------------------- | --------------------------------------- | ------------------- | --------- |
| Pace, words over the whole running time               | 180–195 wpm                             | 185–193             | 178       |
| Picture moving                                        | 5–11% of the time                       | 5–11%               | 8.4%      |
| Visual changes                                        | 6–10 a minute                           | 6–10                | 12        |
| Longest pause, excluding the ends                     | under 3 s (section cards are about 2.8) | about 3             | 2.8       |
| Silent motion, the picture moving with nobody talking | under 1.5 s                             | none                | 2.0       |
| Clutter, the share of the frame that isn't background | under 6%                                | 2–6%                | 3.7%      |
