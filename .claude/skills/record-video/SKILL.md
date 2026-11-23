---
name: record-video
description: Narrate, record and QA judged video scripts (a chapter's video, or a CLRS Short) into finished MP4s with captions, all local — silent pass, pilot, full render, quality bar. Use when the user asks to record, render, narrate or finish a video. Not for uploading (publish-video) or writing and judging scripts (write-video-script, judge-video-script).
---

# Record a video

This is steps 6–8 of a video. Steps 1–5 are the `write-video-script` and `judge-video-script` skills: a
script reaches this skill written and judged. Step 9, uploading, is the `publish-video` skill, which only the user
starts. Read `books/<slug>/book.json` first: its `videos` block names the voice and the outputs.

`SCRIPT` below is the video's script: `videos/<book>/chNN/script.md` for a chapter video, which comes out as
`chNN-<chapter>.mp4` in its folder. A CLRS Short is recorded as one part (`make video-part`, step 5 of
`videos/shorts/clrs/plan.md`). A CLRS chapter video has no editor; a CS:APP one with more than one RUST part still
needs the editor round trip (`{goto page}`): today `studio.js` allows one switch to the editor per video. Retired
section scripts (`chNN/sMM/`) still record, as `chNN-sMM-<section>.mp4`, but no new ones are made.

Everything here stays on this machine, so it's safe to run whenever the user asks for a video to be recorded or
finished. It is slow: narration and recording run in real time, so start long renders in the background.

## Steps

Each step has a gate. Don't start the next step until the gate passes.

| #   | Step                 | Command                                                                      | Gate                                                                                   |
| --- | -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 6   | **Silent pass**      | `make video-silent SCRIPT=<script>`                                          | No `CHECK FAILED`, `no button`, `could not press` or unknown target                    |
| 7   | **Pilot**            | `make video-part SCRIPT=… ONLY="Part 4 of"`                                  | You've looked at one part at full size, and listened to it through                     |
| 8   | **Render and QA**    | `make video-long SCRIPT=…`, then `make video-qa VIDEO=…`                     | No FAIL. Fix every WARN, or write down why it stays ([quality-bar.md](quality-bar.md))  |

**Keep the Mac awake while it records** (`caffeinate -i`, or `caffeinate -i -w <pid>` for a queue): a recording runs
in real time, and a sleep in the middle stretches that part with dead air. `assemble.js` refuses to cache a part that
runs more than twice its speech plus a minute, and says so; record it again once the machine stays awake.

**The video** is recorded with `make video-long SCRIPT=<script>`: `narrate.py`, then
`assemble.js` on the manifest it prints. That records each part (the intro, and each section card on) on its own, caches
it under `build/<voice>/parts/`, and joins the parts without a seam: a part ends by fading to the page's own background (the middle of the dissolve into
the next part), and the next starts from that same flat frame.

**Fixing part of a recorded video.** Edit the script, judge it again, and run `make video-long` again: only the parts
whose words or cues changed are re-recorded (a few minutes, not the whole video), and the join takes about a minute.
`ARGS=--dry-run` lists which parts would be recorded and why. A change to the chapter page, or to `studio.js`, re-records
every part. If a page edit only touched some scenes, say which: `ARGS="--page-scenes=big-o,omega"` (scene ids) keeps the
parts that don't show them. Run QA on the joined video as always, and look at the re-recorded parts.

Its pilot is one
part: `make video-part SCRIPT=<script> ONLY="Part 4 of"` narrates and records just that part.
`ONLY` picks the first `{goto}` whose text contains it (here, the card "Part 4 of 15"; the kicker is never on screen, but
it still names the part), records through to the next card, and names the output after it
(`chNN-part-4-of-…mp4`).

A silent pass (`--silent`) needs no verdict and estimates timing at 150 words a minute. Real narration runs faster, so
a cue that only just made it in the silent pass can still fail in the pilot.

**Looking at a video.** Pull frames with `ffmpeg -ss <t> -i <video> -frames:v 1` and read them, at the title card, on
each kind of scene, and at the end. Check that nothing is clipped, the focus ring sits on what the voice names, and the
code panel and stats appear only once they're named. Wherever the editor is on screen (a Short, a CS:APP RUST part),
check the machine beside it: it is on the
step the voice is explaining, its stack-and-heap strip appears only once memory is named, and the names in the strip are
the editor's. The editor types brackets and quotes as an IDE does (the closer appears with the opener, and is stepped
over); a typing that ends different from its snapshot fails the recording ("typing left the editor different").

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

- The voice is `book.json` `videos.voice` — `kokoro:bm_fable` for CLRS, for every video.
  (`kokoro:am_liam` was compared and rejected; don't render or offer it unless the user asks.)
- The voice talks at Kokoro's speed 0.95 for every kind of video, and `narrate.py` opens the stops a person makes at
  the script's punctuation and `{beat}`s (`breathe`): it says each sentence on its own, and opens a stop only inside a
  silence the voice really leaves, so no cut clips a sound. Never lower the speed to slow a video down: that is what sounds
  like a computer. If a video feels rushed, the script needs more commas and beats (write-video-script voice.md).
- **Listen to the pilot.** Step 7's gate is listening, not only looking: play the part's audio through once. Where it
  runs on without a breath, or a result goes by with no moment to land, the fix is in the script (a comma, a split
  sentence, a `{beat}`), and a `{beat}` needs no new judgement.
- Narration is cached per block, so re-running after an edit only redoes what changed.
- Everything a render makes, test renders included, stays in the video's folder under `videos/`.

## Done

A recorded video is its MP4, `.srt` and `.chapters.txt` in its folder, passing QA. Tell the user where they are and what QA
said. Uploading is a separate step: the user starts it with `/publish-video`.
