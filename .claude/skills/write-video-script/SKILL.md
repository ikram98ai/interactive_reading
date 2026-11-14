---
name: write-video-script
description: Plan, scaffold and write a chapter's video scripts — lesson scripts (videos/<book>/chNN/NN-name/script.md) and the chapter's long-form script (videos/<book>/chNN/script.md) — or edit an existing one. Use for any video script work, before narrating. Not for recording (record-video) or uploading (publish-video) or chapter pages (build-chapter-page).
---

# Write a chapter's video scripts

Every chapter of a book with videos becomes up to two outputs, declared in `books/<slug>/book.json` under `videos`:

- **Lessons** (`videos.lessons`): a section of short lessons, made the same way so the series looks, sounds and teaches
  like one course. A concept is taught with animation first, then written in code. An exercise is set in the editor and
  solved in the next lesson. Every lesson is a few minutes long, opens on its title card, and ends by naming the next
  one. The format comes from measuring well-regarded programming courses lesson by lesson; their Java becomes the
  book's language (`book.json` `language`).
- **A long-form video** (`videos.long_form`): `videos/<book>/chNN/script.md`, the whole chapter in one sitting, with its
  own rules in [long-form.md](long-form.md).

Chapter 1 of CLRS is the reference: `videos/clrs/ch01/`, one folder per lesson. When these rules and those scripts
disagree, fix one of them. Today the recorder can drive only CLRS pages (`books/clrs`).

## Before you start

1. Read `books/<slug>/book.json`. If `videos` is null, the book has no videos. If one output is missing, don't make it.
2. Read the book's `guides.curriculum` (for CLRS, `books/clrs/curriculum.md`): everything about the code language — where
   it appears, how lessons teach it, the order the series introduces it.
3. Read [voice.md](voice.md) and [picture.md](picture.md) for every script, and [long-form.md](long-form.md) for a
   long-form one.
4. Call the book by its real title (`book.json` `title`), never a made-up site name, and never name another channel,
   tutor or course.

## Steps

Each step has a gate. Don't start the next step until the gate passes.

| #   | Step                   | Command                                                          | Gate                                                                                     |
| --- | ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **Plan**               | `make video-plan PAGE=books/<slug>/chNN.html`                    | You've chosen the concept lessons (a machine each), the code lessons, and two exercises   |
| 2   | **Scaffold**           | `make video-plan PAGE=books/<slug>/chNN.html OUT=videos/<slug>/chNN` | One folder per lesson, `NN-name/script.md`, in the order below                        |
| 3   | **Ready the machines** | edit `books/<slug>/chNN.html`                                    | Every layer a lesson won't explain has a `data-part`; `make smoke` and `make steps` pass  |
| 4   | **Write**              | edit each `script.md`                                            | No TODO left; every number said aloud has a `{check}`; every `{run}` compiles             |
| 5   | **Judge**              | hand every script to the `script-judge` agent                    | Its verdict is **pass**, recorded by `tools/video/judgement.py` (see below)               |

Step 3 follows "Ready for videos" in the `build-chapter-page` skill's `machines.md`, and the book's `authoring.md`.
Steps 6–8 (silent pass, pilot, render and QA) are the `record-video` skill, and step 9 (publish) is `publish-video`.

