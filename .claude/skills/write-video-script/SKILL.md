---
name: write-video-script
description: Plan and write a video script, a chapter's video (videos/<book>/chNN/script.md, one per chapter for CLRS and every other book), or edit an existing one. Use for any video script work, before narrating. Not for recording (record-video) or uploading (publish-video) or chapter pages (build-chapter-page).
---

# Write a video script

Every book with videos (`books/<slug>/book.json` `videos` is not null) gets one of two kinds of video, and no other:

- **CLRS: one video per chapter** (decided 2026-11-22), `videos/clrs/chNN/script.md`. Picture first: the page's
  machines carry each idea and the narration stays short, with no fixed length and no Rust (the Rust programs live in
  the Shorts, `videos/shorts/clrs/plan.md`). Each chapter's block in `videos/clrs/plan.md` is its plan (step 1 below),
  and the plan's rules (the condensed depths, "previously" beats, the ledger of who teaches what) apply on top of this
  skill. `videos/clrs/ch03/script.md` is the model. The section videos once made for Chapters 2–5 (`chNN/sMM/`) are
  retired; their scripts are source material only.
- **Any other book: one long-form video per chapter** (`videos.long_form`), `videos/<book>/chNN/script.md`, covering
  the whole chapter in one sitting.

Both are written by the method in [long-form.md](long-form.md). A chapter or section gets no other videos: no lesson
series, and no intro, summary or wrap-up videos.

**Retired section folders.** The tools still read a script under `chNN/sMM/` as Section N.M (named `chNN-sMM`, titled
from `book.json` `sections`), so an old section video can be re-rendered or its upload edited. Don't write new ones.

**The CLRS Shorts** (one per algorithm, Rust in the editor on top and the page's machine below) have their own plan and
process in `videos/shorts/clrs/plan.md`; this skill's voice, picture and lint rules apply to them too.

The format comes from measuring a well-regarded programming course video by video (`videos/demo`). Today the recorder
can drive only CLRS pages (`books/clrs`).

## Before you start

1. Read `books/<slug>/book.json`. If `videos` is null, the book has no videos.
2. Read [voice.md](voice.md), [picture.md](picture.md) and [long-form.md](long-form.md).
3. Call the book by its real title (`book.json` `title`), never a made-up site name, and never name another channel,
   tutor or course.

## Steps

Each step has a gate. Don't start the next step until the gate passes.

| #   | Step                   | Command                                                          | Gate                                                                                     |
| --- | ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **Plan**               | read the video's block in the book's plan (CLRS: `videos/clrs/plan.md`), `make video-plan PAGE=books/<slug>/chNN.html`, then `make video-trace` for each machine | You've chosen the parts (one question each) and the machine each one drives |
| 2   | **Start the script**   | create the script: `videos/<book>/chNN/script.md`                 | It has its front matter (below), the cold open, the agenda and a `{goto}` card per part  |
| 3   | **Ready the machines** | edit `books/<slug>/chNN.html`                                    | Every layer the video won't explain has a `data-part`; `make smoke` and `make steps` pass |
| 4   | **Write**              | edit `script.md`, then read every paragraph aloud                | No TODO left; every number said aloud has a `{check}`; `make video-silent` prints no "written for the eye" warning |
| 5   | **Judge**              | hand the script to the `script-judge` agent                      | Its verdict is **pass**, recorded by `tools/video/judgement.py` (see below)               |

Step 3 follows "Ready for videos" in the `build-chapter-page` skill's `machines.md`.
Steps 6–8 (silent pass, pilot, render and QA) are the `record-video` skill, and step 9 (publish) is `publish-video`.

**Step 5 is enforced.** `narrate.py` refuses to narrate a script unless `judgement.py check` passes. That needs a verdict
of pass whose hash matches what viewers read or hear in the script now:
- the speech, the title and the kicker;
- the text of `{label}`, `{card}`, `{board}`, `{bullet}`, `{sub}`, `{mono}`, `{item}` and `{goto}`;
- the editor's snapshots, if any (a Short, a code video, or a CS:APP RUST part).

Changing timing or focus cues doesn't need a new judgement; changing any of those words does. Don't judge your own
script: the point is a reader who didn't write it. Give `script-judge` only the script path, never your notes.

## Where things live

```
books/<slug>/book.json                     the book's outputs, playlists, title formats, voice, language
videos/clrs/plan.md                        the CLRS plan: rules, ledger, and one block per chapter video
videos/<book>/chNN/script.md               a chapter's script (<!-- comments --> are never spoken)
videos/clrs/chNN/sMM/script.md             a retired CLRS section script, source material only
videos/shorts/clrs/plan.md                 the CLRS Shorts' plan, rules and Rust ledger
<video folder>/script.judgement.json       its judge's verdict, hashed against the script
<video folder>/build/<voice>/              clips, Whisper word times, manifest.json, frames while recording
videos/<book>/chNN/chNN-<chapter>.mp4      a chapter video (ch06-heapsort.mp4), with its .srt captions and .chapters.txt
```

A retired section video was `videos/clrs/chNN/sMM/chNN-sMM-<section>.mp4` (`ch02-s01-insertion-sort.mp4`).

**Front matter**, between `---` lines at the top (copy an existing script's): `title` and `kicker` (the title card),
`page` (the chapter page), `scene` (the first scene's id), `seed` (fixes
`Math.random`), and `targets:` (named `svg:` / `css:` / `code:` regions that `{focus}`, `{show}` and `{hide}` use).
Code videos also set `kind` and `start`.

Everything made while producing a video, test renders included, goes in that video's folder, never under `tools/`. The book folder is the book's slug (`clrs`). Scripts never go to GitHub: `videos/` has its own git repo with
no remote, so commit script changes there (`git -C videos commit`). Never `git add -f` anything under `videos/` in the
main repo.

## The lint

`narrate.py` stops a script that has any of these. Fix the sentence; don't use `--no-lint`.
- a TODO;
- a digit or symbol in speech (write "ampersand mut", not `&mut`);
- a sentence that recites more than two numbers;
- a sentence over 34 words;
- a banned name.

It also warns, without stopping, about sentences written for the eye: over 25 words, or more than 16 words with no
comma, colon or dash for the voice to breathe at ([voice.md](voice.md), "Breathing" and "Write for the ear"). A new
script fixes every one. Scripts judged before 2026-11-22 still narrate, and fix theirs the next time their words change.
