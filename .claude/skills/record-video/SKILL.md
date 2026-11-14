---
name: record-video
description: Narrate, record and QA a chapter's judged video scripts (lessons and long-form) into finished MP4s with captions, all local — silent pass, pilot, full render, quality bar. Use when the user asks to record, render, narrate or finish a video. Not for uploading (publish-video) or writing and judging scripts (write-video-script, judge-video-script).
---

# Record a chapter's videos

This is steps 6–8 of a chapter's videos. Steps 1–5 are the `write-video-script` and `judge-video-script` skills: a
script reaches this skill written and judged. Step 9, uploading, is the `publish-video` skill, which only the user
starts. Read `books/<slug>/book.json` first: its `videos` block names the voice and the outputs.

Everything here stays on this machine, so it's safe to run whenever the user asks for a video to be recorded or
finished. It is slow: narration and recording run in real time, so start long renders in the background.

## Steps

Each step has a gate. Don't start the next step until the gate passes.

| #   | Step                 | Command                                                                      | Gate                                                                                   |
| --- | -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 6   | **Silent pass**      | `make video-silent SCRIPT=videos/<book>/chNN/02-…/script.md`                 | No `CHECK FAILED`, `no button`, unknown target, or "typing ran past the voice"         |
| 7   | **Pilot**            | `make series ONLY=<book>/chNN/05-…`, or `make video-part` for a long form    | You've looked at one code lesson and one concept lesson (or one long-form part) at full size |
| 8   | **Render and QA**    | `make series ONLY=<book>/chNN`, then `make video-qa VIDEO=…` for each video  | No FAIL. Fix every WARN, or write down why it stays ([quality-bar.md](quality-bar.md))  |

**Lessons** are recorded with `make series` (`tools/video/make-series.sh`). **The long-form video** is recorded with
`narrate.py videos/<book>/chNN/script.md --voice <voice>`, then `studio.js` on the manifest it prints. Its pilot is one
part: `make video-part SCRIPT=videos/<book>/chNN/script.md ONLY="Part 4 of"` narrates and records just that part.

A silent pass (`--silent`) needs no verdict and estimates timing at 150 words a minute. Real narration runs faster, so
a cue that only just made it in the silent pass can still fail in the pilot.

**Looking at a video.** Pull frames with `ffmpeg -ss <t> -i <video> -frames:v 1` and read them, at the title card, on
each kind of scene, and at the end. Check that nothing is clipped, the focus ring sits on what the voice names, and the
code panel and stats appear only once they're named.

## When a check fails

`studio.js` runs a `{check}` about 30 ms after the cue before it. If that cue was a `{click}` that starts an animation
(a card lifting, a node finishing), the page writes the new caption only when the animation ends, so the check reads the
previous step's caption. The log shows it: the `click` line and the failed `check` both show the old caption, and the
next check passes. That's a cue that's too early, not a wrong script. Move the `{check}` a few words later, onto the
word that names the result. Moving a cue doesn't change what viewers hear or read, so the verdict still holds; confirm
with `judgement.py check`.

## Judged scripts only

`narrate.py` refuses to narrate a script whose `script.judgement.json` is missing, failing, or out of date with the
script's words (`python3 tools/video/judgement.py check <script>` says which). `--skip-judgement` exists for test
renders only: never publish a video narrated with it. If a script's words change after judging, it goes back through
the `script-judge` agent before it's recorded.

## Voice and narration

- The voice is `book.json` `videos.voice` — `kokoro:bm_fable` for CLRS, for every lesson and long-form video.
  (`kokoro:am_liam` was compared on three lessons and rejected; don't render or offer it unless the user asks.)
- Narration is cached per block, so re-running after an edit only redoes what changed.
- Everything a render makes, test renders included, stays in the chapter's folder under `videos/`.

## Done

A recorded video is its MP4 and `.srt` in the chapter's folder, passing QA. Tell the user where they are and what QA
said. Uploading is a separate step: the user starts it with `/publish-video`.