**Step 5 is enforced.** `narrate.py` refuses to narrate a script unless `judgement.py check` passes: a verdict of pass
whose hash matches what viewers read or hear in the script now (speech, `{label}`, `{card}`, `{board}`, `{bullet}`,
`{sub}`, `{mono}`, `{item}`, `{goto}` text, the title and kicker, and the editor's snapshots). Changing timing or focus
cues doesn't need a new judgement; changing any of those words does. Don't judge your own script: the point is a reader
who didn't write it. Give `script-judge` only the script paths, never your notes.

## Where things live

```
books/<slug>/book.json                             the book's outputs, playlists, title formats, voice, language
videos/<book>/<ch>/script.md                       the chapter's long-form script
videos/<book>/<ch>/NN-name/script.md               a lesson's script (<!-- comments --> are never spoken)
videos/<book>/<ch>/NN-name/script.judgement.json   its judge's verdict, hashed against the script
videos/<book>/<ch>/NN-name/build/<voice>/          clips, Whisper word times, manifest.json, frames while recording
videos/<book>/<ch>/NN-name/build/<language>/       each code snapshot that is run, compiled
videos/<book>/<ch>/NN-name/NN-name-<voice>.mp4     the lesson, with its .srt captions
```

Everything made while producing a chapter's videos, test renders included, goes in its chapter folder, never under
`tools/`. The book folder is the book's slug (`clrs`). Scripts never go to GitHub: `videos/` has its own git repo with
no remote, so commit script changes there (`git -C videos commit`). Never `git add -f` anything under `videos/` in the
main repo.

## The section (lessons)

A chapter's lessons follow this order. The numbers come from the reference course, measured lesson by lesson.

| Lesson                   | Kind      | Length  | What happens                                                                                        |
| ------------------------ | --------- | ------- | --------------------------------------------------------------------------------------------------- |
| `01-introduction`        | `board`   | 20–40 s | "In this section, we're going to talk about…": one bullet per big idea, then "so let's get started" |
| concept                  | `concept` | 1–3 min | One idea, animated on the chapter's machine. No code on screen                                      |
| code                     | `code`    | 2–6 min | The same idea in the book's language, typed live: first with the standard library, then built from scratch |
| `NN-exercise-…`          | `code`    | 30–90 s | The task, typed as comments in the editor, one example, one hint, and a time to spend on it         |
| `NN-solution-…`          | `code`    | 2–7 min | The algorithm as comments first, then the code, a run, and a better second version                  |
| …more concepts and code… |           |         | Two exercises per chapter is right                                                                  |
| `NN-summary`             | `board`   | 1–2 min | "Let's quickly recap…": one bullet per idea, as it's said                                           |
| `NN-wrap-up`             | `board`   | 20–40 s | "Congratulations on completing…", where to try the machines, and what the next section covers       |

**Lengths are guides, not caps.** A lesson a little over its range is fine as it is. Offer a split only when a lesson runs
clearly long (a concept lesson near 4 minutes) or covers two ideas, and keep animation-then-code order for each idea.

**Every lesson** opens on its title card, held for three seconds with no voice, which then slides away. It is about one
idea. It ends by naming the next lesson: "Next, we're going to look at…". A concept lesson can show a second machine with
`{goto scene}`, which dips to black.

**The order inside a lesson:**
- **Concept:** the problem, then the animation that shows it, then the name for it, then why it matters.
- **Code:** what we're going to build, then type it while saying what each line does, then run it. When a version works
  but can be better, say so ("this works, but…"), improve it, and run it again.
- **Exercise:** the task in one sentence, then the example typed as comments, then what makes it interesting, then a hint,
  then "spend N minutes on it, then see my solution". Give one time, not two.
- **Solution:** explain the algorithm first, in comments on a small example, then "that is our algorithm, now let's
  implement it".

## Between chapters

The series is one course, so each section knows what came before it:

- **`01-introduction`** opens with one sentence on the previous section ("In the last section, you learned what an
  algorithm is, and wrote insertion sort in Rust"), then says what this one adds.
- **Concepts and code reuse what the viewer already has.** Start from the earlier code and examples (for CLRS: insertion
  sort, the numbers 31, 41, 59, 26, 41, 58, the card analogy, the race) and say so: "Remember the race from the last
  section?". Don't re-explain a language idea an earlier chapter taught (the book's curriculum says which); use it, with
  a short reminder.
- **The wrap-up** names the next section and the one thing it builds on from this one.
- **Lesson titles** follow the same pattern in every chapter: "Exercise: …", "Solution: …", "… in Rust" (the book's
  language), "Summary", "Wrap Up".

## The lint

`narrate.py` stops a script that has a TODO, a digit or symbol in speech (write "ampersand mut", not `&mut`), a sentence
that recites more than two numbers, a sentence over 34 words, or a banned name. Fix the sentence; don't use `--no-lint`.
