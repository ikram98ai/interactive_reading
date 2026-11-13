---
name: record-and-publish-video
description: Narrate, record, QA and upload a chapter's videos (lessons and long-form) to YouTube through Studio's web UI, or edit ones already uploaded (titles, descriptions, schedule, playlists). Run only when the user asks for it.
disable-model-invocation: true
---

# Record and publish a chapter's videos

This is steps 6–9 of a chapter's videos. Steps 1–5 are the `write-video-script` and `judge-video-script` skills: a
script reaches this skill written and judged. Read `books/<slug>/book.json` first: its `videos` block names the voice,
the outputs, their playlists and title formats, the schedule and the site.

## Steps

Each step has a gate. Don't start the next step until the gate passes.

| #   | Step                 | Command                                                                         | Gate                                                                                  |
| --- | -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 6   | **Silent pass**      | `make video-silent SCRIPT=videos/<book>/chNN/02-…/script.md`                    | No `CHECK FAILED`, `no button`, unknown target, or "typing ran past the voice"        |
| 7   | **Pilot one lesson** | `make series ONLY=<book>/chNN/05-…`                                             | You've watched one code lesson and one concept lesson at full size                    |
| 8   | **Render and QA**    | `make series ONLY=<book>/chNN`, then `make video-qa VIDEO=…` for each lesson    | No FAIL. Fix every WARN, or write down why it stays ([quality-bar.md](quality-bar.md)) |
| 9   | **Publish**          | `node tools/video/studio_upload.js videos/<book> --plan`, then without `--plan` | Every video is up, titled, described, captioned, scheduled and in its playlist        |

The long-form video is recorded with `narrate.py videos/<book>/chNN/script.md`, then `studio.js` on its manifest
(`make-series.sh` records the lessons instead).

**Judged scripts only.** `narrate.py` refuses to narrate a script whose `script.judgement.json` is missing, failing, or
out of date with the script's words (`python3 tools/video/judgement.py check <script>` says which). `--silent` doesn't
need a verdict. `--skip-judgement` exists for test renders only: never publish a video narrated with it. If a script's
words change after judging, it goes back through the `script-judge` agent.

## Voice and narration

- The voice is `book.json` `videos.voice` — `kokoro:bm_fable` for CLRS, for every lesson and long-form video.
  (`kokoro:am_liam` was compared on three lessons and rejected; don't render or offer it unless the user asks.)
- Narration is cached per block, so re-running after an edit only redoes what changed.
- Everything a render makes, test renders included, stays in the chapter's folder under `videos/`.

## Publishing on YouTube

- **YouTube Studio's web UI only, never the API.** `tools/video/studio_upload.js` drives Studio with Playwright in a
  persistent, signed-in Chrome profile, and uploads, titles, describes, captions and schedules each video in one pass.
  `--plan` prints what it would do and stops. `--edit` updates videos already up instead (title, description,
  thumbnail, publish time). Progress is written to each video's `<video>.youtube.json`, so a rerun resumes.
- **Two outputs, two playlists** (CLRS): each chapter's long-form video goes to `videos.long_form.playlist`
  ("Introduction to Algorithms"), titled by `videos.long_form.title` ("Chapter 1: The Role of Algorithms in Computing |
  Introduction to Algorithms"). Lessons go to `videos.lessons.playlist` ("Introduction to Algorithms with Rust"), titled
  by `videos.lessons.title` ("1.3 How to Sort a Vec in Rust: … | Introduction to Algorithms with Rust"). Other books
  declare their own, or none. Studio allows 100 characters in a title.
- **Titles and descriptions** for lessons are written per lesson in `videos/<book>/chNN/youtube-meta.json`. Each
  description links the chapter's page (`videos.site`) and the chapter's long-form video. A long-form description opens
  with `videos.long_form.intro`; `studio_upload.js --titles` rewrites only that first line, keeping the page link and
  chapter timestamps below it, and refuses if the text it reads doesn't link that chapter's page. Every video gets its `.srt`
  captions, "not made for kids", and its first frame (the title card) as its thumbnail.
- **The schedule** (`videos.schedule`, in the channel's time zone, Asia/Karachi): each chapter goes out within one week,
  with related lessons grouped on the same day; the groups live in `videos/<book>/schedule.json`. A day's lessons go out
  `gap_hours` apart from `first` (18:00, 20:00, 22:00); a day with more lessons starts earlier, so the last is out at
  `last` (22:00). The long-form video goes out the day after the chapter's last lesson, at `first`. Scheduling is done on
  YouTube, not by holding files back locally.
- **Limits:** Studio allows about 70 uploads in a rolling 24 hours ("Daily upload limit reached" in the dialog). Stop
  and resume later; the records make it safe.

## After publishing

YouTube can't replace a published video's file; a re-upload gets a new URL and loses views and comments. To fix a mistake
in a published video, cut a self-contained sentence in Studio's editor (Content → the video → Editor → Trim & cut; it
keeps the URL, but can't be undone, so keep the local MP4), and check its captions afterwards. Use a pinned comment and a
line in the description for anything a cut can't fix. A video still scheduled and not yet public can simply be replaced.
