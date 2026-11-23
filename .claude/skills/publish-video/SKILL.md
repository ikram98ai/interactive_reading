---
name: publish-video
description: Upload recorded videos (a chapter's video) to YouTube through Studio's web UI, or edit ones already uploaded (titles, descriptions, thumbnails, schedule, playlists). Run only when the user asks for it.
disable-model-invocation: true
---

# Publish videos

This is step 9 of a video. A video reaches this skill recorded and passing QA (the `record-video` skill).
Uploading is public and hard to undo, so only the user starts it. Read `books/<slug>/book.json` first: its `videos`
block names the outputs, their playlists and title formats, the schedule and the site.

| #   | Step        | How                                                                                                   | Gate                                                                           |
| --- | ----------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 9   | **Publish** | `node tools/video/studio_upload.js videos/<book> --long-form chNN --day YYYY-MM-DD --plan`, then without `--plan` | Every video is up, titled, described, captioned, scheduled and in its playlist |

One video per run: `--long-form chNN` for a chapter video. `--long-form chNN/sMM` still addresses a retired CLRS
section video (`chNN-sMM-<section>.mp4`, by `book.json` `videos.section`), for editing one already up; don't upload new
ones. A Short is `node tools/video/studio_upload.js videos/shorts/<book> --short NNN|all [--plan]`, and goes up as a
**draft** (never scheduled or published; the user publishes it from Studio): title from the script's front matter, the
one-line `description.txt` beside it (hook only, never the book or a channel), captions, not made for kids, English,
the playlist `videos.shorts.playlist` (it must already exist in Studio), no thumbnail (a Short's cover is a frame chosen
in Studio). It refuses a video that isn't vertical or runs over 3:00. `--plan` uploads nothing: it prints the title, playlist, publish time, description, judgement, QA
and every problem, and exits 1 if there is one. The real run refuses on any problem too.

**Judged and checked only.** Publish only a video narrated from a script that passes `judgement.py check`, never one
narrated with `--skip-judgement`, and only once its QA has no FAIL. `--long-form` enforces both: it runs
`judgement.py check`, and runs `qa.py` before uploading (about 5 minutes; the result is cached in `<video>.qa.json` until
the MP4 changes). Its WARN lines are in the plan: fix each, or write down why it stays.

## Before uploading

- **Check what's already up.** Each uploaded video has a `<video>.youtube.json` record beside it, and the `videos/` git
  history keeps the records of everything ever uploaded. `--long-form` checks both, so a record deleted from disk
  still counts, and the plan says how to restore it. If a video for the same chapter is already up, ask the user
  whether to replace it (only safe while it's still scheduled, not public) or leave it. To replace it, pass
  `--replaces <old video id>`. The old record moves to `<video>.retired.youtube.json`, and unlisting the old video and
  taking it out of the playlist are done by hand in Studio.
- **Ask the user which day**, then show them the `--plan` output before the real run.

## Publishing on YouTube

- **YouTube Studio's web UI only, never the API.** `tools/video/studio_upload.js` drives Studio with Playwright in a
  persistent, signed-in Chrome profile. Progress is written to each video's `<video>.youtube.json`, so a rerun resumes.
- **What `studio_upload.js` can do today:**
  - `--long-form chNN` uploads `chNN/chNN-<chapter>.mp4` (the book's chapter title as a file name, such as `ch06-heapsort.mp4`) with all of the below, playlist included, and resumes an
    unfinished upload when rerun. It can't create a
    playlist: one missing from Studio's list stops the run.
  - `--long-form chNN[/sMM] --thumb` makes a new thumbnail and sets it on a video already up. It refuses unless the
    title Studio shows equals the one in the video's record.
  - `--titles` updates the title and description of a long-form video that's already up (it needs the video's record
    on disk).
- **What each book publishes:** one video per chapter, CLRS included (2026-11-22). The CLRS section videos for
  Chapters 2–5 are retired; the user takes them off YouTube by hand. A chapter long form goes in `videos.long_form.playlist`, titled by
  `videos.long_form.title`: for CLRS, "Introduction to Algorithms", and a title like "1: The Role of Algorithms in
  Computing | Introduction to Algorithms".
- Studio allows 100 characters in a title. A title that would run longer drops its " | Introduction to Algorithms"
  suffix (a retired section title, 5.4's, needed this); one still too long stops the run.
- **Descriptions:**
  - A long-form description opens with `videos.long_form.intro`, then the chapter's page link (`videos.site`) and the
    chapter timestamps from `<video>.chapters.txt`. YouTube only makes chapters when the first is 0:00, there are
    at least three, and each lasts 10 seconds, so `--long-form` refuses a file that breaks those rules.
  - `studio_upload.js --titles` rewrites only that first line, and refuses if the text it reads doesn't link that
    chapter's page.
  - Every video gets its `.srt` captions, "not made for kids", and a thumbnail made by `tools/video/thumb.js`, readable at a phone feed's size. Give each video a `thumb.json` beside its script (format in thumb.js's header): the video's real title as the headline, under it a two-line hook that opens the video's own opening question, beside one bold picture of the video's machine (`race`, `cards`, `curves`, `tree`, `products`, `hires`; no two videos in a playlist side by side with the same kind), and `"rust": true` (the Rust logo, in orange) only when the video ends in Rust (never a CLRS chapter video). The hook promises only what the video shows. Without a `thumb.json` it falls back to the plain title card.
- **The schedule** (`videos.schedule`) is in the channel's time zone, Asia/Karachi. A long form goes out at
  `videos.long_form.time` on a `videos.long_form.weekday`. Ask the user which day a video goes out. Scheduling is done
  on YouTube, not by holding files back locally.
- **Limits:** Studio allows about 70 uploads in a rolling 24 hours ("Daily upload limit reached" in the dialog). Stop
  and resume later; the records make it safe.
- **Records:** commit each new or changed `<video>.youtube.json` in the `videos/` repo (`git -C videos commit`).

## After publishing

YouTube can't replace a published video's file; a re-upload gets a new URL and loses views and comments. To fix a mistake
in a published video, cut a self-contained sentence in Studio's editor (Content → the video → Editor → Trim & cut; it
keeps the URL, but can't be undone, so keep the local MP4), and check its captions afterwards. Use a pinned comment and a
line in the description for anything a cut can't fix. A video still scheduled and not yet public can simply be replaced.
