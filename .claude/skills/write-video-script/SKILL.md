---
name: write-video-script
description: Plan and write a chapter's long-form video script (videos/<book>/chNN/script.md), or edit an existing one. Use for any video script work, before narrating. Not for recording (record-video) or uploading (publish-video) or chapter pages (build-chapter-page).
---

# Write a chapter's video script

Every book with videos (`books/<slug>/book.json` `videos` is not null) gets **one long-form video per chapter**
(`videos.long_form`). Its script is `videos/<book>/chNN/script.md`. It covers the whole chapter in one sitting, read in
the book's pseudocode, with its own rules in [long-form.md](long-form.md). A chapter gets no other videos: no lesson
series, and no intro, summary or wrap-up videos.

A book may also have videos of its own beyond the chapters. If so, its `book.json` names their guide
(`videos.lessons.guide`), and that guide says how they're made. This skill's voice, picture and lint rules still apply
to them.

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
| 1   | **Plan**               | `make video-plan PAGE=books/<slug>/chNN.html`, then `make video-trace` for each machine | You've chosen the parts (one question each) and the machine each one drives |
| 2   | **Start the script**   | create `videos/<book>/chNN/script.md`                            | It has its front matter (below), the cold open, the agenda and a `{goto}` card per part  |
| 3   | **Ready the machines** | edit `books/<slug>/chNN.html`                                    | Every layer the video won't explain has a `data-part`; `make smoke` and `make steps` pass |
| 4   | **Write**              | edit `script.md`                                                 | No TODO left; every number said aloud has a `{check}`                                     |
| 5   | **Judge**              | hand the script to the `script-judge` agent                      | Its verdict is **pass**, recorded by `tools/video/judgement.py` (see below)               |

Step 3 follows "Ready for videos" in the `build-chapter-page` skill's `machines.md`.
Steps 6–8 (silent pass, pilot, render and QA) are the `record-video` skill, and step 9 (publish) is `publish-video`.

**Step 5 is enforced.** `narrate.py` refuses to narrate a script unless `judgement.py check` passes. That needs a verdict
of pass whose hash matches what viewers read or hear in the script now:
- the speech, the title and the kicker;
- the text of `{label}`, `{card}`, `{board}`, `{bullet}`, `{sub}`, `{mono}`, `{item}` and `{goto}`;
- the editor's snapshots, if any.

Changing timing or focus cues doesn't need a new judgement; changing any of those words does. Don't judge your own
script: the point is a reader who didn't write it. Give `script-judge` only the script path, never your notes.

## Where things live

```
books/<slug>/book.json                     the book's outputs, playlists, title formats, voice, language
videos/<book>/chNN/script.md               the chapter's long-form script (<!-- comments --> are never spoken)
videos/<book>/chNN/script.judgement.json   its judge's verdict, hashed against the script
videos/<book>/chNN/build/<voice>/          clips, Whisper word times, manifest.json, frames while recording
videos/<book>/chNN/chNN-<chapter>.mp4      the video (ch06-heapsort.mp4), with its .srt captions and .chapters.txt
```

**Front matter**, between `---` lines at the top (copy an existing chapter's): `title` and `kicker` (the title card),
`page` (the chapter page), `scene` (the first scene's id), `seed` (fixes `Math.random`), and `targets:` (named
`svg:` / `css:` / `code:` regions that `{focus}`, `{show}` and `{hide}` use). Code videos also set `kind` and `start`.

Everything made while producing a chapter's video, test renders included, goes in its chapter folder, never under
`tools/`. The book folder is the book's slug (`clrs`). Scripts never go to GitHub: `videos/` has its own git repo with
no remote, so commit script changes there (`git -C videos commit`). Never `git add -f` anything under `videos/` in the
main repo.

## The lint

`narrate.py` stops a script that has any of these. Fix the sentence; don't use `--no-lint`.
- a TODO;
- a digit or symbol in speech (write "ampersand mut", not `&mut`);
- a sentence that recites more than two numbers;
- a sentence over 34 words;
- a banned name.
